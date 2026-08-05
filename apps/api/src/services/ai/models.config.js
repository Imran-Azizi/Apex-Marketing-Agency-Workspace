/**
 * Central AI model configuration.
 * Change models / temperature / tokens here — not in business logic.
 */

import { env } from '../../config/env.js';

export const PROMPT_VERSION = 'v5-openrouter';

export const CONTENT_AGENTS = Object.freeze(['SCENARIO', 'NARRATION', 'STORYBOARD']);

/** @typedef {'SCENARIO' | 'NARRATION' | 'STORYBOARD'} ContentAgentType */

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
    maxTokens: Number(env.aiMaxTokens ?? 4096),
    timeoutMs: Number(env.aiRequestTimeoutMs ?? 120_000),
    maxRetries: Number(env.aiMaxRetries ?? env.openaiMaxRetries ?? 3),
    retryDelayMs: Number(env.aiRetryDelayMs ?? env.openaiRetryDelayMs ?? 800),
    responseFormat: { type: 'json_object' },
    allowMockFallback: env.aiAllowMockFallback === true,
    siteUrl: env.webUrl || 'http://localhost:3000',
    siteName: 'APEX Workspace',
    /** Per-feature overrides (null model = use default/backup) */
    features: {
      SCENARIO: {
        temperature: 0.5,
        maxTokens: 4096,
        model: env.aiModelScenario || null,
      },
      NARRATION: {
        temperature: 0.4,
        maxTokens: 2048,
        model: env.aiModelNarration || null,
      },
      STORYBOARD: {
        temperature: 0.4,
        maxTokens: 4096,
        model: env.aiModelStoryboard || null,
      },
    },
  };
}

/**
 * Resolve primary + backup model list for an agent.
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
