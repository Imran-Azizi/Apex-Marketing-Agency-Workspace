/**
 * JSON extraction + response validation / normalization for content agents.
 */

export function extractJson(text) {
  if (!text) return {};
  if (typeof text === 'object') return text;
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return { raw: text };
      }
    }
    return { raw: text };
  }
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : null;
}

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    const err = new Error(`Missing required field: ${field}`);
    err.code = 'invalid_response';
    err.status = 400;
    throw err;
  }
  return value.trim();
}

/**
 * Normalize + validate scenario payload for UI / storage.
 */
export function normalizeScenarioOutput(output, projectId) {
  const o = asObject(output);
  if (!o) {
    const err = new Error('Scenario response is not an object');
    err.code = 'invalid_response';
    throw err;
  }

  const list = Array.isArray(o.scenarios) ? o.scenarios.filter(Boolean) : [];
  let picked =
    list.find((s) => s && s.id === o.recommendedScenarioId) ||
    list[0] ||
    null;

  if (!picked && (o.title || o.concept || o.hook || o.storyFlow || o.content)) {
    picked = {
      id: 1,
      title: o.title || '',
      concept: o.concept || '',
      problem: o.problem || '',
      solution: o.solution || '',
      hook: o.hook || '',
      storyFlow: o.storyFlow || o.content || '',
      sceneBreakdown: Array.isArray(o.sceneBreakdown) ? o.sceneBreakdown : [],
      emotionalDirection: o.emotionalDirection || '',
      marketingAngle: o.marketingAngle || '',
      cta: o.cta || '',
      totalDurationSec: o.totalDurationSec || 30,
    };
  }

  if (!picked) {
    const err = new Error('Scenario response missing title/concept/hook');
    err.code = 'invalid_response';
    throw err;
  }

  const title = requireNonEmptyString(picked.title || o.title, 'title');
  const concept = requireNonEmptyString(picked.concept || o.concept, 'concept');
  const hook = requireNonEmptyString(picked.hook || o.hook, 'hook');
  const storyFlow = requireNonEmptyString(
    picked.storyFlow || o.storyFlow || o.content || picked.concept,
    'storyFlow',
  );
  const cta = requireNonEmptyString(picked.cta || o.cta || 'تماس بگیرید', 'cta');

  const sceneBreakdown = Array.isArray(picked.sceneBreakdown)
    ? picked.sceneBreakdown
    : Array.isArray(o.sceneBreakdown)
      ? o.sceneBreakdown
      : [];
  const duration =
    Number(picked.totalDurationSec || o.totalDurationSec || 30) || 30;

  const single = {
    id: 1,
    title,
    concept,
    problem: picked.problem || o.problem || '',
    solution: picked.solution || o.solution || '',
    hook,
    storyFlow,
    content: storyFlow,
    sceneBreakdown,
    emotionalDirection: picked.emotionalDirection || o.emotionalDirection || '',
    marketingAngle: picked.marketingAngle || o.marketingAngle || '',
    cta,
    totalDurationSec: duration,
  };

  return {
    projectId: o.projectId || projectId,
    title: single.title,
    concept: single.concept,
    problem: single.problem,
    solution: single.solution,
    hook: single.hook,
    storyFlow: single.storyFlow,
    content: single.content,
    sceneBreakdown: single.sceneBreakdown,
    emotionalDirection: single.emotionalDirection,
    marketingAngle: single.marketingAngle,
    cta: single.cta,
    totalDurationSec: single.totalDurationSec,
    scenarios: [single],
    recommendedScenarioId: 1,
    videoScenario: {
      title: single.title,
      totalDurationSec: single.totalDurationSec,
    },
    hooks: [single.hook],
    scenes: sceneBreakdown.map((s, i) => ({
      id: s.scene ?? i + 1,
      hook: s.description || '',
      visual: s.description || '',
      durationSec: s.durationSec || 5,
    })),
  };
}

export function normalizeNarrationOutput(output, projectId) {
  const o = asObject(output);
  if (!o) {
    const err = new Error('Narration response is not an object');
    err.code = 'invalid_response';
    throw err;
  }

  const versions = Array.isArray(o.versions) ? o.versions.filter(Boolean) : [];
  let script = typeof o.script === 'string' ? o.script : '';
  let tone = typeof o.tone === 'string' ? o.tone : '';
  let estimatedSeconds =
    Number(o.estimatedSeconds ?? o.estimated_duration ?? o.estimatedDuration) || 30;

  if (!script && versions.length) {
    const preferred =
      versions.find((v) => v.tone === o.recommendedTone) ||
      versions.find((v) => v.tone === tone) ||
      versions[0];
    script = preferred?.script || '';
    tone = tone || preferred?.tone || '';
    estimatedSeconds = Number(preferred?.estimatedSeconds) || estimatedSeconds;
  }

  script = requireNonEmptyString(script, 'script');

  return {
    projectId: o.projectId || projectId,
    script,
    language: o.language || 'fa',
    tone: tone || 'Professional',
    toneExplanation:
      typeof o.toneExplanation === 'string'
        ? o.toneExplanation
        : 'لحن متناسب با هویت برند و مخاطب پروژه انتخاب شد.',
    estimatedSeconds,
    estimated_duration: String(estimatedSeconds),
  };
}

export function normalizeStoryboardOutput(output, projectId) {
  const o = asObject(output);
  if (!o) {
    const err = new Error('Storyboard response is not an object');
    err.code = 'invalid_response';
    throw err;
  }

  const rawScenes = Array.isArray(o.storyboard)
    ? o.storyboard
    : Array.isArray(o.scenes)
      ? o.scenes
      : [];

  if (!rawScenes.length) {
    const err = new Error('Storyboard response missing scenes');
    err.code = 'invalid_response';
    throw err;
  }

  const scenes = rawScenes.filter(Boolean).map((scene, i) => {
    const visual =
      scene.visualDescription ||
      scene.visual ||
      scene.notes ||
      scene.description ||
      '';
    const camera = scene.camera || scene.cameraAngle || scene.camera_direction || '';
    const action =
      scene.characterActions || scene.action || scene.motion || '';
    const duration = scene.duration || scene.durationSec || '';
    const title =
      scene.title ||
      scene.sceneTitle ||
      scene.name ||
      `Scene ${i + 1}`;
    const visualDirection =
      scene.visualDirection ||
      scene.visualGuide ||
      [scene.environment, scene.lighting, scene.visualStyle]
        .filter(Boolean)
        .join(' — ');
    const imagePrompt =
      typeof scene.imagePrompt === 'string'
        ? scene.imagePrompt.trim()
        : typeof scene.image_prompt === 'string'
          ? scene.image_prompt.trim()
          : '';
    if (!String(visual).trim()) {
      const err = new Error(`Storyboard scene ${i + 1} missing visual`);
      err.code = 'invalid_response';
      throw err;
    }
    return {
      ...scene,
      sceneNumber: scene.sceneNumber ?? scene.scene_number ?? scene.shot ?? i + 1,
      scene_number: scene.sceneNumber ?? scene.scene_number ?? scene.shot ?? i + 1,
      shot: scene.shot ?? scene.sceneNumber ?? scene.scene_number ?? i + 1,
      title: String(title).trim(),
      duration: String(duration || '5s'),
      camera,
      cameraAngle: scene.cameraAngle || camera,
      visual,
      visualDescription: visual,
      description: visual,
      action,
      characterActions: action,
      transition: scene.transition || 'Cut',
      environment: scene.environment || '',
      lighting: scene.lighting || '',
      visualDirection: String(visualDirection || '').trim(),
      motion: scene.motion || action,
      dialogue: scene.dialogue || '',
      soundEffects: scene.soundEffects || '',
      editingNotes: scene.editingNotes || '',
      visualStyle: scene.visualStyle || '',
      notes: scene.notes || visual,
      imagePrompt,
      // Preserve previously generated stills when re-normalizing edits
      imageUrl: scene.imageUrl || scene.image_url || null,
      imageStorageKey: scene.imageStorageKey || null,
      imageProvider: scene.imageProvider || null,
      imageModel: scene.imageModel || null,
      imageGeneratedAt: scene.imageGeneratedAt || null,
    };
  });

  const imagePrompts = Array.isArray(o.imagePrompts)
    ? o.imagePrompts
    : Array.isArray(o.openaiImagePrompts)
      ? o.openaiImagePrompts
      : scenes.map((s) => s.imagePrompt).filter(Boolean);

  // Fill missing per-scene prompts from top-level list
  scenes.forEach((scene, i) => {
    if (!scene.imagePrompt && imagePrompts[i]) {
      scene.imagePrompt = String(imagePrompts[i]);
    }
  });

  const videoPrompts = Array.isArray(o.videoPrompts)
    ? o.videoPrompts
    : Array.isArray(o.soraVideoPrompts)
      ? o.soraVideoPrompts
      : [];

  return {
    projectId: o.projectId || projectId,
    visualStyleGuide:
      typeof o.visualStyleGuide === 'string' ? o.visualStyleGuide : '',
    storyboard: scenes,
    scenes,
    imagePrompts: scenes.map((s, i) => s.imagePrompt || imagePrompts[i] || ''),
    videoPrompts,
    openaiImagePrompts: scenes.map((s, i) => s.imagePrompt || imagePrompts[i] || ''),
    soraVideoPrompts: videoPrompts,
  };
}

export function normalizePipelineOutputs(outputs, projectId) {
  if (!outputs || typeof outputs !== 'object') return outputs;
  return {
    scenario: normalizeScenarioOutput(outputs.scenario, projectId),
    narration: normalizeNarrationOutput(outputs.narration, projectId),
    storyboard: normalizeStoryboardOutput(outputs.storyboard, projectId),
  };
}

export function validateAgentOutput(agentType, output, projectId) {
  if (agentType === 'SCENARIO') return normalizeScenarioOutput(output, projectId);
  if (agentType === 'NARRATION') return normalizeNarrationOutput(output, projectId);
  if (agentType === 'STORYBOARD') return normalizeStoryboardOutput(output, projectId);
  return output;
}
