/**
 * Meta WhatsApp Cloud API — webhook verification, signature check, payload parse.
 * Credentials stay server-side only (env).
 */

import crypto from "crypto";
import { env } from "../../config/env.js";

/** Prefixed into public wa.me CTA text so inbound messages can be attributed. */
export const WHATSAPP_WEBSITE_SOURCE_MARKER = "[apex_src:website]";

export const WHATSAPP_INBOUND_STATUS = Object.freeze({
  RECEIVED: "RECEIVED",
  PROCESSING: "PROCESSING",
  PROCESSED: "PROCESSED",
  DUPLICATE: "DUPLICATE",
  FAILED: "FAILED",
  IGNORED: "IGNORED",
});

export function isWhatsAppWebhookConfigured() {
  return Boolean(
    String(env.whatsappWebhookVerifyToken || "").trim() &&
      String(env.whatsappAppSecret || "").trim(),
  );
}

/**
 * Meta hub challenge for GET /webhooks/whatsapp.
 * @returns {string|null} challenge to echo, or null if unauthorized
 */
export function verifyMetaSubscribeChallenge(query = {}) {
  const mode = String(query["hub.mode"] || "").trim();
  const token = String(query["hub.verify_token"] || "").trim();
  const challenge = String(query["hub.challenge"] || "");
  const expected = String(env.whatsappWebhookVerifyToken || "").trim();
  if (!expected || mode !== "subscribe" || !token || token !== expected) {
    return null;
  }
  return challenge;
}

/**
 * Validate X-Hub-Signature-256 against the raw request body.
 */
export function verifyHmacSha256(rawBody, signatureHeader, secret) {
  const key = String(secret || "").trim();
  if (!key) return false;
  const header = String(signatureHeader || "").trim();
  const match = /^sha256=(.+)$/i.exec(header);
  if (!match) return false;
  const expectedHex = match[1].trim().toLowerCase();
  const body =
    Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(String(rawBody || ""), "utf8");
  const digest = crypto
    .createHmac("sha256", key)
    .update(body)
    .digest("hex");
  try {
    const a = Buffer.from(digest, "hex");
    const b = Buffer.from(expectedHex, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyMetaSignature(rawBody, signatureHeader) {
  return verifyHmacSha256(
    rawBody,
    signatureHeader,
    env.whatsappAppSecret,
  );
}

export function detectWebsiteSourceFromText(text) {
  const body = String(text || "");
  return body.includes(WHATSAPP_WEBSITE_SOURCE_MARKER);
}

export function resolveInboundLeadSource(text, { forceWebsite } = {}) {
  if (forceWebsite || detectWebsiteSourceFromText(text)) {
    return "WHATSAPP_WEBSITE";
  }
  return "WHATSAPP";
}

function truncatePreview(text, max = 280) {
  const t = String(text || "").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function messageTextBody(message) {
  if (!message || typeof message !== "object") return "";
  const type = String(message.type || "");
  if (type === "text") return String(message.text?.body || "");
  if (type === "button") return String(message.button?.text || "");
  if (type === "interactive") {
    return (
      String(message.interactive?.button_reply?.title || "") ||
      String(message.interactive?.list_reply?.title || "")
    );
  }
  // Non-text first touch still creates a lead; no invented content.
  return "";
}

/**
 * Flatten Meta Cloud API webhook payload into processable inbound messages.
 * Ignores statuses, echoes, and non-message fields.
 */
export function extractInboundMessages(payload) {
  const out = [];
  if (!payload || payload.object !== "whatsapp_business_account") {
    return out;
  }
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      if (change?.field && change.field !== "messages") continue;
      const value = change?.value;
      if (!value || typeof value !== "object") continue;
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const contactByWa = new Map(
        contacts
          .filter((c) => c?.wa_id)
          .map((c) => [String(c.wa_id), c]),
      );
      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const message of messages) {
        const id = String(message?.id || "").trim();
        const from = String(message?.from || "").trim();
        if (!id || !from) continue;
        const contact = contactByWa.get(from);
        const displayName = String(
          contact?.profile?.name || message?.profile?.name || "",
        ).trim();
        const text = messageTextBody(message);
        out.push({
          providerMsgId: id,
          fromWaId: from,
          displayName: displayName || null,
          text,
          textPreview: truncatePreview(text),
          timestamp: message.timestamp
            ? String(message.timestamp)
            : null,
          type: String(message.type || "unknown"),
          phoneNumberId: value.metadata?.phone_number_id
            ? String(value.metadata.phone_number_id)
            : null,
        });
      }
    }
  }
  return out;
}
