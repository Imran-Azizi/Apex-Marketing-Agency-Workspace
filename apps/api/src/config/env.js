import "dotenv/config";

const nodeEnv = process.env.NODE_ENV || "development";
const isProd = nodeEnv === "production";

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
  if (/localhost|127\.0\.0\.1/i.test(databaseUrl)) {
    throw new Error(
      "DATABASE_URL must point to production Postgres (not localhost)",
    );
  }

  const storageDriver = (
    process.env.STORAGE_DRIVER || "cloudinary"
  ).toLowerCase();
  if (storageDriver === "cloudinary") {
    if (isProd) {
      requiredProd("CLOUDINARY_CLOUD_NAME");
      requiredProd("CLOUDINARY_API_KEY");
      requiredProd("CLOUDINARY_API_SECRET");
    }
  } else if (storageDriver === "s3" || storageDriver === "r2") {
    requiredProd("S3_BUCKET");
    requiredProd("S3_ACCESS_KEY");
    requiredProd("S3_SECRET_KEY");
    requiredProd("STORAGE_PUBLIC_BASE");
  } else {
    throw new Error(
      `Unsupported STORAGE_DRIVER="${storageDriver}". Use cloudinary | s3 | r2.`,
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
/** True when frontend and API are on different hosts (Vercel ↔ Railway). */
const crossOrigin = Boolean(
  apiHost &&
  corsOrigins.some((origin) => {
    const h = hostOf(origin);
    return h && h !== apiHost;
  }),
);

/** Railway injects PORT; local/dev may use API_PORT. */
const port = Number(process.env.PORT || process.env.API_PORT || 4000);

const cookieSameSiteRaw = (process.env.COOKIE_SAME_SITE || "").toLowerCase();
let cookieSameSite =
  cookieSameSiteRaw || (isProd && crossOrigin ? "none" : "lax");
let cookieSecure =
  process.env.COOKIE_SECURE === "true" ||
  (isProd && (crossOrigin || cookieSameSite === "none"));

// Cross-site credentialed auth (browser on Vercel, API on Railway) requires
// SameSite=None; Secure. Force whenever the API is HTTPS and CORS includes another host —
// covers misconfigured WEB_URL / COOKIE_* / NODE_ENV on Railway.
const forceCrossSiteCookies = crossOrigin && /^https:/i.test(apiUrl);
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
  storageDriver: (process.env.STORAGE_DRIVER || "cloudinary").toLowerCase(),
  storagePublicBase: (
    process.env.STORAGE_PUBLIC_BASE ||
    (String(process.env.STORAGE_DRIVER || "cloudinary").toLowerCase() ===
      "cloudinary" && process.env.CLOUDINARY_CLOUD_NAME
      ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}`
      : `${apiUrl}/files`)
  ).replace(/\/$/, ""),

  // Cloudflare R2 / AWS S3 / MinIO — when STORAGE_DRIVER=s3|r2
  s3Endpoint: process.env.S3_ENDPOINT || "",
  s3Bucket: process.env.S3_BUCKET || "",
  s3AccessKey: process.env.S3_ACCESS_KEY || "",
  s3SecretKey: process.env.S3_SECRET_KEY || "",
  s3Region: process.env.S3_REGION || "auto",
  s3ForcePathStyle: bool("S3_FORCE_PATH_STYLE", false),

  // Cloudinary — when STORAGE_DRIVER=cloudinary (good for testing / image-heavy media)
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  /** Optional root folder prefix inside the Cloudinary account (e.g. "apex"). */
  cloudinaryFolderPrefix: process.env.CLOUDINARY_FOLDER_PREFIX || "apex",

  /** openrouter | openai | anthropic | gemini | mock */
  aiProvider: process.env.AI_PROVIDER || "openrouter",
  aiDefaultModel: process.env.AI_DEFAULT_MODEL || "",
  aiBackupModel: process.env.AI_BACKUP_MODEL || "",
  aiModelScenario: process.env.AI_MODEL_SCENARIO || "",
  aiModelNarration: process.env.AI_MODEL_NARRATION || "",
  aiModelStoryboard: process.env.AI_MODEL_STORYBOARD || "",
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
  /**
   * Return plaintext OTP in API responses for manual WhatsApp delivery.
   * Defaults to true because no automated WhatsApp/SMS OTP provider is wired yet.
   * Set PORTAL_EXPOSE_OTP=false only after automated delivery is configured.
   * (Previously gated on NODE_ENV===production, which broke registration on Railway.)
   */
  portalExposeOtp: bool("PORTAL_EXPOSE_OTP", true),
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
