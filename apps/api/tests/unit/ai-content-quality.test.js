import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getModelConfig,
  isQualityContentAgent,
  resolveModelsForAgent,
  PROMPT_VERSION,
} from '../../src/services/ai/models.config.js';
import { sanitizeAiInput } from '../../src/services/ai/ai.service.js';
import {
  scoreFreeModel,
  taskNeedsFor,
} from '../../src/services/ai/openrouter-free-models.js';

test('content agents are marked for free-catalog creative ranking', () => {
  assert.equal(isQualityContentAgent('SCENARIO'), true);
  assert.equal(isQualityContentAgent('NARRATION'), true);
  assert.equal(isQualityContentAgent('STORYBOARD'), true);
  assert.equal(isQualityContentAgent('PORTFOLIO'), false);
});

test('content agents prefer free models by default (paid quality off)', () => {
  const cfg = getModelConfig();
  assert.equal(cfg.contentPreferQuality, false);
  assert.match(PROMPT_VERSION, /quality|free|v8|v7|v6/);
});

test('resolveModelsForAgent keeps configured order for paid escape hatch', () => {
  const models = resolveModelsForAgent('SCENARIO', 'openai/gpt-4o-mini');
  assert.equal(models[0], 'openai/gpt-4o-mini');
  assert.ok(models.length >= 1);
});

test('creative free-model scoring prefers capable chat models over tiny ones', () => {
  const needs = taskNeedsFor('SCENARIO');
  assert.equal(needs.needsCreative, true);
  const gemini = {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini Flash Free',
    pricing: { prompt: '0', completion: '0' },
    supportsJson: true,
    contextLength: 32000,
    maxCompletionTokens: 4096,
    outputModalities: ['text'],
    inputModalities: ['text'],
  };
  const tiny = {
    id: 'vendor/tiny-1b:free',
    name: 'Tiny 1B',
    pricing: { prompt: '0', completion: '0' },
    supportsJson: true,
    contextLength: 4096,
    maxCompletionTokens: 512,
    outputModalities: ['text'],
    inputModalities: ['text'],
  };
  assert.ok(scoreFreeModel(gemini, needs) > scoreFreeModel(tiny, needs));
});

test('sanitizeAiInput keeps project-specific brief and prior outputs', () => {
  const safe = sanitizeAiInput({
    projectId: 'p1',
    title: 'Demo Ad',
    brief: {
      productName: 'Apex CRM',
      productDescription: 'Sales pipeline software for Afghan agencies',
      audience: 'Sales managers',
      goal: 'Book demos',
      mainMessage: 'Close deals faster',
      cta: 'Request a demo',
      features: ['Pipeline', 'WhatsApp CRM'],
    },
    durationSec: 30,
    language: 'fa',
    assets: [{ source: 'client_asset', kind: 'LOGO', name: 'logo.png' }],
    previousVersions: [
      {
        id: 'v1',
        versionNumber: 1,
        status: 'APPROVED',
        scenario: {
          title: 'Fast Pipeline',
          concept: 'Show chaos then clarity',
          storyFlow: 'Hook → problem → Apex CRM → CTA',
        },
        narration: { script: 'فروش خود را سریع‌تر ببندید.', tone: 'confident' },
        storyboard: {
          visualStyleGuide: 'Clean corporate',
          scenes: [{ scene_number: 1, title: 'Hook', visual: 'Busy desk' }],
        },
      },
    ],
    clientFeedback: [
      { section: 'NARRATION', body: 'کمی رسمی‌تر باشد', status: 'OPEN' },
    ],
    priorOutputs: {
      scenario: { title: 'Fast Pipeline', concept: 'Chaos to clarity' },
      narration: null,
      storyboard: null,
    },
    contextMd: 'Project context about Apex CRM for sales teams.',
  });

  assert.equal(safe.briefSummary.productName, 'Apex CRM');
  assert.equal(safe.briefSummary.cta, 'Request a demo');
  assert.equal(safe.assets[0].name, 'logo.png');
  assert.equal(safe.previousVersions[0].scenario.title, 'Fast Pipeline');
  assert.ok(safe.previousVersions[0].narration.script.includes('فروش'));
  assert.equal(safe.clientFeedback[0].body.includes('رسمی'), true);
  assert.equal(safe.priorOutputs.scenario.title, 'Fast Pipeline');
  assert.equal(safe.consistencyRules.requireProjectSpecific, true);
  assert.ok(String(safe.contextSummary).includes('Apex CRM'));
});
