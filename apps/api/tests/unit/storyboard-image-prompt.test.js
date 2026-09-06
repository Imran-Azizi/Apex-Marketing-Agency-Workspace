import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReinforcedSceneImagePrompt,
  buildSceneImagePrompt,
  localizeVisualText,
  scorePromptRelevance,
  validateImagePrompt,
} from '../../src/services/ai/storyboard-image-prompt.js';

const electricBrand = {
  projectTitle: 'Hoshmand Soft — Electric Energy',
  productName: 'Hoshmand Soft',
  service: 'Electric Energy Solutions',
  audience: 'homeowners and businesses',
  mainMessage: 'Reduce electricity cost with smart monitoring',
};

const electricScene = {
  sceneNumber: 1,
  title: 'شروع با نمای کلی',
  visualDescription:
    'نمای کلی از شبکه برق شهری و داشبورد نرم‌افزار هوشمند انرژی الکتریکی',
  camera: 'Wide Shot',
  action: 'نمایش جریان انرژی و مصرف برق روی صفحه',
  environment: 'شهر در روز با زیرساخت برق',
  lighting: 'نور طبیعی روز',
  visualDirection: 'حس فناوری پاک و مدرن',
  imagePrompt:
    'Wide establishing shot of a modern city power grid with a smart electric-energy software dashboard overlay, clean daylight, commercial tech advertising still',
};

test('localizeVisualText maps electric energy Persian without energy-drink drift', () => {
  const text = localizeVisualText('انرژی الکتریکی و شبکه برق شهری');
  assert.match(text.toLowerCase(), /electric/);
  assert.doesNotMatch(text.toLowerCase(), /energy drink/);
});

test('buildSceneImagePrompt grounds electric-energy project scenes', () => {
  const prompt = buildSceneImagePrompt(electricScene, {
    projectContext: electricBrand,
    scenarioContext: {
      concept: 'Smart software that helps customers manage electric energy usage',
      marketingAngle: 'save on electricity bills',
    },
    narrationContext: 'با نرم‌افزار هوشمند، مصرف برق خود را کنترل کنید',
    sceneIndex: 0,
    totalScenes: 5,
  });

  const lower = prompt.toLowerCase();
  assert.match(lower, /electric|power|energy|software|hoshmand/);
  assert.doesNotMatch(lower, /energy drink/);
  assert.doesNotMatch(lower, /fashion portrait/);
  assert.match(prompt, /MUST SHOW:/);
  assert.match(prompt, /MUST NOT SHOW:/);
  assert.match(prompt, /Target audience:/);
  assert.match(prompt, /Marketing objective:/);
});

test('validateImagePrompt rejects generic portrait traps for non-person scenes', () => {
  const bad = validateImagePrompt(
    'Cinematic portrait of a woman in a dark moody office, fashion portrait headshot',
    { visualDescription: 'solar panels on a rooftop', camera: 'Wide' },
    { projectContext: electricBrand },
  );
  assert.equal(bad.ok, false);
});

test('scorePromptRelevance accepts grounded electric scene prompts', () => {
  const prompt = buildSceneImagePrompt(electricScene, {
    projectContext: electricBrand,
    scenarioContext: { concept: 'electric energy smart monitoring' },
    narrationContext: 'smart electric energy control',
  });
  const score = scorePromptRelevance(prompt, electricScene, {
    projectContext: electricBrand,
    scenarioContext: { concept: 'electric energy smart monitoring' },
    narrationContext: 'smart electric energy control',
  });
  assert.equal(score.relevant, true);
  assert.ok(score.score >= 0.34);
});

test('reinforced prompt adds regeneration instruction', () => {
  const prompt = buildReinforcedSceneImagePrompt(electricScene, {
    projectContext: electricBrand,
    scenarioContext: { concept: 'electric energy' },
  });
  assert.match(prompt, /REGENERATION:/);
  assert.match(prompt.toLowerCase(), /electric|hoshmand|software|power/);
});
