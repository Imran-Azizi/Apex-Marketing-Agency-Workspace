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
import { openRouterService } from './openrouter.service.js';
import { extractJson, validateAgentOutput, normalizePipelineOutputs } from './validate.js';
import { formatAiError, createAiError } from './errors.js';
import { mockOutput } from './mock.service.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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
    userInstructions: input.userInstructions || null,
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
  const initialPriorOutputs =
    input?.priorOutputs && typeof input.priorOutputs === 'object'
      ? { ...input.priorOutputs }
      : null;
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
      priorOutputs: {
        ...(initialPriorOutputs || {}),
        ...outputs,
      },
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
  async generateImagesFromPrompts(
    prompts = [],
    { size = '1920x1080', seeds = [], enhance = false } = {},
  ) {
    const list = Array.isArray(prompts) ? prompts.map((p) => String(p || '')) : [];
    if (!list.length) {
      return { provider: 'none', model: null, images: [] };
    }

    if (env.aiProvider === 'mock') {
      return {
        provider: 'mock',
        model: 'mock-image',
        images: list.map((prompt, index) => ({
          index,
          prompt,
          url: null,
          b64: null,
        })),
      };
    }

    const parseSize = (raw) => {
      const m = String(raw || '').match(/^(\d+)\s*x\s*(\d+)$/i);
      if (!m) return { width: 1920, height: 1080 };
      return {
        width: Math.min(1920, Math.max(720, Number(m[1]))),
        height: Math.min(1080, Math.max(405, Number(m[2]))),
      };
    };

    async function generateViaOpenAI(promptList) {
      if (!env.openaiApiKey) return null;
      const images = [];
      const batchSize = 4;
      for (let start = 0; start < promptList.length; start += batchSize) {
        const batch = promptList.slice(start, start + batchSize);
        await Promise.all(
          batch.map(async (prompt, batchIndex) => {
            const index = start + batchIndex;
            if (!String(prompt || '').trim()) {
              images.push({ index, prompt, error: 'Empty image prompt', url: null });
              return;
            }
            try {
              const res = await fetch(`${env.openaiBaseUrl}/images/generations`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${env.openaiApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: env.openaiImageModel,
                  prompt: String(prompt).slice(0, 3200),
                  size,
                  n: 1,
                }),
              });
              if (!res.ok) {
                const errText = await res.text();
                images.push({
                  index,
                  prompt,
                  error: errText.slice(0, 240),
                  url: null,
                });
                return;
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
          }),
        );
      }
      images.sort((a, b) => a.index - b.index);
      return { provider: 'openai', model: env.openaiImageModel, images };
    }

    async function generateViaOpenRouter(promptList) {
      if (!env.openrouterApiKey) return null;
      const model = env.openrouterImageModel;
      const images = [];
      const batchSize = 3;
      for (let start = 0; start < promptList.length; start += batchSize) {
        const batch = promptList.slice(start, start + batchSize);
        await Promise.all(
          batch.map(async (prompt, batchIndex) => {
            const index = start + batchIndex;
            if (!String(prompt || '').trim()) {
              images.push({ index, prompt, error: 'Empty image prompt', url: null });
              return;
            }
            try {
              const result = await openRouterService.generateImage({
                prompt,
                model,
                size,
              });
              images.push({
                index,
                prompt,
                url: result.url || null,
                b64: result.b64 || null,
              });
            } catch (err) {
              images.push({
                index,
                prompt,
                error: err.body
                  ? `${err.message}: ${String(err.body).slice(0, 180)}`
                  : err.message,
                url: null,
              });
            }
          }),
        );
      }
      images.sort((a, b) => a.index - b.index);
      return { provider: 'openrouter', model, images };
    }

    /** Free Pollinations image API. GET image bytes only — JSON URLs are often a default portrait. */
    async function generateViaPollinations(promptList) {
      const { width, height } = parseSize(size);
      const model =
        env.pollinationsImageModel && env.pollinationsImageModel !== 'flux'
          ? env.pollinationsImageModel
          : 'flux-realism';
      const images = [];

      async function fetchImageBytes(url, headers) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 120_000);
        try {
          const res = await fetch(url, {
            method: 'GET',
            headers: {
              Accept: 'image/jpeg,image/png,image/webp,image/*',
              Referer: 'https://pollinations.ai/',
              ...headers,
            },
            signal: controller.signal,
            redirect: 'follow',
          });
          const contentType = res.headers.get('content-type') || '';
          if (!res.ok) {
            return { error: `Pollinations HTTP ${res.status}` };
          }
          if (contentType.includes('application/json') || contentType.includes('text/html')) {
            return { error: 'Pollinations returned non-image response' };
          }
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length < 12000) {
            return { error: 'Pollinations returned empty or tiny image' };
          }
          const magic = buf.slice(0, 3).toString('hex');
          const isImage =
            magic === 'ffd8ff' ||
            magic === '89504e' ||
            contentType.startsWith('image/');
          if (!isImage) {
            return { error: 'Pollinations payload was not an image' };
          }
          return {
            b64: buf.toString('base64'),
            url: null,
            contentType: contentType.startsWith('image/') ? contentType : 'image/jpeg',
          };
        } catch (err) {
          return { error: err.message || 'Pollinations unavailable' };
        } finally {
          clearTimeout(timer);
        }
      }

      for (let index = 0; index < promptList.length; index += 1) {
        const rawPrompt = String(promptList[index] || '').replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
        if (!rawPrompt) {
          images.push({ index, prompt: rawPrompt, error: 'Empty image prompt', url: null });
          continue;
        }
        if (index > 0) await sleep(2000);
        const seed = Number.isFinite(seeds[index])
          ? Math.floor(seeds[index])
          : Math.floor(Math.random() * 1_000_000_000);
        const encoded = encodeURIComponent(rawPrompt.slice(0, 720));
        const params = new URLSearchParams({
          width: String(Math.min(Math.max(width, 1280), 1920)),
          height: String(Math.min(Math.max(height, 720), 1080)),
          model,
          nologo: 'true',
          enhance: 'false',
          private: 'true',
          seed: String(seed),
        });
        const headers = {};
        if (env.pollinationsApiKey) {
          headers.Authorization = `Bearer ${env.pollinationsApiKey}`;
        }
        const endpoints = [
          `https://image.pollinations.ai/prompt/${encoded}?${params}`,
          `https://gen.pollinations.ai/image/${encoded}?${params}`,
        ];
        let result = null;
        for (const url of endpoints) {
          result = await fetchImageBytes(url, headers);
          if (result?.b64) break;
        }
        if (result?.b64) {
          images.push({
            index,
            prompt: rawPrompt,
            url: null,
            b64: result.b64,
            contentType: result.contentType,
          });
        } else {
          images.push({
            index,
            prompt: rawPrompt,
            error: result?.error || 'Pollinations image failed',
            url: null,
          });
        }
      }

      return { provider: 'pollinations', model, images };
    }

    const hasSuccess = (result) =>
      Boolean(result?.images?.some((img) => img.url || img.b64));

    const mode = env.aiImageProvider || 'auto';

    if (mode === 'free' || mode === 'pollinations') {
      return (await generateViaPollinations(list)) || {
        provider: 'pollinations',
        model: env.pollinationsImageModel,
        images: list.map((prompt, index) => ({
          index,
          prompt,
          url: null,
          b64: null,
        })),
      };
    }

    if (mode === 'openai') {
      return (
        (await generateViaOpenAI(list)) || {
          provider: 'mock',
          model: 'mock-image',
          images: list.map((prompt, index) => ({
            index,
            prompt,
            url: null,
            b64: null,
          })),
        }
      );
    }

    if (mode === 'openrouter') {
      const orResult = await generateViaOpenRouter(list);
      if (hasSuccess(orResult)) return orResult;
      const freeResult = await generateViaPollinations(list);
      if (hasSuccess(freeResult)) return freeResult;
      return (
        orResult || {
          provider: 'openrouter',
          model: env.openrouterImageModel,
          images: list.map((prompt, index) => ({
            index,
            prompt,
            error: 'OpenRouter image failed',
            url: null,
          })),
        }
      );
    }

    // auto: OpenRouter → OpenAI → free Pollinations
    const orResult = await generateViaOpenRouter(list);
    if (hasSuccess(orResult)) return orResult;

    const openaiResult = await generateViaOpenAI(list);
    if (hasSuccess(openaiResult)) return openaiResult;

    const freeResult = await generateViaPollinations(list);
    if (hasSuccess(freeResult)) return freeResult;

    return (
      orResult ||
      openaiResult || {
        provider: 'mock',
        model: 'mock-image',
        images: list.map((prompt, index) => ({
          index,
          prompt,
          url: null,
          b64: null,
        })),
      }
    );
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
