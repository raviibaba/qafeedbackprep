let errors = [];
let pastedImages = [];
let removeIndex = null; // for popup remove

const pasteArea = document.getElementById("pasteArea");
const suggestionBox = document.getElementById("grammarSuggestion");
const errorListDiv = document.getElementById("errorList");
const confirmPopup = document.getElementById("confirmPopup");
const confirmMessage = document.getElementById("confirmMessage");

// Load saved errors on page load
window.onload = () => {
  const savedErrors = JSON.parse(localStorage.getItem("errors") || "[]");
  errors = savedErrors;
  renderErrors();
};

// Handle paste
pasteArea.addEventListener("paste", e => {
  for (let item of e.clipboardData.items) {
    if (item.type.includes("image")) {
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.onload = ev => {
        pastedImages.push(ev.target.result);
        pasteArea.innerHTML += `<img src="${ev.target.result}">`;
      };
      reader.readAsDataURL(file);
    }
  }
});

// Basic grammar suggestion
document.getElementById("errorText").addEventListener("blur", e => {
  let text = e.target.value.trim();
  if (!text) return;
  let corrected = text.charAt(0).toUpperCase() + text.slice(1);
  if (!corrected.endsWith(".")) corrected += ".";
  if (corrected !== text) {
    suggestionBox.innerText = `Suggested correction: "${corrected}"`;
    e.target.value = corrected;
  }
});

// Add error
function addError() {
  const errorText = document.getElementById("errorText").value;
  const jid = document.getElementById("jid").value;
  if (!errorText || !jid || pastedImages.length === 0) {
    alert("Error, JID and screenshots are required");
    return;
  }

  const errorData = {
    number: errors.length + 1,
    errorText,
    jid,
    images: [...pastedImages]
  };
  errors.push(errorData);
  saveErrors();
  renderErrors();

  // Reset inputs
  pastedImages = [];
  pasteArea.innerHTML = "Paste screenshots here (Ctrl + V)";
  document.getElementById("errorText").value = "";
  document.getElementById("jid").value = "";
  suggestionBox.innerText = "";
}

// Save to localStorage
function saveErrors() {
  localStorage.setItem("errors", JSON.stringify(errors));
}

// Render errors in UI
function renderErrors() {
  errorListDiv.innerHTML = "";
  errors.forEach((err, idx) => {
    const div = document.createElement("div");
    div.className = "error-card";
    div.innerHTML = `
      <strong>Error ${err.number}: ${err.errorText}</strong><br>
      JID: ${err.jid}<br>
      ${err.images.map(img => `<img src="${img}">`).join("")}
      <button class="remove-btn" onclick="promptRemove(${idx})">Remove</button>
    `;
    errorListDiv.appendChild(div);
  });
}

// Remove one error with confirmation
function promptRemove(idx) {
  removeIndex = idx;
  confirmMessage.innerText = `Are you sure you want to remove Error ${errors[idx].number}?`;
  confirmPopup.style.display = "block";
}

// Remove all errors with confirmation
function removeAllErrors() {
  removeIndex = "all";
  confirmMessage.innerText = `Are you sure you want to remove all errors?`;
  confirmPopup.style.display = "block";
}

// Confirm removal
function confirmRemove() {
  if (removeIndex === "all") {
    errors = [];
  } else if (removeIndex !== null) {
    errors.splice(removeIndex, 1);
    // Re-number errors
    errors.forEach((err, i) => err.number = i + 1);
  }
  saveErrors();
  renderErrors();
  confirmPopup.style.display = "none";
  removeIndex = null;
}

// Cancel removal
function cancelRemove() {
  confirmPopup.style.display = "none";
  removeIndex = null;
}

// Download PDF (same as before)
function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "pt");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 120;

  const docName = document.getElementById("docName").value || "QC Feedback Document";

  doc.setFontSize(18);
  doc.text(docName, pageWidth / 2, 40, { align: "center" });
  doc.line(40, 55, pageWidth - 40, 55);
  doc.setFontSize(14);
  doc.text(`Total errors added – ${errors.length}`, pageWidth / 2, 80, { align: "center" });
  doc.line(40, 95, pageWidth - 40, 95);

  errors.forEach(err => {
    doc.setFontSize(14);
    doc.text(`Error ${err.number}: ${err.errorText}`, 40, y);
    y += 22;
    doc.text(`JID: ${err.jid}`, 40, y);
    y += 30;
    err.images.forEach(img => {
      const props = doc.getImageProperties(img);
      let imgW = props.width;
      let imgH = props.height;
      const maxW = pageWidth - 80;
      const maxH = pageHeight - y - 40;
      const scale = Math.min(1, maxW / imgW, maxH / imgH);
      imgW *= scale;
      imgH *= scale;
      const x = (pageWidth - imgW) / 2;
      doc.addImage(img, props.fileType, x, y, imgW, imgH);
      y += imgH + 25;
      if (y > pageHeight - 100) {
        doc.addPage();
        y = 80;
      }
    });
    y += 20;
  });

  doc.save("QC_Feedback.pdf");
}
