import net from "net";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.google.com",
  "instance-data",
]);

function isPrivateIpv4(ip) {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isBlockedHost(hostname) {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    return true;
  }
  if (host === "::1" || host === "[::1]") return true;
  if (net.isIP(host) === 4 && isPrivateIpv4(host)) return true;
  if (net.isIP(host) === 6) {
    const n = host.toLowerCase();
    if (n === "::1" || n.startsWith("fc") || n.startsWith("fd") || n.startsWith("fe80")) {
      return true;
    }
    if (n.startsWith("::ffff:")) {
      const v4 = n.slice("::ffff:".length);
      if (isPrivateIpv4(v4)) return true;
    }
  }
  return false;
}

/**
 * Reject URLs that could target loopback, RFC1918, or cloud metadata.
 * @param {unknown} raw
 * @returns {string} normalized href
 */
export function assertSafeExternalUrl(raw) {
  let parsed;
  try {
    parsed = new URL(String(raw || ""));
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("URL protocol not allowed");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URL credentials not allowed");
  }
  if (isBlockedHost(parsed.hostname)) {
    throw new Error("URL host not allowed");
  }
  return parsed.href;
}

export function isSafeExternalUrl(raw) {
  try {
    assertSafeExternalUrl(raw);
    return true;
  } catch {
    return false;
  }
}
