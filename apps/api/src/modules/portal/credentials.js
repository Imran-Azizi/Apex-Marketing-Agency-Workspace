import { hashPassword } from "../../utils/passwords.js";
import { encryptCredential } from "../../utils/credentialVault.js";

/**
 * bcrypt hash for login + AES-GCM copy for authorized manager recovery.
 * Login must still succeed if recoverable storage fails.
 */
export async function buildPortalPasswordRecord(password) {
  const passwordHash = await hashPassword(password);
  let passwordCipher = null;
  try {
    passwordCipher = encryptCredential(password);
  } catch {
    passwordCipher = null;
  }
  return { passwordHash, passwordCipher };
}
