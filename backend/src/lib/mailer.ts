import nodemailer from 'nodemailer';

const {
  SMTP_HOST,
  SMTP_PORT = '2525',
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM = 'no-reply@example.com',
  APP_URL = 'http://localhost:5173',
} = process.env;

// Create a reusable transporter. Works with Mailtrap, Gmail (app password), etc.
export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
});


// Optional: verify connection at boot (call once in server startup if you like)
// await transporter.verify().catch(console.error);

function inviteHtml(loginEmail: string, tempPassword: string) {
  return `
  <div style="font-family:system-ui,Segoe UI,Arial;line-height:1.6;color:#111">
    <h2 style="margin:0 0 12px">Your account is ready</h2>
    <p>Welcome! We've created your account. Use the details below to sign in:</p>
    <p style="padding:12px 16px;background:#f6f6f6;border-radius:8px">
      <strong>Login email:</strong> ${loginEmail}<br/>
      <strong>Temporary password:</strong> ${tempPassword}
    </p>
    <p>Please sign in and change your password immediately.</p>
    <p>
      <a href="${APP_URL}" style="display:inline-block;padding:10px 16px;border-radius:8px;
         background:#111;color:#fff;text-decoration:none">Open the app</a>
    </p>
    <p style="font-size:12px;color:#666">If you didn’t expect this email, you can ignore it.</p>
  </div>`;
}

function inviteText(loginEmail: string, tempPassword: string) {
  return `Your account is ready.

Login email: ${loginEmail}
Temporary password: ${tempPassword}

Open the app: ${APP_URL}
Please sign in and change your password immediately.`;
}

/**
 * Send the initial invite email with a temporary password.
 */
export async function sendInviteEmail(to: string, loginEmail: string, tempPassword: string) {
  await transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject: 'Your account is ready',
    html: inviteHtml(loginEmail, tempPassword),
    text: inviteText(loginEmail, tempPassword),
  });
}

/**
 * (Optional) Send a “password reset required” nudge/reminder.
 */
export async function sendResetReminder(to: string) {
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">Action needed: change your password</h2>
      <p>For security, please change your temporary password the next time you sign in.</p>
      <p><a href="${APP_URL}" style="display:inline-block;padding:10px 16px;border-radius:8px;
         background:#111;color:#fff;text-decoration:none">Open the app</a></p>
    </div>`;
  const text = `Please change your temporary password next time you sign in.\n${APP_URL}`;
  await transporter.sendMail({ from: MAIL_FROM, to, subject: 'Please change your password', html, text });
}
