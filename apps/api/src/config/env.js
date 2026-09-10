import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Always load apps/api/.env relative to this file (not process.cwd()),
// so workspace / monorepo launches still pick up the active Bunny account.
dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env"),
});

const nodeEnv = process.env.NODE_ENV || "development";
const isProd = nodeEnv === "production";

function trimEnv(value) {
  return String(value ?? "").trim();
}

const WEAK_SECRET_MARKERS = [
  "dev-",
  "change-me",
  "min-32-characters",
  "apex_secret",
];

function isWeakSecret(value) {
  const v = String(value || "").toLowerCase();
  if (v.length < 32) return true;
  return WEAK_SECRET_MARKERS.some((m) => v.includes(m));
}

function required(key, fallback) {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
}

function requiredProd(key) {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing required production env: ${key}`);
  }
  return value;
}

function bool(key, defaultValue = false) {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}

function parseOrigins(webUrl) {
  const extras = String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const origins = new Set();
  if (webUrl) origins.add(webUrl.replace(/\/$/, ""));
  for (const o of extras) origins.add(o.replace(/\/$/, ""));

  if (!isProd) {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }

  return [...origins];
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

// --- Production fail-closed validation ---
if (isProd) {
  const databaseUrl = requiredProd("DATABASE_URL");
  const jwtAccess = requiredProd("JWT_ACCESS_SECRET");
  const jwtRefresh = requiredProd("JWT_REFRESH_SECRET");
  const csrf = requiredProd("CSRF_SECRET");
  const signed = requiredProd("SIGNED_URL_SECRET");
  requiredProd("WEB_URL");
  requiredProd("API_URL");

  if (isWeakSecret(jwtAccess)) {
    throw new Error(
      "JWT_ACCESS_SECRET is missing or too weak for production (min 32 chars, no defaults)",
    );
  }
  if (isWeakSecret(jwtRefresh)) {
    throw new Error(
      "JWT_REFRESH_SECRET is missing or too weak for production (min 32 chars, no defaults)",
    );
  }
  if (isWeakSecret(csrf)) {
    throw new Error(
      "CSRF_SECRET is missing or too weak for production (min 32 chars, no defaults)",
    );
  }
  if (isWeakSecret(signed)) {
    throw new Error(
      "SIGNED_URL_SECRET is missing or too weak for production (min 32 chars, no defaults)",
    );
  }
  // Hostinger/same-box VPS uses Postgres on 127.0.0.1 — that is expected.
  // Reject only clearly unfinished placeholder URLs, not local sockets.
  if (/CHANGE_ME|apex_secret|user:password/i.test(databaseUrl)) {
    throw new Error(
      "DATABASE_URL still contains a placeholder password — set the real VPS Postgres credentials",
    );
  }

  const storageDriver = (
    trimEnv(process.env.STORAGE_DRIVER) || "bunny"
  ).toLowerCase();
  if (storageDriver !== "bunny") {
    throw new Error(
      `Unsupported STORAGE_DRIVER="${storageDriver}". This application uses Bunny.net only.`,
    );
  }
  requiredProd("BUNNY_STORAGE_ZONE");
  requiredProd("BUNNY_STORAGE_API_KEY");
  if (
    !trimEnv(process.env.BUNNY_CDN_HOSTNAME) &&
    !trimEnv(process.env.STORAGE_PUBLIC_BASE)
  ) {
    throw new Error(
      "BUNNY_CDN_HOSTNAME (or STORAGE_PUBLIC_BASE) is required in production",
    );
  }
}

const apiUrl = isProd
  ? requiredProd("API_URL").replace(/\/$/, "")
  : (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");
const webUrl = isProd
  ? requiredProd("WEB_URL").replace(/\/$/, "")
  : (process.env.WEB_URL || "http://localhost:3000").replace(/\/$/, "");

const corsOrigins = parseOrigins(webUrl);
const apiHost = hostOf(apiUrl);
/** True when frontend and API are on different hosts (split hosting). */
const crossOrigin = Boolean(
  apiHost &&
  corsOrigins.some((origin) => {
    const h = hostOf(origin);
    return h && h !== apiHost;
  }),
);

/** Prefer PORT (process managers); local/dev may use API_PORT. */
const port = Number(process.env.PORT || process.env.API_PORT || 4000);
/** Bind address — use 127.0.0.1 behind Nginx on a VPS; 0.0.0.0 for local/dev. */
const host = process.env.HOST || (isProd ? "127.0.0.1" : "0.0.0.0");

const cookieSameSiteRaw = (process.env.COOKIE_SAME_SITE || "").toLowerCase();
let cookieSameSite =
  cookieSameSiteRaw || (isProd && crossOrigin ? "none" : "lax");
let cookieSecure =
  process.env.COOKIE_SECURE === "true" ||
  (isProd && (crossOrigin || cookieSameSite === "none"));

// Cross-site credentialed auth (browser and API on different hosts) requires
// SameSite=None; Secure. Force whenever CORS includes a different frontend host.
const frontendUsesHttps = corsOrigins.some((o) => /^https:/i.test(o));
const forceCrossSiteCookies = crossOrigin && (isProd || frontendUsesHttps);
if (forceCrossSiteCookies) {
  if (cookieSameSite !== "none") {
    console.warn(
      `[env] Overriding COOKIE_SAME_SITE=${cookieSameSite || "unset"} → none (cross-origin frontend vs API).`,
    );
    cookieSameSite = "none";
  }
  if (!cookieSecure) {
    console.warn(
      "[env] Overriding COOKIE_SECURE → true (required with SameSite=None).",
    );
    cookieSecure = true;
  }
} else if (isProd && crossOrigin && cookieSameSite !== "none") {
  console.warn(
    "[env] Cross-origin WEB_URL/API_URL detected — set COOKIE_SAME_SITE=none and COOKIE_SECURE=true for auth cookies.",
  );
}

export const env = {
  nodeEnv,
  isProd,
  port,
  host,
  apiUrl,
  webUrl,
  corsOrigins,
  databaseUrl: required(
    "DATABASE_URL",
    "postgresql://apex:apex_secret@localhost:5432/apex_workspace?schema=public",
  ),
  jwtAccessSecret: required(
    "JWT_ACCESS_SECRET",
    "dev-access-secret-min-32-characters-xx",
  ),
  jwtRefreshSecret: required(
    "JWT_REFRESH_SECRET",
    "dev-refresh-secret-min-32-characters-x",
  ),
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || "15m",
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES || "7d",
  cookieSecure,
  cookieSameSite,
  csrfSecret: required("CSRF_SECRET", "dev-csrf-secret-min-32-characters-xxxx"),
  storageDriver: (trimEnv(process.env.STORAGE_DRIVER) || "bunny").toLowerCase(),
  storagePublicBase: (
    trimEnv(process.env.STORAGE_PUBLIC_BASE) ||
    (() => {
      const bunnyCdn = trimEnv(process.env.BUNNY_CDN_HOSTNAME).replace(
        /\/+$/,
        "",
      );
      if (bunnyCdn) {
        return /^https?:\/\//i.test(bunnyCdn) ? bunnyCdn : `https://${bunnyCdn}`;
      }
      return `${apiUrl}/files`;
    })()
  ).replace(/\/$/, ""),

  /** Active Bunny Storage Zone name (dashboard → Storage). */
  bunnyStorageZone: trimEnv(process.env.BUNNY_STORAGE_ZONE),
  /** Storage Zone password / API Access Key — never hardcode. */
  bunnyStorageApiKey: trimEnv(process.env.BUNNY_STORAGE_API_KEY),
  /** Regional storage hostname from Bunny (e.g. sg.storage.bunnycdn.com). */
  bunnyStorageHostname:
    trimEnv(process.env.BUNNY_STORAGE_HOSTNAME) || "storage.bunnycdn.com",
  /** Pull Zone hostname for CDN delivery (e.g. myzone.b-cdn.net). */
  bunnyCdnHostname: trimEnv(process.env.BUNNY_CDN_HOSTNAME).replace(
    /^https?:\/\//i,
    "",
  ).replace(/\/+$/, ""),
  /** Optional Pull Zone token-authentication key for signed CDN URLs.
   *  Required for private assets on a public pull zone. Without it, private
   *  objects are proxied through the API instead of returning unsigned CDN URLs. */
  bunnyCdnTokenKey: trimEnv(process.env.BUNNY_CDN_TOKEN_KEY),
  /** App folder prefix inside the storage zone (not a Bunny dashboard field). */
  bunnyStoragePathPrefix:
    trimEnv(process.env.BUNNY_STORAGE_PATH_PREFIX) || "apex",

  /** openrouter | openai | anthropic | gemini | mock */
  aiProvider: process.env.AI_PROVIDER || "openrouter",
  aiDefaultModel: process.env.AI_DEFAULT_MODEL || "",
  aiBackupModel: process.env.AI_BACKUP_MODEL || "",
  aiModelScenario: process.env.AI_MODEL_SCENARIO || "",
  aiModelNarration: process.env.AI_MODEL_NARRATION || "",
  aiModelStoryboard: process.env.AI_MODEL_STORYBOARD || "",
  aiModelPortfolio: process.env.AI_MODEL_PORTFOLIO || "",
  aiModelSalesAssistant: process.env.AI_MODEL_SALES_ASSISTANT || "",
  aiModelBusinessAssistant:
    process.env.AI_MODEL_BUSINESS_ASSISTANT || "google/gemini-2.0-flash-exp:free",
  aiTemperature: process.env.AI_TEMPERATURE,
  aiMaxTokens: process.env.AI_MAX_TOKENS,
  aiRequestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS || 120000),
  aiMaxRetries: Number(
    process.env.AI_MAX_RETRIES || process.env.OPENAI_MAX_RETRIES || 3,
  ),
  aiRetryDelayMs: Number(
    process.env.AI_RETRY_DELAY_MS || process.env.OPENAI_RETRY_DELAY_MS || 800,
  ),
  /** When true, failed live providers may return mock content (dev only). */
  aiAllowMockFallback: bool("AI_ALLOW_MOCK_FALLBACK", false),
  aiAsyncPipeline: process.env.AI_ASYNC_PIPELINE !== "false",

  // OpenRouter (primary)
  openrouterApiKey: process.env.OPENROUTER_API_KEY || "",
  openrouterBaseUrl:
    process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  openrouterModel:
    process.env.OPENROUTER_MODEL ||
    process.env.AI_DEFAULT_MODEL ||
    "anthropic/claude-sonnet-4",
  openrouterBackupModel:
    process.env.OPENROUTER_BACKUP_MODEL ||
    process.env.AI_BACKUP_MODEL ||
    "openai/gpt-4o-mini",
  /** OpenRouter image model for storyboard stills (POST /images). */
  openrouterImageModel:
    process.env.OPENROUTER_IMAGE_MODEL ||
    process.env.AI_IMAGE_MODEL ||
    "google/gemini-2.5-flash-image",
  /**
   * Image generation provider:
   * auto | openrouter | openai | free (Pollinations, no paid credits)
   */
  aiImageProvider: String(
    process.env.AI_IMAGE_PROVIDER || "auto",
  ).toLowerCase(),
  pollinationsApiKey: process.env.POLLINATIONS_API_KEY || "",
  pollinationsImageModel: process.env.POLLINATIONS_IMAGE_MODEL || "flux-realism",

  // OpenAI (optional / replaceable)
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o",
  openaiModelReasoning:
    process.env.OPENAI_MODEL_REASONING || process.env.OPENAI_MODEL || "gpt-4o",
  openaiModelLight: process.env.OPENAI_MODEL_LIGHT || "gpt-4o-mini",
  openaiImageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
  openaiSoraModel: process.env.OPENAI_SORA_MODEL || "sora-2",
  openaiMaxRetries: Number(
    process.env.OPENAI_MAX_RETRIES || process.env.AI_MAX_RETRIES || 3,
  ),
  openaiRetryDelayMs: Number(
    process.env.OPENAI_RETRY_DELAY_MS || process.env.AI_RETRY_DELAY_MS || 800,
  ),

  // Anthropic direct (optional / replaceable)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  anthropicBaseUrl:
    process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",

  // Google Gemini (optional / replaceable)
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiBaseUrl:
    process.env.GEMINI_BASE_URL ||
    "https://generativelanguage.googleapis.com/v1beta",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  geminiModelReasoning:
    process.env.GEMINI_MODEL_REASONING ||
    process.env.GEMINI_MODEL ||
    "gemini-2.0-flash",
  geminiModelLight: process.env.GEMINI_MODEL_LIGHT || "gemini-2.0-flash-lite",

  defaultManagerEmail: process.env.DEFAULT_MANAGER_EMAIL || "manager@apex.af",
  defaultManagerPassword:
    process.env.DEFAULT_MANAGER_PASSWORD || "ApexManager!2026",
  whatsappNumber: process.env.WHATSAPP_NUMBER || "93700000000",
  contactEmail: process.env.CONTACT_EMAIL || "info@apex.af",
  contactPhone: process.env.CONTACT_PHONE || process.env.WHATSAPP_NUMBER || "93700000000",
  /**
   * Return plaintext OTP in API responses for manual WhatsApp delivery.
   * Defaults to true because no automated WhatsApp/SMS OTP provider is wired yet.
   * Set PORTAL_EXPOSE_OTP=false only after automated delivery is configured.
   * (Previously gated on NODE_ENV===production, which broke registration in some hosts.)
   */
  portalExposeOtp: bool("PORTAL_EXPOSE_OTP", true),
  /**
   * AES-256-GCM secret for recoverable portal passwords (manager assistance).
   * Falls back to JWT_ACCESS_SECRET when unset so existing deploys keep booting.
   */
  portalCredentialSecret:
    process.env.PORTAL_CREDENTIAL_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    "dev-access-secret-min-32-characters-xx",
  signedUrlSecret: required(
    "SIGNED_URL_SECRET",
    "dev-signed-url-secret-32-characters",
  ),
  signedUrlTtl: Number(process.env.SIGNED_URL_TTL_SECONDS || 300),

  // SMTP — optional; required to email backup archives
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: bool("SMTP_SECURE", false),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  mailFrom:
    process.env.MAIL_FROM ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    "",
  /** Default recipient for automatic / manual backups when schedule.emailTo is empty */
  backupEmailTo: process.env.BACKUP_EMAIL_TO || "",
  /** Max attachment size for emailing backups (bytes). Larger files stay in object storage only. */
  backupEmailMaxBytes: Number(process.env.BACKUP_EMAIL_MAX_BYTES || 15 * 1024 * 1024),
};

/** Active LLM settings based on AI_PROVIDER */
export function getActiveAiConfig() {
  const provider = (env.aiProvider || "openrouter").toLowerCase();

  if (provider === "openrouter") {
    return {
      provider: "openrouter",
      enabled: Boolean(env.openrouterApiKey),
      reasoningModel: env.aiDefaultModel || env.openrouterModel,
      lightModel: env.aiBackupModel || env.openrouterBackupModel,
      imageModel: env.openrouterImageModel,
    };
  }
  if (provider === "openai") {
    return {
      provider: "openai",
      enabled: Boolean(env.openaiApiKey),
      reasoningModel: env.aiDefaultModel || env.openaiModelReasoning,
      lightModel: env.aiBackupModel || env.openaiModelLight,
      imageModel: env.openaiImageModel,
    };
  }
  if (provider === "anthropic") {
    return {
      provider: "anthropic",
      enabled: Boolean(env.anthropicApiKey),
      reasoningModel: env.aiDefaultModel || env.anthropicModel,
      lightModel: env.aiBackupModel || env.anthropicModel,
      imageModel: null,
    };
  }
  if (provider === "gemini") {
    return {
      provider: "gemini",
      enabled: Boolean(env.geminiApiKey),
      reasoningModel: env.aiDefaultModel || env.geminiModelReasoning,
      lightModel: env.aiBackupModel || env.geminiModelLight,
      imageModel: null,
    };
  }
  return {
    provider: "mock",
    enabled: true,
    reasoningModel: "mock-apex-v5",
    lightModel: "mock-apex-v5",
    imageModel: null,
  };
}

/** Safe summary for logs — never includes API keys or token secrets. */
export function getBunnyStorageSummary() {
  return {
    driver: env.storageDriver,
    zone: env.bunnyStorageZone || "(unset)",
    storageHostname: env.bunnyStorageHostname,
    cdnHostname: env.bunnyCdnHostname || "(unset)",
    publicBase: env.storagePublicBase,
    pathPrefix: env.bunnyStoragePathPrefix,
    configured: Boolean(env.bunnyStorageZone && env.bunnyStorageApiKey),
    tokenAuth: Boolean(env.bunnyCdnTokenKey),
  };
}

/**
 * Soft checks for local/dev: warn loudly if Bunny is incomplete or
 * STORAGE_PUBLIC_BASE points at a different host than BUNNY_CDN_HOSTNAME.
 */
export function warnIfBunnyMisconfigured() {
  if (!env.bunnyStorageZone || !env.bunnyStorageApiKey) {
    console.warn(
      "[env] Bunny.net is not fully configured. Set BUNNY_STORAGE_ZONE and BUNNY_STORAGE_API_KEY — uploads will fail.",
    );
    return;
  }

  if (env.bunnyCdnHostname && env.storagePublicBase) {
    try {
      const cdnHost = env.bunnyCdnHostname.toLowerCase();
      const publicHost = new URL(
        /^https?:\/\//i.test(env.storagePublicBase)
          ? env.storagePublicBase
          : `https://${env.storagePublicBase}`,
      ).host.toLowerCase();
      if (
        publicHost &&
        cdnHost &&
        publicHost !== cdnHost &&
        !/\/files$/i.test(env.storagePublicBase)
      ) {
        console.warn(
          `[env] STORAGE_PUBLIC_BASE host (${publicHost}) differs from BUNNY_CDN_HOSTNAME (${cdnHost}). New uploads use the zone API key; public URLs may 404 if the Pull Zone is wrong.`,
        );
      }
    } catch {
      /* ignore parse errors */
    }
  }
}
