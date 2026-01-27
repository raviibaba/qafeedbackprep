let errorCount = 0;
let errors = [];
let pastedImages = [];

const pasteArea = document.getElementById("pasteArea");
const suggestionBox = document.getElementById("grammarSuggestion");

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

function addError() {
  const errorText = document.getElementById("errorText").value;
  const jid = document.getElementById("jid").value;

  if (!errorText || !jid || pastedImages.length === 0) {
    alert("Error, JID and screenshots are required");
    return;
  }

  errorCount++;

  const errorData = {
    number: errorCount,
    errorText,
    jid,
    images: [...pastedImages]
  };

  errors.push(errorData);

  const div = document.createElement("div");
  div.className = "error-card";
  div.innerHTML = `
    <strong>Error ${errorCount}: ${errorText}</strong><br>
    JID: ${jid}<br>
    ${errorData.images.map(img => `<img src="${img}">`).join("")}
  `;

  document.getElementById("errorList").appendChild(div);

  pastedImages = [];
  pasteArea.innerHTML = "Paste screenshots here (Ctrl + V)";
  document.getElementById("errorText").value = "";
  document.getElementById("jid").value = "";
  suggestionBox.innerText = "";
}

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
