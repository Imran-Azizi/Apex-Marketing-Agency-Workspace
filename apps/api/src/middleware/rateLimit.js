import rateLimit from 'express-rate-limit';
import { SECURITY } from '../config/security.js';

function jsonMessage(code, message) {
  return { success: false, error: { code, message } };
}

export const globalLimiter = rateLimit({
  windowMs: SECURITY.rateLimit.global.windowMs,
  max: SECURITY.rateLimit.global.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const url = String(req.originalUrl || req.url || "");
    return (
      url.startsWith("/files/") || url.includes("/webhooks/whatsapp")
    );
  },
});

export const authLimiter = rateLimit({
  windowMs: SECURITY.rateLimit.auth.windowMs,
  max: SECURITY.rateLimit.auth.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('RATE_LIMITED', 'Too many auth attempts'),
});

export const loginLimiter = rateLimit({
  windowMs: SECURITY.rateLimit.login.windowMs,
  max: SECURITY.rateLimit.login.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.ip || 'anonymous'),
  message: jsonMessage('RATE_LIMITED', 'Too many auth attempts'),
});

export const otpLimiter = rateLimit({
  windowMs: SECURITY.rateLimit.otp.windowMs,
  max: SECURITY.rateLimit.otp.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('RATE_LIMITED', 'Too many OTP requests'),
});

/** Public Contact Us form — abuse / spam protection */
export const contactLimiter = rateLimit({
  windowMs: SECURITY.rateLimit.contact.windowMs,
  max: SECURITY.rateLimit.contact.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.ip || "anonymous"),
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "تعداد درخواست‌ها زیاد است. لطفاً کمی بعد دوباره تلاش کنید.",
    },
  },
});

/** Per-user AI generation limiter (expensive LLM calls) */
export const aiLimiter = rateLimit({
  windowMs: SECURITY.rateLimit.ai.windowMs,
  max: SECURITY.rateLimit.ai.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.auth?.userId || req.ip || 'anonymous'),
  message: {
    success: false,
    error: { code: 'AI_RATE_LIMITED', message: 'تعداد درخواست‌های هوش مصنوعی زیاد است. کمی بعد تلاش کنید.' },
  },
});

/** Chat message send / conversation open */
export const chatMessageLimiter = rateLimit({
  windowMs: SECURITY.rateLimit.chatMessage.windowMs,
  max: SECURITY.rateLimit.chatMessage.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.auth?.userId || req.ip || 'anonymous'),
  message: {
    success: false,
    error: {
      code: 'CHAT_RATE_LIMITED',
      message: 'تعداد پیام‌ها زیاد است. کمی بعد تلاش کنید.',
    },
  },
});

/** Chat attachment / voice uploads */
export const chatUploadLimiter = rateLimit({
  windowMs: SECURITY.rateLimit.chatUpload.windowMs,
  max: SECURITY.rateLimit.chatUpload.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.auth?.userId || req.ip || 'anonymous'),
  message: {
    success: false,
    error: {
      code: 'CHAT_UPLOAD_RATE_LIMITED',
      message: 'تعداد بارگذاری فایل زیاد است. کمی بعد تلاش کنید.',
    },
  },
});

/** General authenticated file uploads */
export const uploadLimiter = rateLimit({
  windowMs: SECURITY.rateLimit.upload.windowMs,
  max: SECURITY.rateLimit.upload.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.auth?.userId || req.ip || 'anonymous'),
  message: {
    success: false,
    error: {
      code: 'UPLOAD_RATE_LIMITED',
      message: 'تعداد بارگذاری فایل زیاد است. کمی بعد تلاش کنید.',
    },
  },
});
