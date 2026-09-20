/**
 * Provider factory — switch AI backends via AI_PROVIDER without rewriting app logic.
 *
 * Supported: openrouter | openai | anthropic | gemini | mock
 */

import { env } from '../../config/env.js';
import { resolveModelsForAgent } from './models.config.js';
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

function demoteLightweight(models) {
  const list = [...new Set((models || []).filter(Boolean))];
  const light = (id) =>
    /mini|lite|nano|haiku|flash-lite|:free$/i.test(String(id || ''));
  const strong = list.filter((id) => !light(id));
  const weak = list.filter((id) => light(id));
  return strong.length ? [...strong, ...weak] : list;
}

export function listProviders() {
  return Object.keys(PROVIDERS);
}

export function getProviderById(id) {
  return PROVIDERS[id] || null;
}

/**
 * Primary provider first, then any other configured backends.
 * Lets content generation survive OpenRouter outages/quota by using Gemini or OpenAI.
 */
export function listConfiguredLlmProviders(override) {
  const primaryId = String(override || env.aiProvider || 'openrouter').toLowerCase();
  const ordered = [primaryId, 'openrouter', 'gemini', 'openai', 'anthropic'];
  const seen = new Set();
  const list = [];
  for (const id of ordered) {
    if (seen.has(id) || id === 'mock') continue;
    seen.add(id);
    const provider = PROVIDERS[id];
    if (provider?.isConfigured()) list.push(provider);
  }
  return list;
}

/**
 * Native models for a provider — never send OpenRouter slugs to Gemini/OpenAI.
 * Quality content agents lead with reasoning models, not flash-lite / mini.
 */
export function modelsForProvider(providerId, agentType, modelOverride) {
  if (providerId === 'openrouter') {
    return resolveModelsForAgent(agentType, modelOverride);
  }
  if (providerId === 'gemini') {
    return demoteLightweight([
      env.geminiModelReasoning || env.geminiModel,
      env.geminiModelLight,
    ]);
  }
  if (providerId === 'openai') {
    return demoteLightweight([
      env.openaiModelReasoning || env.openaiModel,
      env.openaiModelLight,
    ]);
  }
  if (providerId === 'anthropic') {
    return [env.anthropicModel].filter(Boolean);
  }
  return [];
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
