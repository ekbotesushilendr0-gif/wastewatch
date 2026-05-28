const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function generateCertificate(data) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Load signature image as base64 if it exists
    const sigPath = path.join(__dirname, '..', 'uploads', 'signature.png');
    let sigHtml = '';
    if (fs.existsSync(sigPath)) {
      const sigData = fs.readFileSync(sigPath).toString('base64');
      sigHtml = `<img src="data:image/png;base64,${sigData}" style="max-height: 80px; margin-bottom: -20px;" />`;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,700;1,300&family=Open+Sans:wght@400;600;700&display=swap');
          
          body {
            font-family: 'Open Sans', sans-serif;
            margin: 0;
            padding: 0;
            background: white;
            color: #333;
          }
          .certificate {
            width: 794px; /* A4 width */
            height: 1122px; /* A4 height */
            box-sizing: border-box;
            padding: 60px;
            position: relative;
          }
          .header-bar {
            background-color: #1a5c33;
            height: 12px;
            width: 100%;
            margin-bottom: 50px;
          }
          .footer-bar {
            background-color: #1a5c33;
            height: 12px;
            width: 100%;
            position: absolute;
            bottom: 60px;
            left: 60px;
            width: calc(100% - 120px);
          }
          .subtitle {
            color: #1a5c33;
            font-weight: 700;
            font-size: 14px;
            letter-spacing: 1.5px;
            text-align: center;
            margin-bottom: 20px;
          }
          .divider-gold {
            border-top: 1px solid #d4a574;
            margin: 20px 0;
          }
          .title {
            color: #1a5c33;
            font-family: 'Merriweather', serif;
            font-weight: 700;
            font-size: 38px;
            text-align: center;
            margin: 20px 0;
          }
          .presented-to {
            font-family: 'Merriweather', serif;
            font-style: italic;
            font-size: 16px;
            color: #555;
            text-align: center;
            margin-top: 40px;
            margin-bottom: 15px;
          }
          .name {
            color: #1a5c33;
            font-family: 'Merriweather', serif;
            font-weight: 700;
            font-size: 38px;
            text-align: center;
            margin-bottom: 30px;
          }
          .paragraph {
            text-align: center;
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 30px;
          }
          .details-box {
            margin-top: 30px;
            width: 100%;
          }
          .details-header {
            color: #1a5c33;
            font-weight: 700;
            font-size: 16px;
            text-decoration: underline;
            margin-bottom: 15px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          td {
            padding: 8px 12px;
            font-size: 13px;
          }
          tr:nth-child(odd) {
            background-color: #f0f7f2;
          }
          .td-label {
            width: 30%;
            color: #555;
          }
          .td-value {
            font-weight: 700;
            color: #1a5c33;
          }
          .appreciation-message {
            text-align: center;
            font-family: 'Merriweather', serif;
            font-style: italic;
            font-weight: 700;
            color: #1a5c33;
            font-size: 16px;
            margin-top: 40px;
            padding: 15px;
            background-color: #e6f3eb;
          }
          .signature-section {
            margin-top: 60px;
            text-align: center;
          }
          .signature-line {
            width: 300px;
            border-top: 1px solid #1a5c33;
            margin: 0 auto 10px auto;
          }
          .signature-text {
            font-size: 12px;
            color: #555;
          }
          .signature-title {
            font-weight: 700;
            color: #1a5c33;
            font-size: 14px;
            margin-top: 5px;
          }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="header-bar"></div>
          
          <div class="subtitle">WASTE MANAGEMENT SYSTEM ADMINISTRATION ♻️ 🌿</div>
          
          <div class="divider-gold"></div>
          <div class="title">CERTIFICATE OF APPRECIATION</div>
          <div class="divider-gold"></div>
          
          <div class="presented-to">This certificate is proudly presented to</div>
          <div class="name">${data['user.name'] || 'Community Member'}</div>
          
          <div class="divider-gold"></div>
          
          <div class="paragraph">
            for actively contributing to the <strong>Community Waste Reporting and Management System</strong> by<br/>
            reporting a waste-related issue that was <strong>successfully resolved</strong>.<br/>
            <span style="font-family: 'Merriweather', serif; font-style: italic; color: #666;">Your responsible action has helped improve cleanliness, hygiene, and environmental sustainability<br/>in the community.</span>
          </div>
          
          <div class="details-box">
            <div class="details-header">Complaint Details</div>
            <table>
              <tr><td class="td-label">Complaint ID</td><td class="td-value">${data['complaint.id']}</td></tr>
              <tr><td class="td-label">Problem Type</td><td class="td-value">${data['complaint.type']}</td></tr>
              <tr><td class="td-label">Location</td><td class="td-value">${data['complaint.location']}</td></tr>
              <tr><td class="td-label">Reported Date</td><td class="td-value">${data['complaint.reportedDate']}</td></tr>
              <tr><td class="td-label">Resolved Date</td><td class="td-value">${data['complaint.resolvedDate']}</td></tr>
              <tr><td class="td-label">Resolution Status</td><td class="td-value">Successfully Resolved</td></tr>
            </table>
          </div>
          
          <div class="appreciation-message">
            We sincerely appreciate your valuable contribution toward building a cleaner<br/>and smarter city.
          </div>
          
          <div class="divider-gold" style="margin-top: 40px;"></div>
          
          <div class="signature-section">
            ${sigHtml}
            <div class="signature-line"></div>
            <div class="signature-text"><i>Authorized Signature</i></div>
            <div class="signature-title">Waste Management System Administration</div>
            <div class="signature-text" style="margin-top: 5px;">Date: ${data['currentDate']}</div>
          </div>
          
          <div class="footer-bar"></div>
        </div>
      </body>
      </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfUint8Array = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    
    await browser.close();
    return Buffer.from(pdfUint8Array).toString('base64');
  } catch (error) {
    if (browser) await browser.close();
    throw error;
  }
}

module.exports = { generateCertificate };
