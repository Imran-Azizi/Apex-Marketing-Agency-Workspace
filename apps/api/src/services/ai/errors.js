/**
 * Normalized AI provider errors with Dari + English messages.
 */

const PROVIDER_LABEL = {
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  mock: 'Mock',
};

const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'EPIPE',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_ABORTED',
]);

export function providerLabel(provider = 'openrouter') {
  return PROVIDER_LABEL[provider] || provider;
}

export function formatAiError(err, provider = 'openrouter') {
  const status = err?.status;
  const raw = String(err?.body || err?.message || '');
  let parsed = null;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {
    parsed = null;
  }

  const code = parsed?.error?.code || parsed?.code || parsed?.error?.status || err?.code || null;
  const type = parsed?.error?.type || parsed?.error?.status || null;
  const label = providerLabel(provider);

  const causeCode = String(err?.cause?.code || err?.errno || '');
  const networkHint = `${code || ''} ${causeCode} ${raw} ${err?.cause?.message || ''}`;
  const isTransientNetwork =
    TRANSIENT_NETWORK_CODES.has(String(code || '')) ||
    TRANSIENT_NETWORK_CODES.has(causeCode) ||
    /ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch failed|socket hang up|other side closed|^terminated$|UND_ERR_|unavailable/i.test(
      networkHint,
    );

  if (code === 'ABORT_ERR' || err?.name === 'AbortError' || /timeout|aborted/i.test(raw)) {
    return {
      code: 'timeout',
      messageFa: `پاسخ ${label} بیش از حد طول کشید. دوباره تلاش کنید.`,
      messageEn: `${label} request timed out.`,
      retryable: true,
      status: 504,
    };
  }

  if (
    status === 402 ||
    code === 402 ||
    code === '402' ||
    code === 'insufficient_quota' ||
    type === 'insufficient_quota' ||
    /insufficient_quota|insufficient.?credits|more credits|can only afford|RESOURCE_EXHAUSTED|quota|payment required|insufficient funds/i.test(
      raw,
    )
  ) {
    return {
      code: 'insufficient_quota',
      messageFa: `سهمیه یا اعتبار حساب ${label} تمام شده است.`,
      messageEn: `${label} quota exceeded.`,
      retryable: false,
      status: 402,
    };
  }

  if (status === 429 || /rate.?limit|RESOURCE_EXHAUSTED/i.test(raw)) {
    return {
      code: 'rate_limit',
      messageFa: `محدودیت نرخ درخواست ${label}. چند لحظه بعد دوباره تلاش کنید.`,
      messageEn: `${label} rate limit. Try again shortly.`,
      retryable: true,
      status: 429,
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    /invalid.?api.?key|API_KEY_INVALID|PERMISSION_DENIED|unauthorized/i.test(raw)
  ) {
    return {
      code: 'invalid_api_key',
      messageFa: `کلید API ${label} نامعتبر است. تنظیمات سرور را بررسی کنید.`,
      messageEn: `Invalid ${label} API key.`,
      retryable: false,
      status: status || 401,
    };
  }

  if (status === 404 || /model.?not.?found|NOT_FOUND|no endpoints found|invalid model/i.test(raw)) {
    return {
      code: 'model_not_found',
      messageFa: 'مدل درخواستی در دسترس نیست. مدل پیش‌فرض یا پشتیبان را بررسی کنید.',
      messageEn: 'Requested model is not available.',
      retryable: true,
      status: 404,
    };
  }

  if (
    /context.?length|maximum context|too many tokens|prompt is too long|max.?context/i.test(raw)
    && !/can only afford/i.test(raw)
  ) {
    return {
      code: 'context_length',
      messageFa: 'متن ورودی برای این مدل خیلی طولانی است. مدل دیگری با پنجره بزرگ‌تر امتحان می‌شود.',
      messageEn: 'Prompt exceeds the model context window.',
      retryable: true,
      status: status || 400,
    };
  }

  if (status === 400 || code === 'invalid_response') {
    return {
      code: code === 'invalid_response' ? 'invalid_response' : 'bad_request',
      messageFa:
        code === 'invalid_response'
          ? 'پاسخ هوش مصنوعی معتبر نبود. دوباره تولید کنید.'
          : `درخواست به ${label} نامعتبر بود.`,
      messageEn:
        code === 'invalid_response'
          ? 'Invalid AI response payload.'
          : `Invalid ${label} request.`,
      retryable: code === 'invalid_response',
      status: 400,
    };
  }

  if (status >= 500 || isTransientNetwork) {
    return {
      code: 'server_error',
      messageFa: `سرویس ${label} موقتاً در دسترس نیست. دوباره تلاش کنید.`,
      messageEn: `${label} temporarily unavailable.`,
      retryable: true,
      status: status || 503,
    };
  }

  return {
    code: `${provider}_error`,
    messageFa: status
      ? `ارتباط با ${label} برقرار نشد (کد ${status}).`
      : `ارتباط با ${label} برقرار نشد.`,
    messageEn: status
      ? `${label} request failed (${status}).`
      : `${label} request failed.`,
    retryable: !status || status >= 500 || status === 408 || status === 409,
    status: status || 502,
  };
}

export function createAiError(message, { code = 'ai_error', status = 502, provider, cause } = {}) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  err.provider = provider;
  if (cause) err.cause = cause;
  return err;
}
