/**
 * Anthropic Messages API adapter (replaceable provider).
 * Prefer OpenRouter for multi-model access; use this for direct Anthropic.
 */

import { env } from '../../config/env.js';
import { getModelConfig } from './models.config.js';
import { createAiError, formatAiError } from './errors.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function mapAnthropicModel(model) {
  if (!model) return env.anthropicModel || 'claude-sonnet-4-20250514';
  if (model.startsWith('anthropic/')) return model.replace(/^anthropic\//, '');
  if (model.includes('/')) return env.anthropicModel || 'claude-sonnet-4-20250514';
  return model;
}

export const anthropicService = {
  id: 'anthropic',

  isConfigured() {
    return Boolean(env.anthropicApiKey);
  },

  async completeChat({
    model,
    system,
    userContent,
    temperature = 0.45,
    maxTokens = 4096,
    timeoutMs,
  }) {
    if (!env.anthropicApiKey) {
      throw createAiError('ANTHROPIC_API_KEY is not configured', {
        code: 'invalid_api_key',
        status: 401,
        provider: 'anthropic',
      });
    }

    const cfg = getModelConfig();
    const anthropicModel = mapAnthropicModel(model);
    const baseUrl = (env.anthropicBaseUrl || 'https://api.anthropic.com').replace(/\/$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || cfg.timeoutMs);

    const userText =
      typeof userContent === 'string' ? userContent : JSON.stringify(userContent);

    try {
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': env.anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: anthropicModel,
          max_tokens: maxTokens,
          temperature,
          system: `${system}\n\nReturn valid JSON only.`,
          messages: [{ role: 'user', content: userText }],
        }),
        signal: controller.signal,
      });

      const errText = !res.ok ? await res.text() : null;
      if (!res.ok) {
        const error = createAiError(`Anthropic HTTP ${res.status}`, {
          code: 'anthropic_http',
          status: res.status,
          provider: 'anthropic',
        });
        error.body = errText;
        Object.assign(error, formatAiError(error, 'anthropic'));
        throw error;
      }

      const data = await res.json();
      const text = (data.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      if (!text) {
        throw createAiError('Anthropic returned empty content', {
          code: 'invalid_response',
          status: 400,
          provider: 'anthropic',
        });
      }

      return {
        text,
        usage: data.usage
          ? {
              promptTokens: data.usage.input_tokens ?? 0,
              completionTokens: data.usage.output_tokens ?? 0,
              totalTokens:
                (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
            }
          : null,
        model: data.model || anthropicModel,
        provider: 'anthropic',
        raw: data,
      };
    } catch (err) {
      if (err?.name === 'AbortError') {
        const timeoutErr = createAiError('Anthropic request timed out', {
          code: 'timeout',
          status: 504,
          provider: 'anthropic',
        });
        Object.assign(timeoutErr, formatAiError(timeoutErr, 'anthropic'));
        throw timeoutErr;
      }
      if (err?.provider === 'anthropic' || err?.code) throw err;
      const wrapped = createAiError(err.message || 'Anthropic unavailable', {
        code: 'server_error',
        status: 503,
        provider: 'anthropic',
        cause: err,
      });
      Object.assign(wrapped, formatAiError(wrapped, 'anthropic'));
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
        const info = formatAiError(err, 'anthropic');
        if (!info.retryable || attempt >= cfg.maxRetries) {
          throw Object.assign(err, info);
        }
        await sleep(cfg.retryDelayMs * attempt);
      }
    }
    throw lastError;
  },
};
