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
    code === 'insufficient_quota' ||
    type === 'insufficient_quota' ||
    /insufficient_quota|insufficient.?credits|RESOURCE_EXHAUSTED|quota/i.test(raw)
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

  if (status === 404 || /model.?not.?found|NOT_FOUND|no endpoints found/i.test(raw)) {
    return {
      code: 'model_not_found',
      messageFa: 'مدل درخواستی در دسترس نیست. مدل پیش‌فرض یا پشتیبان را بررسی کنید.',
      messageEn: 'Requested model is not available.',
      retryable: true,
      status: 404,
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

  if (status >= 500 || /ECONNREFUSED|ENOTFOUND|fetch failed|unavailable/i.test(raw)) {
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
    messageFa: `ارتباط با ${label} برقرار نشد.`,
    messageEn: `${label} request failed.`,
    retryable: false,
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
