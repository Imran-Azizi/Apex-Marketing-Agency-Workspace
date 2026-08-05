/**
 * Provider factory — switch AI backends via AI_PROVIDER without rewriting app logic.
 *
 * Supported: openrouter | openai | anthropic | gemini | mock
 */

import { env } from '../../config/env.js';
import { openRouterService } from './openrouter.service.js';
import { openAiService } from './openai.service.js';
import { anthropicService } from './anthropic.service.js';
import { geminiService } from './gemini.service.js';
import { mockService } from './mock.service.js';
import { createAiError } from './errors.js';

const PROVIDERS = {
  openrouter: openRouterService,
  openai: openAiService,
  anthropic: anthropicService,
  gemini: geminiService,
  mock: mockService,
};

export function listProviders() {
  return Object.keys(PROVIDERS);
}

export function getProviderById(id) {
  return PROVIDERS[id] || null;
}

/**
 * Resolve the active LLM provider from env.
 * @param {string} [override]
 */
export function getLlmProvider(override) {
  const id = String(override || env.aiProvider || 'openrouter').toLowerCase();
  const provider = PROVIDERS[id];
  if (!provider) {
    throw createAiError(`Unknown AI provider: ${id}`, {
      code: 'bad_request',
      status: 400,
      provider: id,
    });
  }
  return provider;
}

export function getActiveProviderInfo() {
  const provider = getLlmProvider();
  return {
    id: provider.id,
    configured: provider.isConfigured(),
  };
}
