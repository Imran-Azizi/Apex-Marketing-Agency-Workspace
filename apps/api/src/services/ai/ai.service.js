/**
 * APEX content AI orchestrator.
 * Frontend never talks to OpenRouter — only this backend layer does.
 */

import { env } from '../../config/env.js';
import {
  CONTENT_AGENTS,
  PROMPT_VERSION,
  getModelConfig,
  resolveGenerationParams,
  resolveModelsForAgent,
} from './models.config.js';
import { getAgentPrompt } from './prompts/index.js';
import { getLlmProvider, getActiveProviderInfo } from './provider.factory.js';
import { extractJson, validateAgentOutput, normalizePipelineOutputs } from './validate.js';
import { formatAiError, createAiError } from './errors.js';
import { mockOutput } from './mock.service.js';

/**
 * Shrink project input to control tokens / cost before LLM calls.
 */
export function sanitizeAiInput(input = {}) {
  const previousVersions = Array.isArray(input.previousVersions)
    ? input.previousVersions.slice(0, 2).map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        status: v.status,
        changeNotes: v.changeNotes || null,
      }))
    : [];

  const assets = Array.isArray(input.assets)
    ? input.assets.slice(0, 20).map((a) => ({
        source: a.source,
        kind: a.kind,
        name: a.name,
      }))
    : [];

  const priorOutputs = input.priorOutputs
    ? {
        scenario: input.priorOutputs.scenario || null,
        narration: input.priorOutputs.narration || null,
        storyboard: input.priorOutputs.storyboard || null,
      }
    : undefined;

  return {
    projectId: input.projectId,
    code: input.code,
    title: input.title,
    status: input.status,
    brief: input.brief,
    durationSec: input.durationSec,
    language: input.language,
    tone: input.tone,
    platforms: input.platforms,
    service: input.service,
    format: input.format,
    customer: input.customer,
    assets,
    previousVersions,
    managerNotes: input.managerNotes || null,
    // Keep context compact
    contextSummary:
      typeof input.contextMd === 'string'
        ? input.contextMd.slice(0, 4000)
        : input.context || null,
    priorOutputs,
  };
}

async function completeWithModelFallback({
  provider,
  agentType,
  system,
  userContent,
  modelOverride,
}) {
  const models = resolveModelsForAgent(agentType, modelOverride);
  const params = resolveGenerationParams(agentType);
  let lastError;

  for (const model of models) {
    try {
      const result = await provider.completeChatWithRetry({
        model,
        system,
        userContent,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
        responseFormat: params.responseFormat,
        timeoutMs: params.timeoutMs,
      });
      return result;
    } catch (err) {
      lastError = err;
      const info = formatAiError(err, provider.id);
      // Try backup model on not-found / server errors; stop on auth/quota.
      if (
        info.code === 'invalid_api_key' ||
        info.code === 'insufficient_quota' ||
        info.code === 'bad_request'
      ) {
        throw Object.assign(err, info);
      }
    }
  }

  throw lastError || createAiError('All AI models failed', { provider: provider.id });
}

/**
 * Run a single content agent (SCENARIO | NARRATION | STORYBOARD).
 */
export async function runAgent({
  agentType,
  input,
  promptVersion = PROMPT_VERSION,
  promptTemplate,
  model,
} = {}) {
  if (!CONTENT_AGENTS.includes(agentType)) {
    throw createAiError(`Unsupported agent: ${agentType}`, {
      code: 'bad_request',
      status: 400,
    });
  }

  const cfg = getModelConfig();
  const providerInfo = getActiveProviderInfo();
  const def = getAgentPrompt(agentType);
  const system = [
    promptTemplate || def.system,
    `Prompt version: ${promptVersion}.`,
    `Always include projectId=${input?.projectId} in the JSON response.`,
    'Return valid JSON only.',
  ].join('\n\n');

  const safeInput = sanitizeAiInput(input);
  const started = Date.now();

  // Explicit mock provider
  if (cfg.provider === 'mock' || providerInfo.id === 'mock') {
    const output = validateAgentOutput(agentType, mockOutput(agentType, input), input?.projectId);
    return {
      model: 'mock-apex-v5',
      promptVersion,
      output,
      provider: 'mock',
      tokenUsage: null,
      durationMs: Date.now() - started,
      feature: agentType,
    };
  }

  const provider = getLlmProvider();
  if (!provider.isConfigured()) {
    if (cfg.allowMockFallback) {
      const output = validateAgentOutput(
        agentType,
        mockOutput(agentType, input),
        input?.projectId,
      );
      return {
        model: 'mock-fallback',
        promptVersion,
        output,
        provider: 'mock',
        tokenUsage: null,
        durationMs: Date.now() - started,
        feature: agentType,
        usedFallback: true,
        fallbackCode: 'invalid_api_key',
        fallbackError: `کلید API برای ${provider.id} تنظیم نشده است.`,
      };
    }
    throw createAiError(`AI provider ${provider.id} is not configured`, {
      code: 'invalid_api_key',
      status: 401,
      provider: provider.id,
    });
  }

  try {
    const completion = await completeWithModelFallback({
      provider,
      agentType,
      system,
      userContent: safeInput,
      modelOverride: model,
    });

    const parsed = extractJson(completion.text);
    if (parsed && typeof parsed === 'object' && !parsed.projectId && input?.projectId) {
      parsed.projectId = input.projectId;
    }

    const output = validateAgentOutput(agentType, parsed, input?.projectId);

    return {
      model: completion.model,
      promptVersion,
      output,
      provider: completion.provider || provider.id,
      tokenUsage: completion.usage,
      durationMs: Date.now() - started,
      feature: agentType,
    };
  } catch (err) {
    const info = formatAiError(err, provider.id);
    if (cfg.allowMockFallback) {
      const output = validateAgentOutput(
        agentType,
        mockOutput(agentType, input),
        input?.projectId,
      );
      return {
        model: 'mock-fallback',
        promptVersion,
        output,
        provider: 'mock',
        tokenUsage: null,
        durationMs: Date.now() - started,
        feature: agentType,
        usedFallback: true,
        fallbackCode: info.code,
        fallbackError: info.messageFa,
      };
    }
    const failed = createAiError(info.messageFa || err.message, {
      code: info.code,
      status: info.status || 502,
      provider: provider.id,
      cause: err,
    });
    Object.assign(failed, info);
    throw failed;
  }
}

/**
 * Full pipeline: Scenario → Narration → Storyboard.
 */
export async function generatePipeline({
  input,
  promptVersion = PROMPT_VERSION,
  agentTemplates = {},
  onStep,
} = {}) {
  const cfg = getModelConfig();
  const providerInfo = getActiveProviderInfo();
  const outputs = {};
  const stepResults = [];
  let model = cfg.defaultModel;
  let provider = providerInfo.id;
  let totalTokens = 0;
  let fallbackError = null;
  let fallbackCode = null;
  let enrichedInput = { ...input };

  for (const agentType of CONTENT_AGENTS) {
    if (typeof onStep === 'function') {
      await onStep({ agentType, status: 'RUNNING' });
    }

    let result;
    try {
      result = await runAgent({
        agentType,
        input: enrichedInput,
        promptVersion,
        promptTemplate: agentTemplates[agentType],
      });
    } catch (err) {
      const info = formatAiError(err, providerInfo.id);
      if (typeof onStep === 'function') {
        await onStep({
          agentType,
          status: 'FAILED',
          error: info.messageFa || err.message,
          code: info.code,
        });
      }
      throw Object.assign(err, info);
    }

    const key = agentType.toLowerCase();
    const output = result.output;
    outputs[key] = output;

    stepResults.push({
      agentType,
      key,
      feature: agentType,
      model: result.model,
      provider: result.provider,
      tokenUsage: result.tokenUsage,
      durationMs: result.durationMs,
      fallbackError: result.fallbackError || null,
      fallbackCode: result.fallbackCode || null,
      usedFallback: Boolean(result.usedFallback),
    });

    enrichedInput = {
      ...enrichedInput,
      priorOutputs: { ...outputs },
    };

    if (result.usedFallback) {
      provider = 'mock-fallback';
      fallbackError = result.fallbackError || fallbackError;
      fallbackCode = result.fallbackCode || fallbackCode;
    } else if (result.provider) {
      provider = result.provider;
    }
    if (result.model) model = result.model;
    if (result.tokenUsage?.totalTokens) totalTokens += result.tokenUsage.totalTokens;

    if (typeof onStep === 'function') {
      await onStep({
        agentType,
        status: 'COMPLETED',
        result: { ...result, output },
        key,
      });
    }
  }

  const normalizedOutputs = normalizePipelineOutputs(outputs, input?.projectId);

  return {
    provider,
    model,
    steps: stepResults,
    outputs: normalizedOutputs,
    totalTokens,
    fallbackError,
    fallbackCode,
    usedFallback: Boolean(fallbackError) || provider === 'mock-fallback',
    promptVersion,
  };
}

/** Compatibility facade used by modules/ai/service.js */
export const aiProvider = {
  PROMPT_VERSION,
  getAgentPrompt,
  mockOutput,
  run: runAgent,
  generatePipeline,
  generatePipelineLocal: generatePipeline,
  async generateImagesFromPrompts(prompts = [], { size = '1024x1024' } = {}) {
    // Images remain OpenAI-direct optional; OpenRouter path focuses on text content.
    if (!env.openaiApiKey || env.aiProvider === 'mock') {
      return {
        provider: 'mock',
        images: prompts.slice(0, 3).map((p, i) => ({ prompt: p, index: i, url: null })),
      };
    }
    const images = [];
    for (const [index, prompt] of prompts.slice(0, 4).entries()) {
      try {
        const res = await fetch(`${env.openaiBaseUrl}/images/generations`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: env.openaiImageModel,
            prompt,
            size,
            n: 1,
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          images.push({ index, prompt, error: errText.slice(0, 200), url: null });
          continue;
        }
        const data = await res.json();
        const item = data.data?.[0] || {};
        images.push({
          index,
          prompt,
          url: item.url || null,
          b64: item.b64_json || null,
        });
      } catch (err) {
        images.push({ index, prompt, error: err.message, url: null });
      }
    }
    return { provider: 'openai', model: env.openaiImageModel, images };
  },
};

export const contentAiService = {
  runAgent,
  generatePipeline,
  sanitizeAiInput,
  getModelConfig,
  getActiveProviderInfo,
};

export { formatAiError };
