// --------------------------- CONFIG ---------------------------
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbw5HW8pBraQ_QTt43a8aIqfGYhQrMp7KgNTa-aSTVA9ZIXoIhAjMmqEoDPBQX5EvEu1/exec'; // Replace with your Google Apps Script Web App URL

// --------------------------- GLOBALS ---------------------------
let errors = []; // Store all errors
let pendingRemoveIndex = null; // For popup confirmation

// --------------------------- DOM ELEMENTS ---------------------------
const errorInput = document.getElementById('errorInput');
const jidInput = document.getElementById('jidInput');
const errorsContainer = document.getElementById('errorsContainer');
const downloadPDFBtn = document.getElementById('downloadPDFBtn');
const qaNameInput = document.getElementById('qaNameInput');
const documentNameInput = document.getElementById('documentNameInput');
const addErrorBtn = document.getElementById('addErrorBtn');
const pasteArea = document.getElementById('pasteArea');
const removeAllBtn = document.getElementById('removeAllBtn');

const confirmPopup = document.getElementById('confirmPopup');
const confirmMessage = document.getElementById('confirmMessage');
const confirmBtn = document.getElementById('confirmBtn');

// --------------------------- UTILS ---------------------------

// Get screenshots pasted in pasteArea as Base64
function getPastedScreenshots() {
    const images = pasteArea.querySelectorAll('img');
    return Array.from(images).map(img => img.src);
}

// Render all errors in UI and renumber
function renderErrors() {
    errorsContainer.innerHTML = '';
    errors.forEach((err, index) => {
        err.number = index + 1; // Update number dynamically
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-card';
        errorDiv.innerHTML = `
            <p><strong>Error ${err.number}:</strong> ${err.error}</p>
            <p><strong>JID:</strong> ${err.jid}</p>
            <div style="text-align:center;">
                ${err.screenshot.map(s => `<img src="${s}" />`).join('')}
            </div>
            <button class="remove-btn">Remove</button>
        `;

        // Remove single error
        errorDiv.querySelector('.remove-btn').addEventListener('click', () => {
            pendingRemoveIndex = index;
            confirmMessage.textContent = `Are you sure you want to remove Error ${err.number}?`;
            confirmPopup.style.display = 'block';
        });

        errorsContainer.appendChild(errorDiv);
    });
}

// --------------------------- FETCH ERRORS ---------------------------
async function loadErrors() {
    try {
        const res = await fetch(SHEET_URL);
        const data = await res.json();
        errors = data.map(err => ({
            number: err.number,
            qa: err.qa,
            date: err.date,
            error: err.error,
            jid: err.jid,
            screenshot: Array.isArray(err.screenshot) ? err.screenshot : err.screenshot.split(',')
        }));
        renderErrors();
    } catch (err) {
        console.error("Failed to fetch errors:", err);
    }
}

// --------------------------- ADD ERROR ---------------------------
addErrorBtn.addEventListener('click', async () => {
    const qaName = qaNameInput.value.trim();
    if (!qaName) { alert('Please enter QA Name'); return; }

    const errorText = errorInput.value.trim();
    const jid = jidInput.value.trim();
    const screenshots = getPastedScreenshots();

    if (!errorText || !jid || screenshots.length === 0) { 
        alert('Please enter error, JID, and paste at least one screenshot'); 
        return; 
    }

    const errorNumber = errors.length + 1;
    const payload = {
        number: errorNumber,
        qa: qaName,
        date: new Date().toLocaleString(),
        error: errorText,
        jid: jid,
        screenshot: screenshots
    };

    try {
        const res = await fetch(SHEET_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await res.text();
        if (result === 'success') {
            errors.push(payload);
            renderErrors();
            errorInput.value = '';
            jidInput.value = '';
            pasteArea.innerHTML = '';
        } else {
            alert('Failed to add error');
        }
    } catch (err) {
        console.error("Failed to add error:", err);
    }
});

// --------------------------- REMOVE ERRORS ---------------------------
function confirmRemove() {
    if (pendingRemoveIndex === 'all') {
        errors = [];
        errorsContainer.innerHTML = '';
        pendingRemoveIndex = null;
        confirmPopup.style.display = 'none';
        // TODO: Remove all from Google Sheet backend
    } else if (pendingRemoveIndex !== null) {
        errors.splice(pendingRemoveIndex, 1);
        pendingRemoveIndex = null;
        renderErrors();
        confirmPopup.style.display = 'none';
        // TODO: Remove single error from Google Sheet backend
    }
}

function cancelRemove() {
    pendingRemoveIndex = null;
    confirmPopup.style.display = 'none';
}

// Remove all errors
removeAllBtn.addEventListener('click', () => {
    if (errors.length === 0) return;
    pendingRemoveIndex = 'all';
    confirmMessage.textContent = `Are you sure you want to remove all errors?`;
    confirmPopup.style.display = 'block';
});

confirmBtn.addEventListener('click', confirmRemove);

// --------------------------- PDF GENERATION ---------------------------
downloadPDFBtn.addEventListener('click', async () => {
    if (errors.length === 0) { alert("No errors to download"); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const docName = documentNameInput.value.trim() || 'Document Name';
    let y = 20;

    doc.setFontSize(16);
    doc.text(docName, 105, y, { align: 'center' });
    y += 10;

    doc.setFontSize(12);
    doc.text(`Total errors added: ${errors.length}`, 105, y, { align: 'center' });
    y += 10;

    for (let err of errors) {
        y += 10;
        doc.text(`Error ${err.number}: ${err.error}`, 10, y);
        y += 6;
        doc.text(`JID: ${err.jid}`, 10, y);
        y += 6;

        for (let s of err.screenshot) {
            if (s) {
                try {
                    doc.addImage(s, 'JPEG', 30, y, 150, 0);
                    y += 50;
                    if (y > 270) { doc.addPage(); y = 20; }
                } catch (e) {
                    console.error("Failed to add image to PDF", e);
                }
            }
        }
    }

    doc.save(`${docName}.pdf`);
});

// --------------------------- PASTE HANDLER ---------------------------
pasteArea.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile();
            const reader = new FileReader();
            reader.onload = function(event) {
                const img = document.createElement('img');
                img.src = event.target.result;
                pasteArea.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    }
});

// --------------------------- INIT ---------------------------
window.onload = loadErrors;
