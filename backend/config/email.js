import nodemailer from "nodemailer";

// Create transporter for Gmail
export const transporter = nodemailer.createTransport({
  service: "gmail", // Gmail service
  auth: {
    user: process.env.EMAIL_USER, // your Gmail email
    pass: process.env.EMAIL_PASSWORD, // your Gmail App Password
  },
});

// Verify connection
transporter.verify((error) => {
  if (error) {
    console.error("❌ Email service error:", error);
  } else {
    console.log("✅ Gmail service ready");
  }
});

// Send email helper
export const sendEmail = async ({ to, subject, html, text }) => {
  const info = await transporter.sendMail({
    from: `"${process.env.COMPANY_NAME || "Your Company"}" <${
      process.env.EMAIL_USER
    }>`,
    to,
    subject,
    text,
    html,
  });

  console.log("✅ Email sent:", info.messageId);
  return { success: true, messageId: info.messageId };
};
