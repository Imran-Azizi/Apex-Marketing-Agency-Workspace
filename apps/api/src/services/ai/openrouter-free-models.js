/**
 * Dynamic OpenRouter free-model catalog.
 * Discovers live :free / zero-price models — no hardcoded model IDs.
 */

import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';

export const FREE_MODELS_SETTING_KEY = 'openrouter_free_models';
export const FREE_CATALOG_TTL_MS = 30 * 60 * 1000;
export const FREE_MODEL_COOLDOWN_MS = 10 * 60 * 1000;
/** Hard cap across all free-model tasks (admin tooling / non-content). */
export const MAX_FREE_MODEL_ATTEMPTS = 6;
/**
 * Content pipeline (Scenario / Narration / Storyboard): fewer attempts = much faster
 * wall-clock while still covering the best-ranked free models.
 */
export const CONTENT_FREE_MODEL_ATTEMPTS = 4;

export const DEFAULT_FREE_MODELS_SETTINGS = {
  // Scenario / Narration / Storyboard use free OpenRouter models by default.
  freeModelsOnly: true,
  allowPaidFallback: false,
  defaultModelId: null,
  disabledIds: [],
  priorityIds: [],
};

const TASK_NEEDS = {
  SCENARIO: {
    needsJson: true,
    needsCreative: true,
    minContext: 8000,
    minCompletion: 1024,
  },
  NARRATION: {
    needsJson: true,
    needsCreative: true,
    minContext: 8000,
    minCompletion: 512,
  },
  STORYBOARD: {
    needsJson: true,
    needsCreative: true,
    minContext: 16000,
    minCompletion: 1536,
  },
  PORTFOLIO: { needsJson: true, minContext: 8000, minCompletion: 512 },
  SALES_ASSISTANT: { needsJson: true, minContext: 8000, minCompletion: 512 },
  CODE: { needsCode: true, minContext: 8000, minCompletion: 512 },
  TEXT: { needsJson: false, minContext: 4000, minCompletion: 256 },
};

let memoryCatalog = null;
const unavailableUntil = new Map();

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function isOpenRouterFreeModel(raw) {
  const id = String(raw?.id || raw?.canonical_slug || '');
  if (!id) return false;
  if (id.endsWith(':free')) return true;
  const pricing = raw?.pricing || {};
  const prompt = num(pricing.prompt, NaN);
  const completion = num(pricing.completion, NaN);
  const request = num(pricing.request, 0);
  const image = num(pricing.image, 0);
  return prompt === 0 && completion === 0 && request === 0 && image === 0;
}

export function providerFromModelId(id) {
  const raw = String(id || '');
  const slash = raw.indexOf('/');
  return slash > 0 ? raw.slice(0, slash) : 'openrouter';
}

export function normalizeCatalogModel(raw) {
  const id = String(raw?.id || raw?.canonical_slug || '').trim();
  const architecture = asObject(raw?.architecture);
  const top = asObject(raw?.top_provider);
  const supported = Array.isArray(raw?.supported_parameters)
    ? raw.supported_parameters.map((item) => String(item))
    : [];
  const inputMods = Array.isArray(architecture.input_modalities)
    ? architecture.input_modalities.map(String)
    : String(architecture.modality || '').includes('text')
      ? ['text']
      : ['text'];
  const outputMods = Array.isArray(architecture.output_modalities)
    ? architecture.output_modalities.map(String)
    : ['text'];
  const supportsJson =
    supported.includes('response_format') ||
    supported.includes('structured_outputs') ||
    supported.includes('json') ||
    /json|structured/i.test(supported.join(' '));
  const contextLength = num(
    raw?.context_length || top.context_length,
    0,
  );
  const maxCompletionTokens = num(top.max_completion_tokens, 0);

  return {
    id,
    name: String(raw?.name || id),
    description: String(raw?.description || '').slice(0, 400),
    provider: providerFromModelId(id),
    free: true,
    contextLength,
    maxCompletionTokens,
    modality: String(architecture.modality || 'text->text'),
    inputModalities: inputMods,
    outputModalities: outputMods,
    supportsJson,
    supportsTools: supported.includes('tools') || supported.includes('tool_choice'),
    supportedParameters: supported,
    pricing: {
      prompt: raw?.pricing?.prompt != null
        ? String(raw.pricing.prompt)
        : id.endsWith(':free')
          ? '0'
          : '',
      completion: raw?.pricing?.completion != null
        ? String(raw.pricing.completion)
        : id.endsWith(':free')
          ? '0'
          : '',
    },
  };
}

export function taskNeedsFor(agentType) {
  return TASK_NEEDS[agentType] || TASK_NEEDS.TEXT;
}

export function isCatalogModelFree(model) {
  const id = String(model?.id || '');
  if (!id) return false;
  if (id.endsWith(':free')) return true;
  const pricing = model?.pricing || {};
  return num(pricing.prompt, 1) === 0 && num(pricing.completion, 1) === 0;
}

export function scoreFreeModel(model, needs = TASK_NEEDS.TEXT, admin = {}) {
  if (!model?.id || !isCatalogModelFree(model)) return -1000;
  let score = 0;
  const idName = `${model.id} ${model.name}`.toLowerCase();
  if (model.id.endsWith(':free')) score += 12;
  const outputs = Array.isArray(model.outputModalities) ? model.outputModalities : [];
  const inputs = Array.isArray(model.inputModalities) ? model.inputModalities : [];
  if (!outputs.includes('text')) score -= 80;
  if (needs.needsJson) {
    score += model.supportsJson ? 40 : -25;
  }
  if (needs.needsCode) {
    score += /code|coder|instruct|dev/i.test(idName) ? 20 : 0;
  }
  // Prefer capable free chat/instruct models for Scenario / Narration / Storyboard.
  if (needs.needsCreative) {
    if (
      /gemini|llama|qwen|mistral|mixtral|deepseek|phi|gemma|command|claude|gpt-oss|nemotron|wizard|yi-|hunyuan|glm|katalyst|mythomax|nous|dolphin/i.test(
        idName,
      )
    ) {
      score += 28;
    }
    if (/instruct|chat|it\b|creative|writer|roleplay/i.test(idName)) score += 10;
    if (/tiny|nano|micro|1b|2b|3b|edge|whisper|embed|tts|vision-only/i.test(idName)) {
      score -= 35;
    }
    if (model.contextLength >= 16000) score += 10;
    if (model.contextLength >= 32000) score += 8;
  }
  if (needs.minContext) {
    score += model.contextLength >= needs.minContext ? 16 : -20;
  }
  if (model.contextLength >= 32000) score += 8;
  if (needs.minCompletion) {
    const cap = model.maxCompletionTokens || 2048;
    score += cap >= needs.minCompletion ? 8 : -12;
  }
  if (outputs.includes('text')) score += 6;
  if (inputs.includes('text')) score += 4;
  const priority = Array.isArray(admin.priorityIds) ? admin.priorityIds : [];
  const prioIdx = priority.indexOf(model.id);
  if (prioIdx >= 0) score += Math.max(0, (priority.length - prioIdx) * 4);
  if (admin.defaultModelId && admin.defaultModelId === model.id) score += 25;
  return score;
}

export function mergeAdminConfig(raw) {
  const obj = asObject(raw);
  const defaultModelId =
    typeof obj.defaultModelId === 'string' && obj.defaultModelId.trim()
      ? obj.defaultModelId.trim()
      : null;
  return {
    freeModelsOnly:
      typeof obj.freeModelsOnly === 'boolean'
        ? obj.freeModelsOnly
        : DEFAULT_FREE_MODELS_SETTINGS.freeModelsOnly,
    allowPaidFallback:
      typeof obj.allowPaidFallback === 'boolean'
        ? obj.allowPaidFallback
        : DEFAULT_FREE_MODELS_SETTINGS.allowPaidFallback,
    defaultModelId,
    disabledIds: asStringArray(obj.disabledIds),
    priorityIds: asStringArray(obj.priorityIds),
  };
}

export function applyAdminFilters(models, admin, { includeUnavailable = true } = {}) {
  const disabled = new Set(admin.disabledIds || []);
  const now = Date.now();
  const list = (Array.isArray(models) ? models : [])
    .filter((model) => model?.id && !disabled.has(model.id))
    .map((model) => {
      const until = unavailableUntil.get(model.id) || 0;
      const available = until <= now;
      return { ...model, available, unavailableUntil: available ? null : until };
    });
  const visible = includeUnavailable ? list : list.filter((model) => model.available);
  const priority = admin.priorityIds || [];
  const rank = new Map(priority.map((id, i) => [id, i]));
  visible.sort((a, b) => {
    const pa = rank.has(a.id) ? rank.get(a.id) : 1000;
    const pb = rank.has(b.id) ? rank.get(b.id) : 1000;
    if (pa !== pb) return pa - pb;
    return String(a.name).localeCompare(String(b.name));
  });
  if (admin.defaultModelId) {
    const idx = visible.findIndex((model) => model.id === admin.defaultModelId);
    if (idx > 0) {
      const [picked] = visible.splice(idx, 1);
      visible.unshift(picked);
    }
  }
  return visible;
}

export function rankFreeModels(models, agentType, admin = {}) {
  const needs = taskNeedsFor(agentType);
  let pool = [...models].filter((model) => isCatalogModelFree(model));
  if (needs.needsJson) {
    const jsonPool = pool.filter((model) => model.supportsJson);
    if (jsonPool.length) pool = jsonPool;
  }
  if (needs.minCompletion) {
    const roomy = pool.filter((model) => {
      const cap = Number(model.maxCompletionTokens) || 0;
      return cap === 0 || cap >= needs.minCompletion;
    });
    if (roomy.length) pool = roomy;
  }
  return pool
    .map((model) => ({ model, score: scoreFreeModel(model, needs, admin) }))
    .filter((row) => row.score > -40)
    .sort((a, b) => b.score - a.score || b.model.contextLength - a.model.contextLength)
    .map((row) => row.model);
}

export function cooldownMsForError(code) {
  if (code === 'rate_limit') return 2 * 60 * 1000;
  if (code === 'insufficient_quota') return 15 * 60 * 1000;
  if (code === 'model_not_found') return 10 * 60 * 1000;
  if (code === 'timeout' || code === 'server_error' || code === 'context_length') {
    return 60 * 1000;
  }
  return FREE_MODEL_COOLDOWN_MS;
}

export function capFreeMaxTokens(requested, model) {
  const want = Math.max(256, Number(requested) || 1024);
  const hard = Number(model?.maxCompletionTokens) || 0;
  if (hard > 0) return Math.min(want, hard);
  return Math.min(want, 3072);
}

export function markFreeModelUnavailable(id, ms = FREE_MODEL_COOLDOWN_MS) {
  if (!id) return;
  unavailableUntil.set(id, Date.now() + ms);
}

export function clearFreeModelCooldown(id) {
  if (id) unavailableUntil.delete(id);
}

function snapshotFromSetting(value) {
  const obj = asObject(value);
  const models = Array.isArray(obj.catalog)
    ? obj.catalog.filter((item) => item?.id)
    : [];
  return {
    fetchedAt: obj.catalogFetchedAt || null,
    models,
  };
}

async function readSettingRow() {
  return prisma.setting.findUnique({
    where: { key: FREE_MODELS_SETTING_KEY },
  });
}

export async function getFreeModelsAdminConfig() {
  const row = await readSettingRow();
  return mergeAdminConfig(row?.value);
}

export async function saveFreeModelsAdminConfig(patch = {}) {
  const current = await getFreeModelsAdminConfig();
  const merged = { ...current };
  if (typeof patch.freeModelsOnly === 'boolean') merged.freeModelsOnly = patch.freeModelsOnly;
  if (typeof patch.allowPaidFallback === 'boolean') merged.allowPaidFallback = patch.allowPaidFallback;
  if (patch.defaultModelId !== undefined) merged.defaultModelId = patch.defaultModelId;
  if (patch.disabledIds !== undefined) merged.disabledIds = patch.disabledIds;
  if (patch.priorityIds !== undefined) merged.priorityIds = patch.priorityIds;
  const next = mergeAdminConfig(merged);
  next.disabledIds = next.disabledIds.slice(0, 400);
  next.priorityIds = next.priorityIds.slice(0, 400);
  const row = await readSettingRow();
  const prev = asObject(row?.value);
  const value = {
    ...prev,
    ...next,
  };
  await prisma.setting.upsert({
    where: { key: FREE_MODELS_SETTING_KEY },
    create: { key: FREE_MODELS_SETTING_KEY, value },
    update: { value },
  });
  return next;
}

async function persistCatalogSnapshot(models) {
  const row = await readSettingRow();
  const prev = asObject(row?.value);
  const value = {
    ...mergeAdminConfig(prev),
    catalogFetchedAt: new Date().toISOString(),
    catalog: models,
  };
  await prisma.setting.upsert({
    where: { key: FREE_MODELS_SETTING_KEY },
    create: { key: FREE_MODELS_SETTING_KEY, value },
    update: { value },
  });
}

export async function fetchOpenRouterFreeCatalog() {
  const base = (env.openrouterBaseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const headers = { Accept: 'application/json' };
  if (env.openrouterApiKey) {
    headers.Authorization = `Bearer ${env.openrouterApiKey}`;
    headers['HTTP-Referer'] = env.webUrl || 'http://localhost:3000';
    headers['X-Title'] = 'APEX Workspace';
  }
  const res = await fetch(`${base}/models`, {
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`OpenRouter models HTTP ${res.status}`);
  }
  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('OpenRouter models response was not JSON');
  }
  const list = Array.isArray(parsed.data) ? parsed.data : Array.isArray(parsed) ? parsed : [];
  return list.filter(isOpenRouterFreeModel).map(normalizeCatalogModel).filter((m) => m.id);
}

export async function getFreeModelsCatalog({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (
    !forceRefresh &&
    memoryCatalog?.fetchedAt &&
    now - Date.parse(memoryCatalog.fetchedAt) < FREE_CATALOG_TTL_MS
  ) {
    return memoryCatalog;
  }

  try {
    const models = await fetchOpenRouterFreeCatalog();
    memoryCatalog = {
      fetchedAt: new Date().toISOString(),
      models,
      source: 'live',
    };
    persistCatalogSnapshot(models).catch((err) => {
      console.warn('[openrouter-free-models] persist failed:', err?.message || err);
    });
    return memoryCatalog;
  } catch (err) {
    console.warn('[openrouter-free-models] fetch failed:', err?.message || err);
    if (memoryCatalog?.models?.length) {
      return { ...memoryCatalog, source: 'memory', error: err.message };
    }
    const row = await readSettingRow();
    const snap = snapshotFromSetting(row?.value);
    if (snap.models.length) {
      memoryCatalog = { ...snap, source: 'snapshot', error: err.message };
      return memoryCatalog;
    }
    return {
      fetchedAt: null,
      models: [],
      source: 'empty',
      error: err.message,
    };
  }
}

export async function getFreeModelRuntime() {
  const admin = await getFreeModelsAdminConfig();
  return {
    freeModelsOnly: admin.freeModelsOnly === true,
    allowPaidFallback: admin.allowPaidFallback === true,
    admin,
  };
}

export async function resolveFreeModelsForTask(agentType, modelOverride) {
  const [admin, catalog] = await Promise.all([
    getFreeModelsAdminConfig(),
    getFreeModelsCatalog(),
  ]);
  const allEnabled = applyAdminFilters(catalog.models || [], admin, {
    includeUnavailable: true,
  }).filter(isCatalogModelFree);
  let enabled = allEnabled.filter((model) => model.available);
  if (!enabled.length) enabled = allEnabled;
  let ranked = rankFreeModels(enabled, agentType, admin);
  const override =
    typeof modelOverride === 'string' && modelOverride.trim()
      ? modelOverride.trim()
      : '';
  if (override && enabled.some((m) => m.id === override && isCatalogModelFree(m))) {
    ranked = [
      enabled.find((m) => m.id === override),
      ...ranked.filter((m) => m.id !== override),
    ].filter(Boolean);
  }
  const limit =
    agentType === 'SCENARIO' ||
    agentType === 'NARRATION' ||
    agentType === 'STORYBOARD'
      ? CONTENT_FREE_MODEL_ATTEMPTS
      : MAX_FREE_MODEL_ATTEMPTS;
  return ranked.slice(0, limit);
}

export async function buildFreeModelsAdminPayload({ forceRefresh = false } = {}) {
  const [admin, catalog] = await Promise.all([
    getFreeModelsAdminConfig(),
    getFreeModelsCatalog({ forceRefresh }),
  ]);
  const now = Date.now();
  const models = (catalog.models || []).map((model) => {
    const until = unavailableUntil.get(model.id) || 0;
    const enabled = !admin.disabledIds.includes(model.id);
    return {
      ...model,
      label: 'Free',
      enabled,
      available: until <= now,
      selectedDefault: admin.defaultModelId === model.id,
      priorityIndex: admin.priorityIds.indexOf(model.id),
    };
  });
  models.sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    const pa = a.priorityIndex >= 0 ? a.priorityIndex : 1000;
    const pb = b.priorityIndex >= 0 ? b.priorityIndex : 1000;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
  return {
    settings: admin,
    catalog: {
      fetchedAt: catalog.fetchedAt,
      source: catalog.source || 'live',
      error: catalog.error || null,
      count: models.length,
    },
    models,
  };
}
