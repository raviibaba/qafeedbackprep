// --------------------------- CONFIG ---------------------------
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbw5HW8pBraQ_QTt43a8aIqfGYhQrMp7KgNTa-aSTVA9ZIXoIhAjMmqEoDPBQX5EvEu1/exec'; // Replace with your Web App URL

// --------------------------- GLOBALS ---------------------------
let errors = []; // store all fetched errors for UI
let qaName = ''; // QA Name input by user

// --------------------------- DOM ELEMENTS ---------------------------
const errorInput = document.getElementById('errorInput');
const jidInput = document.getElementById('jidInput');
const screenshotsInput = document.getElementById('screenshotsInput');
const addErrorBtn = document.getElementById('addErrorBtn');
const errorsContainer = document.getElementById('errorsContainer');
const downloadPDFBtn = document.getElementById('downloadPDFBtn');
const qaNameInput = document.getElementById('qaNameInput');
const documentNameInput = document.getElementById('documentNameInput');

// --------------------------- UTILS ---------------------------

// Convert pasted screenshots to Base64
function getScreenshotsBase64() {
    const files = screenshotsInput.files;
    let base64Images = [];
    if (files.length === 0) return [];
    for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        reader.onload = function(e) {
            base64Images.push(e.target.result);
        };
        reader.readAsDataURL(files[i]);
    }
    return base64Images;
}

// Auto-increment Error Number
function getNextErrorNumber() {
    return errors.length + 1;
}

// Render error in UI
function addErrorToUI(err) {
    errors.push(err);

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-item';
    errorDiv.innerHTML = `
        <p><strong>Error ${err.number}:</strong> ${err.error}</p>
        <p><strong>JID:</strong> ${err.jid}</p>
        <div class="screenshots-container" style="text-align:center;">
            ${err.screenshot.split(',').map(s => `<img src="${s}" style="max-width:100%; margin:5px;">`).join('')}
        </div>
    `;
    errorsContainer.appendChild(errorDiv);
}

// --------------------------- FETCH ERRORS ---------------------------
async function loadErrors() {
    try {
        const res = await fetch(SHEET_URL);
        const data = await res.json();
        data.forEach(err => addErrorToUI(err));
    } catch (err) {
        console.error("Failed to fetch errors:", err);
    }
}

// --------------------------- ADD ERROR ---------------------------
addErrorBtn.addEventListener('click', async () => {
    qaName = qaNameInput.value.trim();
    if (!qaName) { alert('Please enter QA Name'); return; }

    const errorText = errorInput.value.trim();
    const jid = jidInput.value.trim();
    const screenshots = getScreenshotsBase64();

    if (!errorText || !jid) { alert('Please enter Error and JID'); return; }

    const errorNumber = getNextErrorNumber();
    const payload = {
        number: errorNumber,
        qa: qaName,
        date: new Date().toLocaleString(),
        error: errorText,
        jid: jid,
        screenshot: screenshots.join(',')
    };

    try {
        const res = await fetch(SHEET_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await res.text();
        if (result === 'success') {
            addErrorToUI(payload);
            errorInput.value = '';
            jidInput.value = '';
            screenshotsInput.value = '';
        } else {
            alert('Failed to add error');
        }
    } catch (err) {
        console.error("Failed to add error:", err);
    }
});

// --------------------------- GENERATE PDF ---------------------------
downloadPDFBtn.addEventListener('click', async () => {
    // Fetch latest errors
    const res = await fetch(SHEET_URL);
    const data = await res.json();

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const docName = documentNameInput.value.trim() || 'Document Name';
    let y = 20;

    doc.setFontSize(16);
    doc.text(docName, 105, y, { align: 'center' });
    y += 10;

    doc.setFontSize(12);
    doc.text(`Total errors added: ${data.length}`, 105, y, { align: 'center' });
    y += 10;

    data.forEach(err => {
        y += 10;
        doc.text(`Error ${err.number}: ${err.error}`, 10, y);
        y += 6;
        doc.text(`JID: ${err.jid}`, 10, y);
        y += 6;

        // Add screenshots
        const screenshots = err.screenshot.split(',');
        screenshots.forEach((s, idx) => {
            if (s) {
                doc.addImage(s, 'JPEG', 30, y, 150, 0); // 0 height keeps aspect ratio
                y += 50;
                if (y > 270) doc.addPage(); y = 20;
            }
        });
    });

    doc.save(`${docName}.pdf`);
});

// --------------------------- INIT ---------------------------
window.onload = loadErrors;
