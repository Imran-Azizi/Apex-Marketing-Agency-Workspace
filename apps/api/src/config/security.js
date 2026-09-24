/**
 * Centralized production security defaults.
 * Environment-specific secrets stay in env.js; this file holds policy.
 */

export const SECURITY = Object.freeze({
  jwt: Object.freeze({
    algorithms: Object.freeze(["HS256"]),
    clockToleranceSec: 5,
  }),

  password: Object.freeze({
    minLength: 8,
    maxLength: 128,
    /** Login still accepts legacy shorter passwords. */
    loginMinLength: 6,
  }),

  loginGuard: Object.freeze({
    maxFailures: 8,
    windowMs: 15 * 60 * 1000,
    lockMs: 15 * 60 * 1000,
  }),

  rateLimit: Object.freeze({
    global: { windowMs: 15 * 60 * 1000, max: 1000 },
    auth: { windowMs: 15 * 60 * 1000, max: 30 },
    login: { windowMs: 15 * 60 * 1000, max: 12 },
    otp: { windowMs: 15 * 60 * 1000, max: 8 },
    contact: { windowMs: 15 * 60 * 1000, max: 8 },
    ai: { windowMs: 15 * 60 * 1000, max: 40 },
    chatMessage: { windowMs: 60 * 1000, max: 60 },
    chatUpload: { windowMs: 15 * 60 * 1000, max: 40 },
    upload: { windowMs: 15 * 60 * 1000, max: 80 },
  }),

  request: Object.freeze({
    jsonLimit: "2mb",
    urlencodedLimit: "64kb",
  }),

  upload: Object.freeze({
    /** Hard cap to stop unbounded DoS; large production videos still fit. */
    maxFileBytes: 5 * 1024 * 1024 * 1024,
    chatMaxBytes: 25 * 1024 * 1024,
  }),

  pagination: Object.freeze({
    defaultPageSize: 20,
    maxPageSize: 100,
    auditMax: 200,
    chatMessageMax: 80,
  }),

  /** Marketing assets that may be fetched without a session. */
  publicStoragePrefixes: Object.freeze([
    "images/hero/",
    "images/services/",
    "images/customers/",
    "images/portfolio/",
    "images/landing/",
    "videos/portfolio/",
    "videos/landing/",
    "audio/landing/",
  ]),
});

export const BLOCKED_UPLOAD_EXTENSIONS = Object.freeze([
  "exe",
  "bat",
  "cmd",
  "com",
  "msi",
  "scr",
  "pif",
  "js",
  "mjs",
  "cjs",
  "php",
  "phtml",
  "asp",
  "aspx",
  "jsp",
  "sh",
  "bash",
  "ps1",
  "dll",
  "so",
  "dylib",
  "html",
  "htm",
]);
