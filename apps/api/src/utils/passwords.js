import bcrypt from "bcryptjs";
import { z } from "zod";
import { SECURITY } from "../config/security.js";

const ROUNDS = 12;

export async function hashPassword(password) {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

const PASSWORD_POLICY_MESSAGE =
  "رمز عبور باید حداقل ۸ کاراکتر و شامل حرف و عدد باشد";

export function isStrongPassword(password) {
  const value = String(password || "");
  if (value.length < SECURITY.password.minLength) return false;
  if (value.length > SECURITY.password.maxLength) return false;
  if (/\s/.test(value)) return false;
  const hasLetter = /[A-Za-z\u0600-\u06FF]/.test(value);
  const hasDigit = /\d/.test(value);
  return hasLetter && hasDigit;
}

/** Zod schema for create / reset / register (not login). */
export function strongPasswordSchema(message = PASSWORD_POLICY_MESSAGE) {
  return z
    .string()
    .min(SECURITY.password.minLength, message)
    .max(SECURITY.password.maxLength, message)
    .refine((value) => isStrongPassword(value), message);
}
