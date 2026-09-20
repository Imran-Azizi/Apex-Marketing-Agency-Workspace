import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLanguageToneDirectives,
  resolveLanguagePolicy,
} from '../../src/services/ai/language.js';
import {
  normalizeNarrationOutput,
  normalizeScenarioOutput,
} from '../../src/services/ai/validate.js';
import { sanitizeAiInput } from '../../src/services/ai/ai.service.js';

test('resolveLanguagePolicy maps fa/dari to فارسی / دری', () => {
  assert.equal(resolveLanguagePolicy('fa').label, 'فارسی / دری');
  assert.equal(resolveLanguagePolicy('dari').code, 'fa');
  assert.equal(resolveLanguagePolicy('en').writingLanguage, 'English');
  assert.equal(resolveLanguagePolicy('ps').rtl, true);
  assert.equal(resolveLanguagePolicy('en').rtl, false);
});

test('buildLanguageToneDirectives locks selected tone and language', () => {
  const directives = buildLanguageToneDirectives({
    language: 'fa',
    tone: 'صمیمی',
  });
  assert.match(directives.languageInstruction, /فارسی|دری/);
  assert.match(directives.languageInstruction, /Afghan Dari|everyday Afghan/);
  assert.match(directives.toneInstruction, /صمیمی/);
  assert.match(directives.toneInstruction, /Do NOT invent/);
  assert.equal(directives.tone.selectedTone, 'صمیمی');
});

test('normalizeNarrationOutput forces project language and tone', () => {
  const row = normalizeNarrationOutput(
    {
      script: 'Hello world product pitch.',
      language: 'xx',
      tone: 'AI Invented Tone',
      toneExplanation: 'I chose a dramatic tone',
      estimatedSeconds: 20,
    },
    'p1',
    { language: 'en', tone: 'Friendly' },
  );
  assert.equal(row.language, 'en');
  assert.equal(row.tone, 'Friendly');
  assert.equal(row.toneExplanation, '');
});

test('normalizeScenarioOutput stores locked language/tone', () => {
  const row = normalizeScenarioOutput(
    {
      title: 'Fast Close',
      concept: 'Show urgency then product',
      hook: 'Need results now?',
      storyFlow: 'Hook → solution → CTA',
      cta: 'Book a demo',
    },
    'p1',
    { language: 'en', tone: 'Professional' },
  );
  assert.equal(row.language, 'en');
  assert.equal(row.tone, 'Professional');
});

test('sanitizeAiInput exposes language and tone policies', () => {
  const safe = sanitizeAiInput({
    projectId: 'p1',
    language: 'fa',
    tone: 'رسمی',
    brief: { productName: 'Apex' },
  });
  assert.equal(safe.language, 'fa');
  assert.equal(safe.languageLabel, 'فارسی / دری');
  assert.equal(safe.tone, 'رسمی');
  assert.equal(safe.tonePolicy.locked, true);
  assert.match(safe.languageInstruction, /فارسی|دری/);
  assert.match(safe.toneInstruction, /رسمی/);
});
