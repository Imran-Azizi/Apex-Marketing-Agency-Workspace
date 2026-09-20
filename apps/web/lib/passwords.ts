import { z } from "zod";

/** Matches apps/api/src/utils/passwords.js strong-password policy. */
export const PASSWORD_POLICY_MESSAGE =
  "رمز عبور باید حداقل ۸ کاراکتر و شامل حرف و عدد باشد";

export const PASSWORD_POLICY_HINT =
  "حداقل ۸ کاراکتر — باید هم حرف و هم عدد داشته باشد";

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

export function isStrongPassword(password: string | undefined | null): boolean {
  const value = String(password || "");
  if (value.length < MIN_LENGTH || value.length > MAX_LENGTH) return false;
  if (/\s/.test(value)) return false;
  const hasLetter = /[A-Za-z\u0600-\u06FF]/.test(value);
  const hasDigit = /\d/.test(value);
  return hasLetter && hasDigit;
}

export function strongPasswordSchema(
  message: string = PASSWORD_POLICY_MESSAGE,
) {
  return z
    .string()
    .min(MIN_LENGTH, message)
    .max(MAX_LENGTH, message)
    .refine((value) => isStrongPassword(value), message);
}
