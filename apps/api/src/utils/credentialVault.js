import crypto from "crypto";
import { env } from "../config/env.js";

const VERSION = "v1";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey() {
  return crypto
    .createHash("sha256")
    .update(String(env.portalCredentialSecret || ""), "utf8")
    .digest();
}

/**
 * Encrypt a recoverable portal credential with AES-256-GCM.
 * Returns a versioned blob; never log the plaintext or the blob in audits.
 */
export function encryptCredential(plaintext) {
  if (plaintext == null || plaintext === "") return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plaintext), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, encrypted]);
  return `${VERSION}:${packed.toString("base64url")}`;
}

export function decryptCredential(payload) {
  if (!payload) return null;
  const raw = String(payload);
  const sep = raw.indexOf(":");
  if (sep < 0) return null;
  const version = raw.slice(0, sep);
  const data = raw.slice(sep + 1);
  if (version !== VERSION || !data) return null;

  const buf = Buffer.from(data, "base64url");
  if (buf.length <= IV_LENGTH + TAG_LENGTH) return null;

  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}

export function looksLikeCipher(value) {
  return typeof value === "string" && value.startsWith(`${VERSION}:`);
}
