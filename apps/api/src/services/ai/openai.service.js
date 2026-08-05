/**
 * Direct OpenAI chat completions adapter (replaceable provider).
 */

import { env } from '../../config/env.js';
import { getModelConfig } from './models.config.js';
import { createAiError, formatAiError } from './errors.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export const openAiService = {
  id: 'openai',

  isConfigured() {
    return Boolean(env.openaiApiKey);
  },

  async completeChat({
    model,
    system,
    userContent,
    temperature = 0.45,
    maxTokens = 4096,
    responseFormat = { type: 'json_object' },
    timeoutMs,
  }) {
    if (!env.openaiApiKey) {
      throw createAiError('OPENAI_API_KEY is not configured', {
        code: 'invalid_api_key',
        status: 401,
        provider: 'openai',
      });
    }

    const cfg = getModelConfig();
    const baseUrl = (env.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || cfg.timeoutMs);

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.openaiApiKey}`,
          'Content-Type': 'application/json',
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
        const error = createAiError(`OpenAI HTTP ${res.status}`, {
          code: 'openai_http',
          status: res.status,
          provider: 'openai',
        });
        error.body = errText;
        Object.assign(error, formatAiError(error, 'openai'));
        throw error;
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      if (!text) {
        throw createAiError('OpenAI returned empty content', {
          code: 'invalid_response',
          status: 400,
          provider: 'openai',
        });
      }

      return {
        text,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens ?? 0,
              completionTokens: data.usage.completion_tokens ?? 0,
              totalTokens: data.usage.total_tokens ?? 0,
            }
          : null,
        model: data.model || model,
        provider: 'openai',
        raw: data,
      };
    } catch (err) {
      if (err?.name === 'AbortError') {
        const timeoutErr = createAiError('OpenAI request timed out', {
          code: 'timeout',
          status: 504,
          provider: 'openai',
        });
        Object.assign(timeoutErr, formatAiError(timeoutErr, 'openai'));
        throw timeoutErr;
      }
      if (err?.provider === 'openai' || err?.code) throw err;
      const wrapped = createAiError(err.message || 'OpenAI unavailable', {
        code: 'server_error',
        status: 503,
        provider: 'openai',
        cause: err,
      });
      Object.assign(wrapped, formatAiError(wrapped, 'openai'));
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
        const info = formatAiError(err, 'openai');
        if (!info.retryable || attempt >= cfg.maxRetries) {
          throw Object.assign(err, info);
        }
        await sleep(cfg.retryDelayMs * attempt);
      }
    }
    throw lastError;
  },
};
