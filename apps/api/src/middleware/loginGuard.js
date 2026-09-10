import { SECURITY } from "../config/security.js";
import { AppError } from "../utils/response.js";

/** In-memory account/IP lockout. Same deployment model as express-rate-limit. */
const failures = new Map();

function prune(now) {
  if (failures.size < 2000) return;
  for (const [key, rec] of failures) {
    if (rec.lockedUntil && rec.lockedUntil < now) failures.delete(key);
    else if (!rec.lockedUntil && now - rec.firstAt > SECURITY.loginGuard.windowMs) {
      failures.delete(key);
    }
  }
}

function record(key) {
  return failures.get(key) || null;
}

export function loginAttemptKey({ identity, ip }) {
  const id = String(identity || "")
    .trim()
    .toLowerCase()
    .slice(0, 180);
  const addr = String(ip || "unknown").slice(0, 80);
  return `${addr}|${id}`;
}

export function assertLoginNotLocked(key) {
  prune(Date.now());
  const rec = record(key);
  if (rec?.lockedUntil && rec.lockedUntil > Date.now()) {
    throw new AppError(
      "تعداد تلاش‌های ورود زیاد است. لطفاً کمی بعد دوباره تلاش کنید.",
      429,
      "RATE_LIMITED",
    );
  }
}

export function recordLoginFailure(key) {
  const now = Date.now();
  prune(now);
  const rec = record(key);
  if (!rec || now - rec.firstAt > SECURITY.loginGuard.windowMs) {
    failures.set(key, { count: 1, firstAt: now, lockedUntil: 0 });
    return;
  }
  rec.count += 1;
  if (rec.count >= SECURITY.loginGuard.maxFailures) {
    rec.lockedUntil = now + SECURITY.loginGuard.lockMs;
  }
}

export function clearLoginFailures(key) {
  failures.delete(key);
}

/** Test helper */
export function _resetLoginGuardForTests() {
  failures.clear();
}
