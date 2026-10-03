/**
 * SMTP email helper for backup delivery.
 * Configure via SMTP_* / MAIL_* env vars. No-ops with a clear error when unset.
 */
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { AppError } from '../utils/response.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
    return null;
  }
  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
  return transporter;
}

export function isEmailConfigured() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass && env.mailFrom);
}

/**
 * @param {{
 *   to: string;
 *   subject: string;
 *   text: string;
 *   html?: string;
 *   attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
 * }} opts
 */
export async function sendMail(opts) {
  const tx = getTransporter();
  if (!tx) {
    throw new AppError(
      'سرویس ایمیل پیکربندی نشده است. متغیرهای SMTP را تنظیم کنید.',
      503,
      'EMAIL_NOT_CONFIGURED',
    );
  }
  if (!opts?.to) {
    throw new AppError('آدرس ایمیل گیرنده الزامی است', 400, 'EMAIL_TO_REQUIRED');
  }

  try {
    const info = await tx.sendMail({
      from: env.mailFrom,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      attachments: opts.attachments,
    });
    return info;
  } catch (err) {
    const raw = String(err?.message || err || '');
    const isAuth =
      /535|BadCredentials|Username and Password not accepted|Invalid login/i.test(
        raw,
      );
    if (isAuth) {
      // Drop cached transporter so the next attempt reloads env after a fix.
      transporter = null;
      throw new AppError(
        'ورود SMTP رد شد (نام کاربری/رمز اشتباه). برای Gmail باید App Password استفاده کنید، نه رمز عادی حساب.',
        502,
        'EMAIL_AUTH_FAILED',
      );
    }
    throw err;
  }
}
