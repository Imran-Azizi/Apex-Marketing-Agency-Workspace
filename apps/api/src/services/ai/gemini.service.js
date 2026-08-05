/**
 * Google Gemini generateContent adapter (replaceable provider).
 */

import { env } from '../../config/env.js';
import { getModelConfig } from './models.config.js';
import { createAiError, formatAiError } from './errors.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function mapGeminiModel(model) {
  // Allow OpenRouter-style slugs when switching providers.
  if (!model) return env.geminiModelReasoning || 'gemini-2.0-flash';
  if (model.startsWith('google/')) return model.replace(/^google\//, '');
  if (model.includes('/')) return env.geminiModelReasoning || 'gemini-2.0-flash';
  return model;
}

export const geminiService = {
  id: 'gemini',

  isConfigured() {
    return Boolean(env.geminiApiKey);
  },

  async completeChat({
    model,
    system,
    userContent,
    temperature = 0.45,
    maxTokens = 4096,
    timeoutMs,
  }) {
    if (!env.geminiApiKey) {
      throw createAiError('GEMINI_API_KEY is not configured', {
        code: 'invalid_api_key',
        status: 401,
        provider: 'gemini',
      });
    }

    const cfg = getModelConfig();
    const geminiModel = mapGeminiModel(model);
    const baseUrl = (env.geminiBaseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(
      /\/$/,
      '',
    );
    const url = `${baseUrl}/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || cfg.timeoutMs);

    const userText =
      typeof userContent === 'string' ? userContent : JSON.stringify(userContent);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });

      const errText = !res.ok ? await res.text() : null;
      if (!res.ok) {
        const error = createAiError(`Gemini HTTP ${res.status}`, {
          code: 'gemini_http',
          status: res.status,
          provider: 'gemini',
        });
        error.body = errText;
        Object.assign(error, formatAiError(error, 'gemini'));
        throw error;
      }

      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts.map((p) => p.text || '').join('\n') || '';
      if (!text) {
        throw createAiError('Gemini returned empty content', {
          code: 'invalid_response',
          status: 400,
          provider: 'gemini',
        });
      }

      const meta = data.usageMetadata || {};
      return {
        text,
        usage: {
          promptTokens: meta.promptTokenCount ?? 0,
          completionTokens: meta.candidatesTokenCount ?? 0,
          totalTokens: meta.totalTokenCount ?? 0,
        },
        model: data.modelVersion || geminiModel,
        provider: 'gemini',
        raw: data,
      };
    } catch (err) {
      if (err?.name === 'AbortError') {
        const timeoutErr = createAiError('Gemini request timed out', {
          code: 'timeout',
          status: 504,
          provider: 'gemini',
        });
        Object.assign(timeoutErr, formatAiError(timeoutErr, 'gemini'));
        throw timeoutErr;
      }
      if (err?.provider === 'gemini' || err?.code) throw err;
      const wrapped = createAiError(err.message || 'Gemini unavailable', {
        code: 'server_error',
        status: 503,
        provider: 'gemini',
        cause: err,
      });
      Object.assign(wrapped, formatAiError(wrapped, 'gemini'));
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
        const info = formatAiError(err, 'gemini');
        if (!info.retryable || attempt >= cfg.maxRetries) {
          throw Object.assign(err, info);
        }
        await sleep(cfg.retryDelayMs * attempt);
      }
    }
    throw lastError;
  },
};
