/**
 * APEX content AI orchestrator.
 * Frontend never talks to OpenRouter — only this backend layer does.
 */

import { env } from '../../config/env.js';
import {
  CONTENT_AGENTS,
  PROMPT_VERSION,
  getModelConfig,
  isQualityContentAgent,
  resolveGenerationParams,
} from './models.config.js';
import { getAgentPrompt } from './prompts/index.js';
import {
  getActiveProviderInfo,
  listConfiguredLlmProviders,
  modelsForProvider,
} from './provider.factory.js';
import { openRouterService } from './openrouter.service.js';
import { extractJson, validateAgentOutput, normalizePipelineOutputs, synthesizeStoryboardFromInput } from './validate.js';
import { formatAiError, createAiError } from './errors.js';
import { mockOutput } from './mock.service.js';
import { buildLanguageToneDirectives } from './language.js';
import {
  capFreeMaxTokens,
  clearFreeModelCooldown,
  cooldownMsForError,
  getFreeModelRuntime,
  isCatalogModelFree,
  markFreeModelUnavailable,
  resolveFreeModelsForTask,
} from './openrouter-free-models.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const USER_PROMPT_SAFE = 4000;

function clipText(value, max = 600) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

/**
 * Surface the brief fields that drive project-specific creative work.
 */
function summarizeBrief(brief) {
  const b = asPlainObject(brief);
  if (!b) return null;
  const pick = (...keys) => {
    for (const key of keys) {
      const v = b[key];
      if (v == null) continue;
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (Array.isArray(v) && v.length) {
        return v
          .map((item) => (typeof item === 'string' ? item : item?.label || item?.name || ''))
          .filter(Boolean)
          .slice(0, 12);
      }
      if (typeof v === 'number' || typeof v === 'boolean') return v;
    }
    return undefined;
  };
  const summary = {
    productName: pick('productName', 'product', 'brandName', 'brand'),
    productDescription: clipText(
      pick('productDescription', 'description', 'about', 'summary'),
      900,
    ),
    features: pick('features', 'keyFeatures', 'benefits'),
    audience: pick('audience', 'targetAudience', 'target'),
    goal: pick('goal', 'objective', 'marketingGoal'),
    mainMessage: pick('mainMessage', 'message', 'keyMessage'),
    cta: pick('cta', 'callToAction'),
    contact: pick('contact', 'phone', 'whatsapp', 'website'),
    allowedClaims: pick('allowedClaims', 'claims'),
    mandatoryTexts: pick('mandatoryTexts', 'mustInclude', 'requiredTexts'),
    brandLimits: pick('brandLimits', 'brandGuidelines', 'restrictions'),
  };
  // Drop empty keys
  for (const key of Object.keys(summary)) {
    const v = summary[key];
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) delete summary[key];
  }
  return Object.keys(summary).length ? summary : null;
}

function summarizeScenario(scenario) {
  const s = asPlainObject(scenario);
  if (!s) return null;
  return {
    title: s.title || null,
    concept: clipText(s.concept, 400) || null,
    hook: clipText(s.hook, 280) || null,
    problem: clipText(s.problem, 280) || null,
    solution: clipText(s.solution, 280) || null,
    cta: clipText(s.cta, 160) || null,
    storyFlow: clipText(s.storyFlow || s.content, 900) || null,
    emotionalDirection: clipText(s.emotionalDirection, 160) || null,
    marketingAngle: clipText(s.marketingAngle, 200) || null,
    totalDurationSec: s.totalDurationSec || null,
    sceneCount: Array.isArray(s.sceneBreakdown) ? s.sceneBreakdown.length : null,
  };
}

function summarizeNarration(narration) {
  const n = asPlainObject(narration);
  if (!n) return null;
  return {
    tone: n.tone || null,
    language: n.language || null,
    estimatedSeconds: n.estimatedSeconds || n.estimated_duration || null,
    script: clipText(n.script, 1200) || null,
  };
}

function summarizeStoryboard(storyboard) {
  const sb = asPlainObject(storyboard);
  if (!sb) return null;
  const scenes = Array.isArray(sb.scenes) ? sb.scenes : [];
  return {
    visualStyleGuide: clipText(sb.visualStyleGuide, 240) || null,
    sceneCount: scenes.length,
    scenes: scenes.slice(0, 8).map((scene, idx) => ({
      scene_number: scene.scene_number || idx + 1,
      title: scene.title || null,
      duration: scene.duration || null,
      visual: clipText(scene.visual, 180) || null,
      action: clipText(scene.action, 140) || null,
    })),
  };
}

/**
 * Shrink project input to control tokens while keeping enough brief/context
 * for project-specific Scenario → Narration → Storyboard generation.
 */
export function sanitizeAiInput(input = {}) {
  const previousVersions = Array.isArray(input.previousVersions)
    ? input.previousVersions.slice(0, 2).map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        status: v.status,
        changeNotes: v.changeNotes || null,
        scenario: summarizeScenario(v.scenario),
        narration: summarizeNarration(v.narration),
        storyboard: summarizeStoryboard(v.storyboard),
      }))
    : [];

  const assets = Array.isArray(input.assets)
    ? input.assets.slice(0, 24).map((a) => ({
        source: a.source,
        kind: a.kind,
        name: a.name,
      }))
    : [];

  const clientFeedback = Array.isArray(input.clientFeedback)
    ? input.clientFeedback.slice(0, 5).map((f) => ({
        section: f.section || f.targetSection || f.scope || null,
        status: f.status || null,
        body: clipText(f.body || f.message || f.comment || f.note, 400),
        createdAt: f.createdAt || null,
      })).filter((f) => f.body)
    : [];

  const priorOutputs = input.priorOutputs
    ? {
        scenario: input.priorOutputs.scenario || null,
        narration: input.priorOutputs.narration || null,
        storyboard: input.priorOutputs.storyboard || null,
      }
    : undefined;

  const briefSummary = summarizeBrief(input.brief);
  const contextSummary =
    typeof input.contextMd === 'string'
      ? input.contextMd.slice(0, 2800)
      : typeof input.context === 'string'
        ? clipText(input.context, 2800)
        : null;
  const languageTone = buildLanguageToneDirectives({
    language: input.language,
    tone: input.tone,
  });

  // Prefer compact briefSummary for tokens; keep a lean brief only when summary is thin.
  const leanBrief = briefSummary
    ? undefined
    : asPlainObject(input.brief)
      ? {
          productName: input.brief.productName || input.brief.product || null,
          productDescription: clipText(
            input.brief.productDescription || input.brief.description,
            500,
          ),
          audience: input.brief.audience || input.brief.targetAudience || null,
          goal: input.brief.goal || input.brief.objective || null,
          mainMessage: input.brief.mainMessage || input.brief.message || null,
          cta: input.brief.cta || input.brief.callToAction || null,
        }
      : input.brief;

  return {
    projectId: input.projectId,
    code: input.code,
    title: input.title,
    status: input.status,
    brief: leanBrief,
    briefSummary,
    durationSec: input.durationSec,
    language: languageTone.language.code,
    languageLabel: languageTone.language.label,
    tone: languageTone.tone.selectedTone || null,
    languagePolicy: languageTone.language,
    tonePolicy: languageTone.tone,
    languageInstruction: languageTone.languageInstruction,
    toneInstruction: languageTone.toneInstruction,
    platforms: input.platforms,
    service: input.service,
    format: input.format,
    customer: input.customer,
    assets,
    previousVersions,
    clientFeedback: clientFeedback.length ? clientFeedback : undefined,
    managerNotes: clipText(input.managerNotes, 1200) || null,
    userInstructions: clipText(input.userInstructions, USER_PROMPT_SAFE) || null,
    consistencyRules: input.consistencyRules || {
      pipeline: 'SCENARIO → NARRATION → STORYBOARD',
      requireProjectSpecific: true,
      forbidGenericTemplates: true,
      alignWithPriorOutputs: Boolean(priorOutputs?.scenario || priorOutputs?.narration),
      lockLanguage: true,
      lockTone: true,
      writingStyle: 'simple-clear-professional',
    },
    contextSummary,
    priorOutputs,
    revisionOfVersionId: input.revisionOfVersionId || null,
    revisionOfVersionNumber: input.revisionOfVersionNumber || null,
  };
}

function parseAgentCompletion(agentType, text, projectId, context = {}) {
  const parsed = extractJson(text);
  if (!parsed || typeof parsed !== 'object' || parsed.raw) {
    const err = createAiError('پاسخ هوش مصنوعی معتبر نبود. دوباره تولید کنید.', {
      code: 'invalid_response',
      status: 400,
    });
    throw err;
  }
  if (projectId && !parsed.projectId) parsed.projectId = projectId;
  return validateAgentOutput(agentType, parsed, projectId, context);
}

async function completeWithPaidProviders({
  agentType,
  system,
  userContent,
  modelOverride,
  params,
  accept,
}) {
  const providers = listConfiguredLlmProviders();
  let lastError;

  for (const provider of providers) {
    const models = modelsForProvider(provider.id, agentType, modelOverride);
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
        if (typeof accept === 'function') {
          result.parsed = accept(result);
        }
        if (provider.id !== (env.aiProvider || 'openrouter')) {
          console.warn(
            `[AI] fell back to ${provider.id}/${model} after ${lastError?.message || 'primary failure'}`,
          );
        }
        return result;
      } catch (err) {
        lastError = err;
        const info = formatAiError(err, provider.id);
        console.warn(
          `[AI] ${provider.id}/${model} failed:`,
          info.code || err.code,
          err.status || info.status || '',
          String(err.body || err.message || '').slice(0, 180),
        );
        if (info.code === 'invalid_api_key') break;
        if (info.code === 'invalid_response') {
          console.warn(
            `[AI] ${provider.id}/${model} JSON invalid:`,
            String(err.message || '').slice(0, 120),
          );
        }
      }
    }
  }

  throw lastError || createAiError('All AI models failed', { provider: env.aiProvider });
}

async function completeWithFreeOpenRouterModels({
  agentType,
  system,
  userContent,
  modelOverride,
  params,
  accept,
}) {
  if (!openRouterService.isConfigured()) {
    throw createAiError('OPENROUTER_API_KEY is not configured', {
      code: 'invalid_api_key',
      status: 401,
      provider: 'openrouter',
    });
  }

  const models = await resolveFreeModelsForTask(agentType, modelOverride);
  if (!models.length) {
    throw createAiError('هیچ مدل رایگان OpenRouter در دسترس نیست.', {
      code: 'model_not_found',
      status: 404,
      provider: 'openrouter',
    });
  }

  let lastError;
  for (const model of models) {
    if (!isCatalogModelFree(model)) {
      console.warn(`[AI] skipped non-free OpenRouter model ${model.id}`);
      continue;
    }
    try {
      const result = await openRouterService.completeChatWithRetry({
        model: model.id,
        system,
        userContent,
        temperature: params.temperature,
        maxTokens: capFreeMaxTokens(params.maxTokens, model),
        responseFormat: model.supportsJson ? params.responseFormat : null,
        timeoutMs: params.timeoutMs,
        retries: 1,
      });
      if (typeof accept === 'function') {
        result.parsed = accept(result);
      }
      clearFreeModelCooldown(model.id);
      return result;
    } catch (err) {
      lastError = err;
      const info = formatAiError(err, 'openrouter');
      console.warn(
        `[AI] openrouter/${model.id} failed:`,
        info.code || err.code,
        err.status || info.status || '',
        String(err.body || err.message || '').slice(0, 180),
      );
      if (info.code === 'invalid_api_key') throw Object.assign(err, info);
      if (
        info.code === 'model_not_found' ||
        info.code === 'rate_limit' ||
        info.code === 'insufficient_quota' ||
        info.code === 'server_error' ||
        info.code === 'timeout' ||
        info.code === 'context_length'
      ) {
        markFreeModelUnavailable(model.id, cooldownMsForError(info.code));
      }
    }
  }

  throw lastError || createAiError('All free OpenRouter models failed', {
    provider: 'openrouter',
  });
}

/**
 * Shared LLM entry used by content pipeline, portfolio copy, and sales assistant.
 * Scenario / Narration / Storyboard always use the ranked OpenRouter free catalog
 * unless AI_CONTENT_PREFER_QUALITY=true. Other agents follow freeModelsOnly settings.
 */
export async function completeWithModelFallback({
  agentType,
  system,
  userContent,
  modelOverride,
  accept,
}) {
  const params = resolveGenerationParams(agentType);
  const runtime = await getFreeModelRuntime();
  const cfg = getModelConfig();
  const contentUsesFree =
    isQualityContentAgent(agentType) && cfg.contentPreferQuality !== true;
  const forcePaidQuality =
    isQualityContentAgent(agentType) &&
    cfg.contentPreferQuality === true &&
    listConfiguredLlmProviders().length > 0;

  if (forcePaidQuality) {
    return completeWithPaidProviders({
      agentType,
      system,
      userContent,
      modelOverride,
      params,
      accept,
    });
  }

  const override =
    (runtime.freeModelsOnly || contentUsesFree) &&
    modelOverride &&
    !String(modelOverride).endsWith(':free')
      ? undefined
      : modelOverride;

  // Content pipeline: free models only (professional ranking via resolveFreeModelsForTask).
  if (contentUsesFree || runtime.freeModelsOnly) {
    return completeWithFreeOpenRouterModels({
      agentType,
      system,
      userContent,
      modelOverride: override,
      params,
      accept,
    });
  }

  let lastFreeError = null;
  if (runtime.allowPaidFallback) {
    try {
      return await completeWithFreeOpenRouterModels({
        agentType,
        system,
        userContent,
        modelOverride: override,
        params,
        accept,
      });
    } catch (err) {
      lastFreeError = err;
      const info = formatAiError(err, 'openrouter');
      if (info.code === 'invalid_api_key') throw err;
      console.warn(
        `[AI] free OpenRouter pool failed; paid fallback enabled:`,
        info.code || err.code,
      );
    }
  }

  try {
    return await completeWithPaidProviders({
      agentType,
      system,
      userContent,
      modelOverride,
      params,
      accept,
    });
  } catch (err) {
    throw err || lastFreeError;
  }
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
  const safeInput = sanitizeAiInput(input);
  const outputContext = {
    language: safeInput.language,
    tone: safeInput.tone,
  };
  const qualityHints = isQualityContentAgent(agentType)
    ? [
        'Produce professional, project-specific marketing content in simple clear language.',
        'Ground every output in briefSummary / brief / customer / assets — never invent an unrelated product.',
        'Keep Scenario → Narration → Storyboard internally consistent via priorOutputs.',
        'Avoid generic AI filler, repetition, and complicated wording.',
        'Return compact, complete JSON (no truncation, no markdown).',
      ].join(' ')
    : '';
  const system = [
    promptTemplate || def.system,
    `Prompt version: ${promptVersion}.`,
    `Always include projectId=${input?.projectId} in the JSON response.`,
    'Return valid JSON only.',
    qualityHints,
    safeInput.languageInstruction,
    safeInput.toneInstruction,
  ]
    .filter(Boolean)
    .join('\n\n');

  const started = Date.now();

  // Explicit mock provider
  if (cfg.provider === 'mock' || providerInfo.id === 'mock') {
    const output = validateAgentOutput(
      agentType,
      mockOutput(agentType, input),
      input?.projectId,
      outputContext,
    );
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

  const configuredProviders = listConfiguredLlmProviders();
  if (!configuredProviders.length) {
    if (cfg.allowMockFallback) {
      const output = validateAgentOutput(
        agentType,
        mockOutput(agentType, input),
        input?.projectId,
        outputContext,
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
        fallbackError: 'هیچ سرویس AI پیکربندی نشده است.',
      };
    }
    throw createAiError('No AI provider is configured', {
      code: 'invalid_api_key',
      status: 401,
      provider: cfg.provider,
    });
  }

  try {
    const completion = await completeWithModelFallback({
      agentType,
      system,
      userContent: safeInput,
      modelOverride: model,
      accept: (result) =>
        parseAgentCompletion(agentType, result.text, input?.projectId, outputContext),
    });

    const output =
      completion.parsed ||
      parseAgentCompletion(agentType, completion.text, input?.projectId, outputContext);

    return {
      model: completion.model,
      promptVersion,
      output,
      provider: completion.provider || cfg.provider,
      tokenUsage: completion.usage,
      durationMs: Date.now() - started,
      feature: agentType,
    };
  } catch (err) {
    const info = formatAiError(err, err.provider || cfg.provider);
    if (
      agentType === 'STORYBOARD' &&
      info.code !== 'invalid_api_key' &&
      safeInput?.priorOutputs?.scenario
    ) {
      try {
        const synthesized = synthesizeStoryboardFromInput(safeInput);
        const output = validateAgentOutput(
          'STORYBOARD',
          synthesized,
          input?.projectId,
          outputContext,
        );
        console.warn(
          '[AI] storyboard recovered from scenario after',
          info.code || err.code,
        );
        return {
          model: 'storyboard-from-scenario',
          promptVersion,
          output,
          provider: 'derived',
          tokenUsage: null,
          durationMs: Date.now() - started,
          feature: agentType,
        };
      } catch (synthErr) {
        console.warn('[AI] storyboard synthesis failed:', synthErr.message);
      }
    }
    if (cfg.allowMockFallback) {
      const output = validateAgentOutput(
        agentType,
        mockOutput(agentType, input),
        input?.projectId,
        outputContext,
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
      provider: err.provider || cfg.provider,
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
      consistencyRules: {
        pipeline: 'SCENARIO → NARRATION → STORYBOARD',
        requireProjectSpecific: true,
        forbidGenericTemplates: true,
        alignWithPriorOutputs: true,
        completedSteps: Object.keys(outputs),
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

  const normalizedOutputs = normalizePipelineOutputs(outputs, input?.projectId, {
    language: input?.language,
    tone: input?.tone,
  });

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
    { size = '1920x1080', seeds = [], enhance = false, preferQuality = false } = {},
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
      let quotaFailed = false;
      const batchSize = 2;
      for (let start = 0; start < promptList.length && !quotaFailed; start += batchSize) {
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
              const info = formatAiError(err, 'openrouter');
              if (info.code === 'insufficient_quota') quotaFailed = true;
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
      for (let index = images.length; index < promptList.length; index += 1) {
        images.push({
          index,
          prompt: promptList[index],
          error: quotaFailed ? 'OpenRouter image quota' : 'skipped',
          url: null,
        });
      }
      images.sort((a, b) => a.index - b.index);
      if (quotaFailed && !images.some((img) => img.url || img.b64)) return null;
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

      for (let start = 0; start < promptList.length; start += 2) {
        if (start > 0) await sleep(200);
        const batch = promptList.slice(start, start + 2);
        await Promise.all(
          batch.map(async (promptText, batchIndex) => {
            const index = start + batchIndex;
            const rawPrompt = String(promptText || '')
              .replace(/[^\x20-\x7E]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            if (!rawPrompt) {
              images.push({
                index,
                prompt: rawPrompt,
                error: 'Empty image prompt',
                url: null,
              });
              return;
            }
            const seed = Number.isFinite(seeds[index])
              ? Math.floor(seeds[index])
              : Math.floor(Math.random() * 1_000_000_000);
            // Keep brand + scene subject first — Pollinations truncates encoded prompts.
            const encoded = encodeURIComponent(rawPrompt.slice(0, 900));
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
          }),
        );
      }

      images.sort((a, b) => a.index - b.index);
      return { provider: 'pollinations', model, images };
    }

    const hasSuccess = (result) =>
      Boolean(result?.images?.some((img) => img.url || img.b64));

    function mergeImageResults(primary, fallback) {
      if (!primary) return fallback;
      if (!fallback) return primary;
      const images = list.map((prompt, index) => {
        const a = primary.images?.find((img) => img.index === index);
        if (a?.url || a?.b64) return a;
        const b = fallback.images?.find((img) => img.index === index);
        if (b?.url || b?.b64) return { ...b, index };
        return a || b || { index, prompt, url: null };
      });
      const fromPrimary = images.some((img) => {
        const a = primary.images?.find((row) => row.index === img.index);
        return Boolean((img.url || img.b64) && (a?.url || a?.b64));
      });
      return {
        provider: fromPrimary && hasSuccess(fallback)
          ? `${primary.provider}+${fallback.provider}`
          : hasSuccess(primary)
            ? primary.provider
            : fallback.provider,
        model: (hasSuccess(primary) ? primary.model : null) || fallback.model,
        images,
      };
    }

    const mode = env.aiImageProvider || 'auto';

    if (preferQuality) {
      // Run paid + free image providers in parallel — fastest wall-clock and
      // best fill-rate. Prefer OpenRouter bytes when both succeed.
      const [orResult, freeResult] = await Promise.all([
        generateViaOpenRouter(list).catch((err) => {
          console.warn(
            '[AI images] OpenRouter parallel attempt failed:',
            err?.message || err,
          );
          return null;
        }),
        generateViaPollinations(list).catch((err) => {
          console.warn(
            '[AI images] Pollinations parallel attempt failed:',
            err?.message || err,
          );
          return null;
        }),
      ]);
      const merged = mergeImageResults(orResult, freeResult);
      if (hasSuccess(merged)) return merged;
      if (hasSuccess(orResult)) return orResult;
      if (hasSuccess(freeResult)) return freeResult;
    }

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
