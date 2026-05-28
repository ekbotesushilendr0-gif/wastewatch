const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument();
doc.pipe(fs.createWriteStream('test.pdf'));
try {
  doc.text('Testing ♻️ 🌿');
} catch (e) {
  console.log('Error:', e.message);
}
doc.end();
