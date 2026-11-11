import nodemailer, { type Transporter } from 'nodemailer';
import { config } from './config';

let transport: Transporter | null = null;

function getTransport(): Transporter | null {
  if (!config.SMTP_URL) return null;
  if (!transport) transport = nodemailer.createTransport(config.SMTP_URL);
  return transport;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export async function sendLoginCode(email: string, code: string): Promise<void> {
  const t = getTransport();
  if (!t) {
    // Development only (production refuses to start without SMTP_URL).
    console.log(`[dev-mail] sign-in code for ${email}: ${code}`);
    return;
  }
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  await t.sendMail({
    from: config.EMAIL_FROM,
    to: email,
    subject: `${spaced} is your EyeShots sign-in code`,
    text: `Your EyeShots sign-in code is ${spaced}.\n\nIt expires in 10 minutes. If you didn't request it, you can ignore this email.\n\n${config.APP_URL}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:24px;color:#0f172a">
  <h1 style="font-size:18px;margin:0 0 16px">Your EyeShots sign-in code</h1>
  <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:0 0 16px;font-family:ui-monospace,monospace">${escapeHtml(spaced)}</p>
  <p style="font-size:14px;color:#475569">It expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
  <p style="font-size:12px;color:#94a3b8;margin-top:24px">${escapeHtml(config.APP_URL)}</p></div>`,
  });
}
