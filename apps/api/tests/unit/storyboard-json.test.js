import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractJson,
  repairTruncatedJson,
  normalizeStoryboardOutput,
  synthesizeStoryboardFromInput,
} from '../../src/services/ai/validate.js';

test('extractJson recovers truncated storyboard JSON', () => {
  const truncated = `{
    "projectId": "p1",
    "visualStyleGuide": "cinematic",
    "scenes": [
      {"scene_number": 1, "title": "Hook", "visual": "Wide road at dawn", "imagePrompt": "wide shot of a damaged road"},
      {"scene_number": 2, "title": "Work", "visual": "Crew paving asphalt", "imagePrompt": "medium shot of paver"`;
  const parsed = extractJson(truncated);
  assert.equal(parsed.projectId, 'p1');
  assert.ok(Array.isArray(parsed.scenes));
  assert.ok(parsed.scenes.length >= 1);
  const normalized = normalizeStoryboardOutput(parsed, 'p1');
  assert.ok(normalized.storyboard.length >= 1);
  assert.ok(normalized.storyboard[0].visual);
});

test('normalizeStoryboardOutput accepts scenes-only payload and imagePrompt as visual', () => {
  const out = normalizeStoryboardOutput(
    {
      scenes: [
        { title: 'CTA', imagePrompt: 'brand end card dusk roadside sign', camera: 'Wide' },
      ],
    },
    'p1',
  );
  assert.equal(out.storyboard.length, 1);
  assert.match(out.storyboard[0].visual, /end card/i);
});

test('repairTruncatedJson closes an open array', () => {
  const parsed = repairTruncatedJson('{"scenes":[{"visual":"ok"}');
  assert.equal(parsed.scenes[0].visual, 'ok');
});

test('synthesizeStoryboardFromInput builds scenes from scenario breakdown', () => {
  const out = synthesizeStoryboardFromInput({
    projectId: 'p1',
    priorOutputs: {
      scenario: {
        title: 'Road rebuild',
        concept: 'Before and after roads',
        hook: 'Broken streets',
        storyFlow: 'Show the problem. Rebuild. Reveal the result. Invite a call.',
        sceneBreakdown: [
          { title: 'Problem', description: 'Damaged city road with potholes' },
          { title: 'Work', description: 'Crew laying fresh asphalt' },
          { title: 'Result', description: 'Smooth finished boulevard' },
        ],
        totalDurationSec: 30,
      },
    },
  });
  const normalized = normalizeStoryboardOutput(out, 'p1');
  assert.equal(normalized.storyboard.length, 3);
  assert.match(normalized.storyboard[0].visual, /potholes/i);
});
