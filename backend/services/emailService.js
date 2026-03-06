import { sendEmail } from "../config/email.js";

export const sendEmployeeWelcomeEmail = async ({
  email,
  fullName,
  tempPassword,
  roleType,
}) => {
  const loginUrl = `${process.env.FRONTEND_URL}/login`;

  const subject = "Welcome to the Company Platform!";

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; color:#333">
      <h2>Welcome ${fullName} 👋</h2>
      <p>Your account has been created successfully.</p>

      <p><strong>Role:</strong> ${roleType.toUpperCase()}</p>

      <h3>Login Credentials</h3>
      <p>Email: ${email}</p>
      <p>Temporary Password: <code>${tempPassword}</code></p>

      <p>
        <a href="${loginUrl}" style="padding:10px 20px;background:#4CAF50;color:#fff;text-decoration:none">
          Login Now
        </a>
      </p>

      <p><strong>⚠ You must change your password on first login.</strong></p>

      <hr />
      <small>© ${new Date().getFullYear()} Your Company</small>
    </body>
    </html>
  `;

  const text = `
Welcome ${fullName}

Email: ${email}
Temporary Password: ${tempPassword}
Login URL: ${loginUrl}

You must change your password on first login.
`;

  return sendEmail({ to: email, subject, html, text });
};

export const sendPasswordChangedEmail = async (email, fullName) => {
  const subject = "Password Changed Successfully";

  const html = `
    <p>Hi ${fullName},</p>
    <p>Your password has been changed successfully.</p>
    <p>If this was not you, contact IT support immediately.</p>
  `;

  return sendEmail({ to: email, subject, html });
};
