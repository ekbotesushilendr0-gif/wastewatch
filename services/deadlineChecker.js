const cron = require("node-cron");
const SibApiV3Sdk = require("sib-api-v3-sdk");
const mongoose = require("mongoose");
const { generateCertificate } = require("./certificateGenerator");
// Configure Brevo email client
const brevoClient = SibApiV3Sdk.ApiClient.instance;
brevoClient.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

/**
 * Send escalation email to admin
 */
async function sendAdminEscalationMail(complaint) {
  try {
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    const adminEmail = process.env.ADMIN_EMAIL || "admin@wastewatch.local";

    const sendSmtpEmail = {
      sender: { name: "WasteWatch Escalation", email: "ekbotesushilendr0@gmail.com" },
      to: [{ email: adminEmail }],
      subject: `⚠️ URGENT: Complaint Deadline Exceeded - ID: ${complaint._id}`,
      htmlContent: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#fff5f5;border-radius:12px;border-left:4px solid #e53e3e;">
          <h2 style="color:#c53030;margin:0 0 16px 0;">⚠️ Complaint Escalation Alert</h2>
          <p style="color:#5a5a5a;margin:0 0 24px 0;font-size:1rem;">This is an automated notification from WasteWatch regarding a complaint that has exceeded the assigned resolution deadline.</p>
          
          <div style="background:#fff;border:1px solid #e53e3e;border-radius:8px;padding:20px;margin:24px 0;">
            <h3 style="color:#c53030;margin:0 0 12px 0;font-size:1rem;">Complaint Details:</h3>
            <table style="width:100%;font-size:0.95rem;">
              <tr>
                <td style="color:#666;padding:8px 0;"><strong>Complaint ID:</strong></td>
                <td style="color:#333;padding:8px 0;">${complaint._id}</td>
              </tr>
              <tr>
                <td style="color:#666;padding:8px 0;"><strong>Category:</strong></td>
                <td style="color:#333;padding:8px 0;">${complaint.category}</td>
              </tr>
              <tr>
                <td style="color:#666;padding:8px 0;"><strong>Location:</strong></td>
                <td style="color:#333;padding:8px 0;">${complaint.location}</td>
              </tr>
              <tr>
                <td style="color:#666;padding:8px 0;"><strong>Current Status:</strong></td>
                <td style="color:#c53030;padding:8px 0;"><strong>${complaint.status}</strong></td>
              </tr>
              <tr>
                <td style="color:#666;padding:8px 0;"><strong>Reported At:</strong></td>
                <td style="color:#333;padding:8px 0;">${new Date(complaint.createdAt).toLocaleString()}</td>
              </tr>
              <tr>
                <td style="color:#666;padding:8px 0;"><strong>Reported By:</strong></td>
                <td style="color:#333;padding:8px 0;">${complaint.userEmail}</td>
              </tr>
            </table>
          </div>

          <div style="background:#fffaf0;border:1px solid #f6ad55;border-radius:8px;padding:16px;margin:24px 0;">
            <p style="color:#5a5a5a;margin:0;font-size:0.95rem;"><strong>Action Required:</strong> The complaint has now been marked as "Escalated" and requires immediate administrative attention. Please review and take necessary action to ensure timely resolution.</p>
          </div>

          <p style="color:#5a5a5a;margin:24px 0 0 0;font-size:0.85rem;border-top:1px solid #e53e3e;padding-top:16px;">
            This is an automated message from WasteWatch Automated Escalation System. Do not reply to this email.
          </p>
        </div>
      `,
    };

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ Admin escalation mail sent for complaint ${complaint._id}`);
  } catch (error) {
    console.error(`❌ Failed to send admin escalation mail: ${error.message}`);
  }
}

/**
 * Send escalation email to user
 */
async function sendUserEscalationMail(complaint) {
  try {
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    const sendSmtpEmail = {
      sender: { name: "WasteWatch Support", email: "ekbotesushilendr0@gmail.com" },
      to: [{ email: complaint.userEmail }],
      subject: `Update: Your Complaint Status - Under Review`,
      htmlContent: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f4f7f4;border-radius:12px;">
          <h2 style="color:#1a5c33;margin:0 0 16px 0;">WasteWatch ♻️</h2>
          
          <p style="color:#5a7060;margin:0 0 24px 0;">Dear User,</p>
          
          <p style="color:#5a7060;margin:0 0 16px 0;line-height:1.6;">We would like to inform you that the resolution of your reported waste management complaint is taking longer than expected.</p>
          
          <div style="background:#fff;border-left:4px solid #d4a574;border-radius:6px;padding:20px;margin:24px 0;">
            <p style="color:#333;margin:0 0 12px 0;"><strong>Your Complaint Details:</strong></p>
            <p style="color:#5a7060;margin:8px 0;"><strong>Complaint ID:</strong> ${complaint._id}</p>
            <p style="color:#5a7060;margin:8px 0;"><strong>Category:</strong> ${complaint.category}</p>
            <p style="color:#5a7060;margin:8px 0;"><strong>Location:</strong> ${complaint.location}</p>
            <p style="color:#5a7060;margin:8px 0;"><strong>Current Status:</strong> <strong>${complaint.status}</strong></p>
          </div>

          <p style="color:#5a7060;margin:0 0 16px 0;line-height:1.6;">Your complaint has been escalated to the administrative team for priority review and further action. We sincerely apologize for the delay and appreciate your patience and cooperation. Our team is actively working to resolve the issue as soon as possible.</p>

          <p style="color:#5a7060;margin:24px 0 0 0;line-height:1.6;">
            Thank you for reporting this issue. Your feedback helps us maintain cleaner, healthier communities.
          </p>

          <p style="color:#5a7060;margin:16px 0 0 0;font-size:0.95rem;border-top:1px solid #d4e4d8;padding-top:16px;">
            <strong>Best Regards,</strong><br/>
            WasteWatch Support Team ♻️
          </p>
        </div>
      `,
    };

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ User escalation mail sent to ${complaint.userEmail}`);
  } catch (error) {
    console.error(`❌ Failed to send user escalation mail: ${error.message}`);
  }
}

/**
 * Initialize the deadline checker cron job
 * Runs every 5 minutes to check for overdue complaints
 */
function initializeDeadlineChecker(Complaint) {
  // Run every 5 minutes to check deadlines
  const task = cron.schedule("*/5 * * * *", async () => {
    try {
      const now = new Date();
      
      // Find ALL unresolved complaints to check both timeout and dynamic urgency
      const activeComplaints = await Complaint.find({
        status: { $nin: ["Resolved"] }
      });

      for (const complaint of activeComplaints) {
        try {
          if (!complaint.deadlineAt) continue;

          const timeLeft = complaint.deadlineAt - now;

          if (timeLeft <= 0) {
            // It completely timed out. Trigger escalation and reset cycle to 24 hours.
            await sendAdminEscalationMail(complaint);
            await sendUserEscalationMail(complaint);

            complaint.isEscalated = true;
            complaint.escalationCount = (complaint.escalationCount || 0) + 1;
            complaint.lastEscalatedAt = new Date();
            
            // Reset timer to 24 hours (Low urgency)
            complaint.deadlineAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            complaint.urgency = "Low";
            await complaint.save();
            
            console.log(`🔄 Escalated & Reset complaint ${complaint._id} to Low (24h) (count: ${complaint.escalationCount})`);
          } else {
            // Update urgency dynamically based on time left until absolute deadline
            let newUrgency = "Low";
            if (timeLeft <= 6 * 60 * 60 * 1000) {
              newUrgency = "High";
            } else if (timeLeft <= 12 * 60 * 60 * 1000) {
              newUrgency = "Medium";
            }
            
            if (complaint.urgency !== newUrgency) {
              complaint.urgency = newUrgency;
              await complaint.save();
              console.log(`⬆️ Dynamically updated complaint ${complaint._id} urgency to ${newUrgency}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error processing complaint ${complaint._id}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`❌ Deadline checker job failed: ${error.message}`);
    }
  });

  console.log("✅ Deadline checker cron job initialized (runs every 5 minutes)");
  return task;
}

/**
 * Send resolution completion email to user
 */
async function sendUserResolutionCompleteMail(complaint) {
  try {
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    const formatDate = (date) => {
      if (!date) return "N/A";
      return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const User = mongoose.model('User');
    const userDoc = await User.findById(complaint.userId);
    const userName = (userDoc && userDoc.name) ? userDoc.name : "Community Member";
    const recipientEmail = complaint.userEmail || (userDoc && userDoc.email) ? (complaint.userEmail || userDoc.email) : null;

    if (!recipientEmail) {
      console.error(`❌ Cannot send resolution email to complaint ${complaint._id}: No email address found.`);
      return;
    }

    const pdfBase64 = await generateCertificate({
      "user.name": userName,
      "complaint.id": complaint._id ? complaint._id.toString() : "N/A",
      "complaint.type": complaint.category || "General",
      "complaint.location": complaint.location || "N/A",
      "complaint.reportedDate": formatDate(complaint.createdAt),
      "complaint.resolvedDate": formatDate(new Date()),
      "currentDate": formatDate(new Date())
    });

    const sendSmtpEmail = {
      sender: { name: "WasteWatch Support", email: "ekbotesushilendr0@gmail.com" },
      to: [{ email: recipientEmail }],
      subject: `✅ Your Complaint Has Been Resolved - WasteWatch`,
      htmlContent: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f4f7f4;border-radius:12px;">
          <h2 style="color:#1a5c33;margin:0 0 16px 0;">WasteWatch ♻️</h2>
          
          <div style="background:#e6f7ed;border:2px solid #1a5c33;border-radius:8px;padding:24px;margin:24px 0;text-align:center;">
            <div style="font-size:2.5rem;margin-bottom:12px;">✅</div>
            <h3 style="color:#1a5c33;margin:0 0 8px 0;font-size:1.3rem;">Complaint Resolved!</h3>
            <p style="color:#2d5016;margin:0;">The reported waste management issue has been successfully resolved.</p>
          </div>
          
          <p style="color:#5a7060;margin:0 0 24px 0;line-height:1.6;">Dear User,</p>
          
          <p style="color:#5a7060;margin:0 0 16px 0;line-height:1.6;">We are pleased to inform you that the waste management complaint you reported has been successfully resolved by our municipal team. The area has been cleaned and is now in good condition.</p>
          
          <div style="background:#fff;border-left:4px solid #48bb78;border-radius:6px;padding:20px;margin:24px 0;">
            <p style="color:#333;margin:0 0 12px 0;"><strong>Complaint Summary:</strong></p>
            <p style="color:#5a7060;margin:8px 0;"><strong>Complaint ID:</strong> ${complaint._id}</p>
            <p style="color:#5a7060;margin:8px 0;"><strong>Category:</strong> ${complaint.category}</p>
            <p style="color:#5a7060;margin:8px 0;"><strong>Location:</strong> ${complaint.location}</p>
            <p style="color:#5a7060;margin:8px 0;"><strong>Status:</strong> <strong style="color:#1a5c33;">✅ Resolved</strong></p>
          </div>

          <p style="color:#5a7060;margin:0 0 16px 0;line-height:1.6;">Thank you for bringing this issue to our attention. Your feedback is invaluable in helping us maintain cleaner and healthier communities. We appreciate your cooperation and support.</p>
          <p style="color:#1a5c33;margin:0 0 16px 0;line-height:1.6;"><strong>We have attached a Certificate of Appreciation to this email in recognition of your civic contribution!</strong></p>

          <p style="color:#5a7060;margin:24px 0 0 0;line-height:1.6;">
            <strong>Next Steps:</strong><br/>
            You can view the complete details of this resolved complaint in your WasteWatch profile dashboard.
          </p>

          <p style="color:#5a7060;margin:24px 0 0 0;font-size:0.95rem;border-top:1px solid #d4e4d8;padding-top:16px;">
            <strong>Best Regards,</strong><br/>
            WasteWatch Support Team ♻️
          </p>
        </div>
      `,
      attachment: [
        {
          content: pdfBase64,
          name: "Certificate_of_Appreciation.pdf"
        }
      ]
    };

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ Resolution completion email sent to ${complaint.userEmail}`);
  } catch (error) {
    let errorDetails = error.message;
    if (error.response && error.response.text) {
      errorDetails += ` | ${error.response.text}`;
    }
    console.error(`❌ Failed to send resolution completion email: ${errorDetails}`);
  }
}

module.exports = { initializeDeadlineChecker, sendUserResolutionCompleteMail };
