import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAdminFilters,
  capFreeMaxTokens,
  isCatalogModelFree,
  isOpenRouterFreeModel,
  mergeAdminConfig,
  normalizeCatalogModel,
  rankFreeModels,
  scoreFreeModel,
} from '../../src/services/ai/openrouter-free-models.js';
import { formatAiError } from '../../src/services/ai/errors.js';

test('detects :free suffix as a free OpenRouter model', () => {
  assert.equal(isOpenRouterFreeModel({ id: 'google/gemma-3-12b-it:free' }), true);
});

test('detects zero-price models without :free suffix', () => {
  assert.equal(
    isOpenRouterFreeModel({
      id: 'vendor/open-model',
      pricing: { prompt: '0', completion: '0', request: '0' },
    }),
    true,
  );
});

test('rejects paid OpenRouter models', () => {
  assert.equal(
    isOpenRouterFreeModel({
      id: 'anthropic/claude-sonnet-4',
      pricing: { prompt: '0.000003', completion: '0.000015' },
    }),
    false,
  );
});

test('cost guard rejects paid ids even after normalize-like pricing', () => {
  const paid = {
    id: 'openai/gpt-4o-mini',
    pricing: { prompt: '0.15', completion: '0.6' },
    outputModalities: ['text'],
  };
  assert.equal(isCatalogModelFree(paid), false);
  assert.ok(scoreFreeModel(paid) < 0);
});

test('normalizes catalog fields used by the admin UI', () => {
  const model = normalizeCatalogModel({
    id: 'qwen/qwen3-8b:free',
    name: 'Qwen3 8B',
    context_length: 40960,
    architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] },
    supported_parameters: ['response_format', 'structured_outputs'],
    top_provider: { max_completion_tokens: 8192 },
    pricing: { prompt: '0', completion: '0' },
  });
  assert.equal(model.provider, 'qwen');
  assert.equal(model.supportsJson, true);
  assert.equal(model.contextLength, 40960);
  assert.equal(model.free, true);
});

test('JSON tasks prefer models that advertise structured output', () => {
  const jsonModel = normalizeCatalogModel({
    id: 'a/json:free',
    name: 'JSON',
    context_length: 16000,
    supported_parameters: ['response_format'],
    architecture: { input_modalities: ['text'], output_modalities: ['text'] },
    pricing: { prompt: '0', completion: '0' },
  });
  const textModel = normalizeCatalogModel({
    id: 'b/text:free',
    name: 'Text',
    context_length: 128000,
    supported_parameters: [],
    architecture: { input_modalities: ['text'], output_modalities: ['text'] },
    pricing: { prompt: '0', completion: '0' },
  });
  const ranked = rankFreeModels([textModel, jsonModel], 'SCENARIO');
  assert.equal(ranked[0].id, 'a/json:free');
});

test('admin default model receives a ranking boost', () => {
  const a = normalizeCatalogModel({
    id: 'x/a:free',
    name: 'A',
    context_length: 8000,
    supported_parameters: ['response_format'],
    architecture: { input_modalities: ['text'], output_modalities: ['text'] },
    pricing: { prompt: '0', completion: '0' },
  });
  const b = normalizeCatalogModel({
    id: 'x/b:free',
    name: 'B',
    context_length: 8000,
    supported_parameters: ['response_format'],
    architecture: { input_modalities: ['text'], output_modalities: ['text'] },
    pricing: { prompt: '0', completion: '0' },
  });
  const ranked = rankFreeModels([a, b], 'NARRATION', { defaultModelId: 'x/b:free' });
  assert.equal(ranked[0].id, 'x/b:free');
});

test('disabled models are excluded from the enabled pool', () => {
  const models = [
    { id: 'keep:free', name: 'Keep', pricing: { prompt: '0', completion: '0' } },
    { id: 'drop:free', name: 'Drop', pricing: { prompt: '0', completion: '0' } },
  ];
  const filtered = applyAdminFilters(models, {
    disabledIds: ['drop:free'],
    priorityIds: [],
    defaultModelId: null,
  });
  assert.deepEqual(filtered.map((m) => m.id), ['keep:free']);
});

test('mergeAdminConfig defaults to free-only with paid fallback off', () => {
  const cfg = mergeAdminConfig({});
  assert.equal(cfg.freeModelsOnly, true);
  assert.equal(cfg.allowPaidFallback, false);
});

test('mergeAdminConfig can disable free-only mode', () => {
  const cfg = mergeAdminConfig({ freeModelsOnly: false, allowPaidFallback: true });
  assert.equal(cfg.freeModelsOnly, false);
  assert.equal(cfg.allowPaidFallback, true);
});

test('caps free-model max tokens to the provider limit', () => {
  assert.equal(capFreeMaxTokens(4096, { maxCompletionTokens: 1024 }), 1024);
  assert.equal(capFreeMaxTokens(256, { maxCompletionTokens: 8192 }), 256);
});

test('maps context-window errors as retryable context_length', () => {
  const info = formatAiError(
    { status: 400, message: 'This endpoint maximum context length is 8192 tokens' },
    'openrouter',
  );
  assert.equal(info.code, 'context_length');
  assert.equal(info.retryable, true);
});
