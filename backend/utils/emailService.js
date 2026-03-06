import nodemailer from "nodemailer";

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD, // Use App Password for Gmail
    },
  });
};

// Send email function
export const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: {
        name: process.env.EMAIL_FROM_NAME,
        address: process.env.EMAIL_USER,
      },
      to,
      subject,
      html,
      text: text || "", // Plain text version (optional)
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Email sending error:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

// Send bulk emails
export const sendBulkEmails = async (emails) => {
  try {
    const transporter = createTransporter();
    const results = [];

    for (const email of emails) {
      try {
        const info = await transporter.sendMail({
          from: {
            name: process.env.EMAIL_FROM_NAME || "Your Company",
            address: process.env.EMAIL_USER,
          },
          to: email.to,
          subject: email.subject,
          html: email.html,
          text: email.text || "",
        });

        results.push({
          to: email.to,
          success: true,
          messageId: info.messageId,
        });
      } catch (error) {
        results.push({
          to: email.to,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Bulk email sending error:", error);
    throw new Error(`Failed to send bulk emails: ${error.message}`);
  }
};

// Verify email configuration
export const verifyEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log("Email service is ready");
    return true;
  } catch (error) {
    console.error("Email configuration error:", error);
    return false;
  }
};
