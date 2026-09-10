import { z } from "zod";
import { env } from "../../config/env.js";
import { isEmailConfigured } from "../../services/email.js";

const emailSchema = z.string().trim().email();

/** In-process lock so the same backup cannot be emailed twice concurrently. */
const emailInFlight = new Set();

export function normalizeBackupRecipientEmail(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  return parsed.data.toLowerCase();
}

/**
 * Resolve who should receive a newly created backup.
 * Prefer the admin-configured schedule email, then BACKUP_EMAIL_TO.
 * Never trust a client-provided address.
 */
export function resolveBackupRecipientEmail(schedule) {
  const fromSchedule = normalizeBackupRecipientEmail(schedule?.emailTo);
  if (fromSchedule) return fromSchedule;
  if (fromSchedule === null) return null;

  const fromEnv = normalizeBackupRecipientEmail(env.backupEmailTo);
  if (fromEnv) return fromEnv;
  if (fromEnv === null) return null;

  return "";
}

export function backupEmailDeliveryPlan({
  emailTo,
  emailSentAt,
  smtpConfigured = isEmailConfigured(),
}) {
  if (emailSentAt) {
    return { shouldSend: false, reason: "already_sent" };
  }
  const recipient = normalizeBackupRecipientEmail(emailTo);
  if (!recipient) {
    return {
      shouldSend: false,
      reason: emailTo ? "invalid_recipient" : "no_recipient",
      recipient: "",
    };
  }
  if (!smtpConfigured) {
    return {
      shouldSend: false,
      reason: "smtp_not_configured",
      recipient,
    };
  }
  return { shouldSend: true, reason: "ready", recipient };
}

export function safeEmailErrorMessage(err) {
  const message = String(err?.message || err || "ارسال ایمیل ناموفق بود")
    .replace(/\bpass(word)?=\S+/gi, "[redacted]")
    .replace(/\bauth[^,\s]*/gi, "[redacted]")
    .slice(0, 400);
  return message || "ارسال ایمیل ناموفق بود";
}

export async function withBackupEmailLock(backupId, fn) {
  if (!backupId) return fn();
  if (emailInFlight.has(backupId)) {
    return { skipped: true, reason: "in_flight" };
  }
  emailInFlight.add(backupId);
  try {
    return await fn();
  } finally {
    emailInFlight.delete(backupId);
  }
}

export function buildBackupEmailContent({
  fileName,
  backupId,
  type,
  sizeLabel,
  createdAt,
  attached,
  oversizedNote = "",
}) {
  const when = createdAt instanceof Date ? createdAt : new Date(createdAt || Date.now());
  const typeLabel = type === "AUTOMATIC" ? "Automatic" : "Manual";
  const subject = `System Backup – ${when.toISOString().replace("T", " ").slice(0, 19)} UTC`;
  const text = [
    "APEX SYSTEM backup notification",
    "",
    `Application: APEX SYSTEM`,
    `Backup ID: ${backupId}`,
    `Backup type: ${typeLabel}`,
    `File name: ${fileName}`,
    `File size: ${sizeLabel}`,
    `Created at: ${when.toISOString()}`,
    attached
      ? "The backup archive is attached to this email."
      : oversizedNote ||
        "The backup archive could not be attached; download it from the Backup & Restore page.",
  ].join("\n");

  const html = `<div style="font-family:Segoe UI,Tahoma,sans-serif;line-height:1.5">
  <h2 style="margin:0 0 12px">APEX SYSTEM Backup</h2>
  <p>A new system backup was created successfully.</p>
  <ul>
    <li><strong>Application:</strong> APEX SYSTEM</li>
    <li><strong>Backup ID:</strong> <code>${backupId}</code></li>
    <li><strong>Backup type:</strong> ${typeLabel}</li>
    <li><strong>File name:</strong> ${fileName}</li>
    <li><strong>File size:</strong> ${sizeLabel}</li>
    <li><strong>Created at:</strong> ${when.toISOString()}</li>
  </ul>
  <p>${
    attached
      ? "The backup archive is attached to this email."
      : oversizedNote ||
        "The backup archive could not be attached; download it from the Backup &amp; Restore page."
  }</p>
</div>`;

  return { subject, text, html };
}
