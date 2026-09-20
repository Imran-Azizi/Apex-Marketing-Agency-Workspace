/**
 * Central AI model configuration.
 * Change models / temperature / tokens here — not in business logic.
 *
 * Scenario / Narration / Storyboard run on the OpenRouter free-model catalog
 * by default (see openrouter-free-models.js). Paid models are optional fallback
 * only when admin settings allow them.
 */

import { env } from '../../config/env.js';

export const PROMPT_VERSION = 'v8-quality-speed';

export const CONTENT_AGENTS = Object.freeze(['SCENARIO', 'NARRATION', 'STORYBOARD']);

/**
 * Content agents that get richer prompts, stricter consistency rules,
 * and the best-ranked free models from the live catalog.
 */
export const QUALITY_CONTENT_AGENTS = Object.freeze([
  'SCENARIO',
  'NARRATION',
  'STORYBOARD',
]);

/** @typedef {'SCENARIO' | 'NARRATION' | 'STORYBOARD'} ContentAgentType */

export function isQualityContentAgent(agentType) {
  return QUALITY_CONTENT_AGENTS.includes(agentType);
}

export function getModelConfig() {
  const defaultModel =
    env.aiDefaultModel ||
    env.openrouterModel ||
    env.openaiModelReasoning ||
    'anthropic/claude-sonnet-4';

  const backupModel =
    env.aiBackupModel ||
    env.openrouterBackupModel ||
    'openai/gpt-4o-mini';

  return {
    provider: (env.aiProvider || 'openrouter').toLowerCase(),
    defaultModel,
    backupModel,
    temperature: Number(env.aiTemperature ?? 0.45),
    // Free models often cap completion size; keep requests within a practical range.
    maxTokens: Number(env.aiMaxTokens ?? 3072),
    timeoutMs: Number(env.aiRequestTimeoutMs ?? 120_000),
    maxRetries: Number(env.aiMaxRetries ?? env.openaiMaxRetries ?? 3),
    retryDelayMs: Number(env.aiRetryDelayMs ?? env.openaiRetryDelayMs ?? 800),
    responseFormat: { type: 'json_object' },
    allowMockFallback: env.aiAllowMockFallback === true,
    // false = content pipeline stays on free OpenRouter models (default).
    contentPreferQuality: env.aiContentPreferQuality === true,
    siteUrl: env.webUrl || 'http://localhost:3000',
    siteName: 'APEX Workspace',
    /** Per-feature overrides (null model = use free catalog / default) */
    features: {
      SCENARIO: {
        temperature: 0.55,
        maxTokens: 3072,
        model: env.aiModelScenario || null,
        modelTier: 'reasoning',
      },
      NARRATION: {
        temperature: 0.45,
        maxTokens: 2048,
        model: env.aiModelNarration || null,
        modelTier: 'reasoning',
      },
      STORYBOARD: {
        temperature: 0.4,
        maxTokens: 3072,
        model: env.aiModelStoryboard || null,
        modelTier: 'reasoning',
      },
      PORTFOLIO: {
        temperature: 0.55,
        maxTokens: 2560,
        model: env.aiModelPortfolio || null,
      },
      SALES_ASSISTANT: {
        temperature: 0.25,
        maxTokens: 2048,
        model: env.aiModelSalesAssistant || null,
      },
      BUSINESS_ASSISTANT: {
        temperature: 0.3,
        maxTokens: 3072,
        model: env.aiModelBusinessAssistant || null,
      },
    },
  };
}

/**
 * Resolve primary + backup model list for an agent (paid / non-free path).
 * Free-only mode ignores these and uses the live free catalog instead.
 * @param {ContentAgentType} agentType
 * @param {string} [modelOverride]
 */
export function resolveModelsForAgent(agentType, modelOverride) {
  const cfg = getModelConfig();
  const feature = cfg.features[agentType] || {};
  const primary = modelOverride || feature.model || cfg.defaultModel;
  const list = [primary, cfg.backupModel, cfg.defaultModel].filter(Boolean);
  return [...new Set(list)];
}

/**
 * @param {ContentAgentType} agentType
 */
export function resolveGenerationParams(agentType) {
  const cfg = getModelConfig();
  const feature = cfg.features[agentType] || {};
  return {
    temperature: feature.temperature ?? cfg.temperature,
    maxTokens: feature.maxTokens ?? cfg.maxTokens,
    responseFormat: cfg.responseFormat,
    timeoutMs: cfg.timeoutMs,
  };
}
