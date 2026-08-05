import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many auth attempts' } },
});

export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many OTP requests' } },
});

/** Per-user AI generation limiter (expensive LLM calls) */
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.auth?.userId || req.ip || 'anonymous'),
  message: {
    success: false,
    error: { code: 'AI_RATE_LIMITED', message: 'تعداد درخواست‌های هوش مصنوعی زیاد است. کمی بعد تلاش کنید.' },
  },
});
