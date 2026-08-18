import dns from "dns";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { startBackupScheduler } from "./services/backupScheduler.js";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  /* Node < 17 */
}

/**
 * Transient outbound network failures (Cloudinary/undici HTTP/2 resets, etc.)
 * must not tear down the whole API process.
 */
function isTransientNetworkError(err) {
  if (!err || typeof err !== "object") return false;
  const code = String(err.code || err.cause?.code || "");
  const name = String(err.name || "");
  const message = String(err.message || err.cause?.message || "");
  const transientCodes = new Set([
    "ECONNRESET",
    "ECONNREFUSED",
    "ECONNABORTED",
    "EPIPE",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EAI_AGAIN",
    "UND_ERR_SOCKET",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_HEADERS_TIMEOUT",
    "UND_ERR_BODY_TIMEOUT",
    "UND_ERR_ABORTED",
  ]);
  if (transientCodes.has(code)) return true;
  if (name === "AbortError") return true;
  if (/^terminated$/i.test(message)) return true;
  if (/ECONNRESET|socket hang up|fetch failed|network/i.test(message)) {
    return true;
  }
  if (err.cause && isTransientNetworkError(err.cause)) return true;
  return false;
}

process.on("uncaughtException", (err) => {
  if (isTransientNetworkError(err)) {
    console.error(
      "[warn] transient network error (process kept alive):",
      err?.message || err,
      err?.cause?.code || err?.code || "",
    );
    return;
  }
  console.error("[fatal] uncaughtException:", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  if (isTransientNetworkError(err)) {
    console.error(
      "[warn] transient unhandledRejection (process kept alive):",
      err?.message || err,
      err?.cause?.code || err?.code || "",
    );
    return;
  }
  console.error("[fatal] unhandledRejection:", err);
  process.exit(1);
});

const app = createApp();

const server = app.listen(env.port, "0.0.0.0", () => {
  console.log(`APEX API listening on 0.0.0.0:${env.port} [${env.nodeEnv}]`);
  console.log(
    `[boot] storage=${env.storageDriver} cors=${env.corsOrigins.join(",")} api=${env.apiUrl}`,
  );
  startBackupScheduler().catch((err) =>
    console.error("[boot] backup scheduler:", err?.message || err),
  );
});

// Large Cloudinary video uploads can exceed Node's default request timeout.
server.requestTimeout = 20 * 60 * 1000;
server.headersTimeout = 21 * 60 * 1000;
server.timeout = 20 * 60 * 1000;
server.keepAliveTimeout = 120 * 1000;

