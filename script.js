// --------------------------- CONFIG ---------------------------
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbw5HW8pBraQ_QTt43a8aIqfGYhQrMp7KgNTa-aSTVA9ZIXoIhAjMmqEoDPBQX5EvEu1/exec';
const EMAIL_API_URL = 'https://script.google.com/macros/s/AKfycbyp0jbfge86yZcTuY7khppq1uajPNPd8MeSxH4QfVxptrvObBviQA73nJdyrKlmWKEi/exec';

// --------------------------- GLOBALS ---------------------------
let errors = [];
let pendingRemoveIndex = null;

// --------------------------- DOM ---------------------------
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
const sendEmailBtn = document.getElementById('sendEmailBtn');

// --------------------------- HELPERS ---------------------------

// Fix Base64 issue
function fixBase64(s) {
    if (!s) return "";
    if (!s.startsWith("data:image")) {
        return "data:image/png;base64," + s;
    }
    return s;
}

// Safe filename generator
function getSafeFileName() {
    const docName = documentNameInput.value.trim() || "QC_Feedback";

    return docName
        .replace(/[<>:"/\\|?*]+/g, '')   // remove invalid chars
        .replace(/\s+/g, '_');           // spaces → underscore
}

// Get pasted screenshots
function getPastedScreenshots() {
    const images = pasteArea.querySelectorAll('img');
    return Array.from(images).map(img => img.src);
}

// --------------------------- RENDER ---------------------------
function renderErrors() {
    errorsContainer.innerHTML = '';

    errors.forEach((err, index) => {
        err.number = index + 1;

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-card';

        errorDiv.innerHTML = `
            <p><strong>Error ${err.number}:</strong> ${err.error}</p>
            <p><strong>JID:</strong> ${err.jid}</p>
            <div style="text-align:center;">
                ${err.screenshot.map(s => `<img src="${fixBase64(s)}" onerror="this.style.display='none'"/>`).join('')}
            </div>
            <button class="remove-btn">Remove</button>
        `;

        errorDiv.querySelector('.remove-btn').addEventListener('click', () => {
            pendingRemoveIndex = index;
            confirmMessage.textContent = `Remove Error ${err.number}?`;
            confirmPopup.style.display = 'block';
        });

        errorsContainer.appendChild(errorDiv);
    });
}

// --------------------------- LOAD ---------------------------
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
            screenshot: (Array.isArray(err.screenshot)
                ? err.screenshot
                : (err.screenshot || "").split(',')
            ).map(fixBase64)
        }));

        renderErrors();

    } catch (err) {
        console.error("Fetch error:", err);
    }
}

// --------------------------- ADD ERROR ---------------------------
addErrorBtn.addEventListener('click', async () => {

    const qaName = qaNameInput.value.trim();
    const errorText = errorInput.value.trim();
    const jid = jidInput.value.trim();
    const screenshots = getPastedScreenshots();

    if (!qaName || !errorText || !jid || screenshots.length === 0) {
        alert("Fill all fields + paste screenshot");
        return;
    }

    const payload = {
        number: errors.length + 1,
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
        }

    } catch (err) {
        console.error(err);
    }
});

// --------------------------- REMOVE ---------------------------
function confirmRemove() {
    if (pendingRemoveIndex === 'all') {
        errors = [];
    } else {
        errors.splice(pendingRemoveIndex, 1);
    }

    renderErrors();
    pendingRemoveIndex = null;
    confirmPopup.style.display = 'none';
}

function cancelRemove() {
    confirmPopup.style.display = 'none';
}

removeAllBtn.addEventListener('click', () => {
    pendingRemoveIndex = 'all';
    confirmMessage.textContent = "Remove all errors?";
    confirmPopup.style.display = 'block';
});

confirmBtn.addEventListener('click', confirmRemove);

// --------------------------- PDF ---------------------------
function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const docName = documentNameInput.value || "QC Feedback";

    errors.forEach((err, index) => {

        if (index !== 0) doc.addPage();

        let y = 20;

        doc.text(docName, 105, y, { align: 'center' });
        y += 10;

        doc.text(`Total errors: ${errors.length}`, 105, y, { align: 'center' });
        y += 15;

        doc.text(`Error ${err.number}: ${err.error}`, 10, y);
        y += 10;
        doc.text(`JID: ${err.jid}`, 10, y);
        y += 10;

        err.screenshot.forEach(s => {
            try {
                doc.addImage(fixBase64(s), 'PNG', 30, y, 150, 0);
                y += 60;
            } catch {}
        });
    });

    return doc;
}

// --------------------------- DOWNLOAD ---------------------------
downloadPDFBtn.addEventListener('click', () => {
    if (errors.length === 0) return alert("No errors");

    const fileName = getSafeFileName();
    generatePDF().save(fileName + ".pdf");
});

// --------------------------- EMAIL ---------------------------
sendEmailBtn.addEventListener('click', async () => {

    const emailTo = document.getElementById('emailTo').value.trim();
    const subject = document.getElementById('emailSubject').value || "QC Feedback";
    const body = document.getElementById('emailBody').value || "Please find attached feedback.";

    if (!emailTo) return alert("Enter email");

    try {
        const pdfBase64 = generatePDF().output('datauristring');
        const fileName = getSafeFileName();

        const res = await fetch(EMAIL_API_URL, {
            method: "POST",
            body: JSON.stringify({
                action: "sendEmail",
                emailTo,
                subject,
                body,
                attachment: pdfBase64,
                fileName: fileName + ".pdf"
            })
        });

        const result = await res.text();
        alert(result);

    } catch (err) {
        console.error(err);
        alert("Email failed");
    }
});

// --------------------------- PASTE ---------------------------
pasteArea.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;

    for (let item of items) {
        if (item.type.includes("image")) {
            const file = item.getAsFile();
            const reader = new FileReader();

            reader.onload = e => {
                const img = document.createElement('img');
                img.src = e.target.result;
                pasteArea.appendChild(img);
            };

            reader.readAsDataURL(file);
        }
    }
});

// --------------------------- INIT ---------------------------
window.onload = loadErrors;
