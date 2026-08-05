/**
 * Parse JWT-style expiry strings (e.g. 15m, 7d) into milliseconds.
 */
export function parseExpiresToMs(expiresIn = "15m") {
  const match = /^(\d+)([smhd])$/.exec(String(expiresIn).trim());
  if (!match) return 15 * 60 * 1000;
  const n = Number(match[1]);
  const unit = match[2];
  const mult =
    unit === "s" ? 1000
      : unit === "m" ? 60 * 1000
        : unit === "h" ? 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;
  return n * mult;
}
