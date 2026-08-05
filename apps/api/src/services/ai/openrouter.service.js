/**
 * OpenRouter chat completions client (OpenAI-compatible).
 * API key must come from env — never from the frontend.
 */

import { env } from '../../config/env.js';
import { getModelConfig } from './models.config.js';
import { createAiError, formatAiError } from './errors.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export const openRouterService = {
  id: 'openrouter',

  isConfigured() {
    return Boolean(env.openrouterApiKey);
  },

  /**
   * @param {{
   *  model: string,
   *  system: string,
   *  userContent: unknown,
   *  temperature?: number,
   *  maxTokens?: number,
   *  responseFormat?: { type: string },
   *  timeoutMs?: number,
   * }} args
   */
  async completeChat({
    model,
    system,
    userContent,
    temperature = 0.45,
    maxTokens = 4096,
    responseFormat = { type: 'json_object' },
    timeoutMs,
  }) {
    if (!env.openrouterApiKey) {
      throw createAiError('OPENROUTER_API_KEY is not configured', {
        code: 'invalid_api_key',
        status: 401,
        provider: 'openrouter',
      });
    }

    const cfg = getModelConfig();
    const baseUrl = (env.openrouterBaseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
    const controller = new AbortController();
    const timeout = timeoutMs || cfg.timeoutMs;
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.openrouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': cfg.siteUrl,
          'X-Title': cfg.siteName,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            {
              role: 'user',
              content:
                typeof userContent === 'string'
                  ? userContent
                  : JSON.stringify(userContent),
            },
          ],
          temperature,
          max_tokens: maxTokens,
          response_format: responseFormat,
        }),
        signal: controller.signal,
      });

      const errText = !res.ok ? await res.text() : null;
      if (!res.ok) {
        const error = createAiError(`OpenRouter HTTP ${res.status}`, {
          code: 'openrouter_http',
          status: res.status,
          provider: 'openrouter',
        });
        error.body = errText;
        Object.assign(error, formatAiError(error, 'openrouter'));
        throw error;
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      if (!text) {
        throw createAiError('OpenRouter returned empty content', {
          code: 'invalid_response',
          status: 400,
          provider: 'openrouter',
        });
      }

      const usage = data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
          }
        : null;

      return {
        text,
        usage,
        model: data.model || model,
        provider: 'openrouter',
        raw: data,
      };
    } catch (err) {
      if (err?.name === 'AbortError') {
        const timeoutErr = createAiError('OpenRouter request timed out', {
          code: 'timeout',
          status: 504,
          provider: 'openrouter',
        });
        Object.assign(timeoutErr, formatAiError(timeoutErr, 'openrouter'));
        throw timeoutErr;
      }
      if (err?.provider === 'openrouter' || err?.code) throw err;
      const wrapped = createAiError(err.message || 'OpenRouter unavailable', {
        code: 'server_error',
        status: 503,
        provider: 'openrouter',
        cause: err,
      });
      Object.assign(wrapped, formatAiError(wrapped, 'openrouter'));
      throw wrapped;
    } finally {
      clearTimeout(timer);
    }
  },

  async completeChatWithRetry(args) {
    const cfg = getModelConfig();
    let lastError;
    for (let attempt = 1; attempt <= cfg.maxRetries; attempt += 1) {
      try {
        return await this.completeChat(args);
      } catch (err) {
        lastError = err;
        const info = formatAiError(err, 'openrouter');
        if (!info.retryable || attempt >= cfg.maxRetries) {
          throw Object.assign(err, info);
        }
        await sleep(cfg.retryDelayMs * attempt);
      }
    }
    throw lastError;
  },
};
