import nodemailer from "nodemailer";

export async function sendVerificationEmail(
  toEmail: string,
  code: string,
): Promise<{ success: boolean; devPreview?: string }> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || '"Compiler Companion" <security@compiler.local>';

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Verification Code</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0c0f17;
      color: #e2e8f0;
      margin: 0;
      padding: 24px;
    }
    .email-container {
      max-width: 520px;
      margin: 0 auto;
      background: #151a26;
      border: 1px solid #273147;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      padding: 30px;
      text-align: center;
      border-bottom: 1px solid #273147;
    }
    .logo {
      font-size: 26px;
      font-weight: 700;
      color: #60a5fa;
      letter-spacing: -0.5px;
    }
    .content {
      padding: 36px 30px;
      text-align: center;
    }
    h2 {
      margin-top: 0;
      color: #f8fafc;
      font-size: 20px;
    }
    p {
      color: #94a3b8;
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .code-box {
      display: inline-block;
      letter-spacing: 8px;
      font-size: 36px;
      font-weight: 800;
      color: #38bdf8;
      background: #090d16;
      border: 1px dashed #38bdf8;
      padding: 16px 32px;
      border-radius: 10px;
      margin: 12px 0 24px;
      font-family: 'Courier New', Courier, monospace;
    }
    .notice {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 8px;
      padding: 12px;
      color: #fca5a5;
      font-size: 13px;
      text-align: left;
      margin-top: 20px;
    }
    .footer {
      background: #0d111a;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #1e293b;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="logo">◈ Compiler Companion</div>
    </div>
    <div class="content">
      <h2>Password Reset Request</h2>
      <p>We received a request to reset the password for your account (<strong>${toEmail}</strong>).</p>
      <p>Use the 6-digit verification code below to complete the reset:</p>
      <div class="code-box">${code}</div>
      <p style="font-size: 13px; color: #64748b;">This code is valid for <strong>10 minutes</strong>.</p>
      <div class="notice">
        🔒 <strong>Security Warning:</strong> Never share this code with anyone. Our team will never ask for this code. If you did not request this, please disregard this email.
      </div>
    </div>
    <div class="footer">
      Compiler Companion Coding Studio &copy; 2026. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

  // If SMTP is fully configured in .env, send real email via nodemailer
  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });

      await transporter.sendMail({
        from,
        to: toEmail,
        subject: `${code} is your Compiler Companion verification code`,
        text: `Your Compiler Companion verification code is: ${code}. It expires in 10 minutes.`,
        html: htmlContent,
      });

      console.info(`[Email Service] Verification email dispatched to ${toEmail}`);
      return { success: true };
    } catch (error) {
      console.error("[Email Service] Failed to send via SMTP:", error);
      // Fall through to console preview if SMTP failed
    }
  }

  // If SMTP is not yet configured or failed, output code clearly to console for local development
  console.info(`
========================================================================
[SECURITY EMAIL SERVICE] Password Reset Verification
Recipient: ${toEmail}
Verification Code: >>> ${code} <<<
Expires in: 10 minutes
(To send real emails to your inbox, configure SMTP_HOST, SMTP_USER, SMTP_PASS in .env)
========================================================================
  `);

  return { success: true, devPreview: code };
}
