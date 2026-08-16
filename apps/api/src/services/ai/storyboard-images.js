/**
 * Storyboard still-image generation helpers.
 * Attaches reference images to each scene without breaking text storyboard shape.
 */

import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { storage } from '../storage.js';
import { aiProvider } from './ai.service.js';
import { openRouterService } from './openrouter.service.js';
import { normalizeStoryboardOutput } from './validate.js';
import {
  STORYBOARD_IMAGE_SIZE,
  buildSceneImagePrompt,
  extractProjectBrandContext,
  extractScenarioContext,
  extractSceneNarrationHint,
  resolveShotType,
  sceneImageSeed,
  validateImagePrompt,
} from './storyboard-image-prompt.js';

export { buildSceneImagePrompt } from './storyboard-image-prompt.js';

async function loadImageGenerationContext(projectId, { scenario, narration } = {}) {
  if (!projectId) {
    return {
      projectContext: {},
      scenarioContext: extractScenarioContext(scenario),
      narration,
    };
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      crmCustomer: true,
      service: true,
      format: true,
      files: {
        where: { deletedAt: null },
        take: 12,
      },
      assetRefs: {
        include: { clientAsset: true },
        take: 12,
      },
    },
  });

  return {
    projectContext: extractProjectBrandContext(project || {}),
    scenarioContext: extractScenarioContext(scenario),
    narration,
  };
}

async function persistGeneratedImage(image, { projectId, sceneNumber }) {
  let buffer = null;
  let contentType = image?.contentType || 'image/jpeg';

  if (image?.b64) {
    buffer = Buffer.from(image.b64, 'base64');
  } else if (image?.url) {
    try {
      const res = await fetch(image.url, { redirect: 'follow' });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.startsWith('image/')) {
        buffer = Buffer.from(await res.arrayBuffer());
        contentType = ct;
      }
    } catch {
      buffer = null;
    }
  }

  if (!buffer || buffer.length < 8000) {
    return { url: null, storageKey: null };
  }

  try {
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const saved = await storage.saveBuffer(buffer, {
      filename: `storyboard-scene-${sceneNumber}-${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`,
      folder: 'uploads',
      contentType,
      uploadContext: {
        folder: 'uploads',
        projectId: projectId || undefined,
      },
    });
    return {
      url: saved.publicUrl || saved.url || saved.secure_url || null,
      storageKey: saved.key || saved.storageKey || null,
    };
  } catch {
    return { url: null, storageKey: null };
  }
}

function placeholderUrl(sceneNumber, title = '') {
  const label = encodeURIComponent(`Scene ${sceneNumber}${title ? `: ${title}` : ''}`);
  return `https://placehold.co/1920x1080/1f2937/d4af37/png?text=${label}&font=source-sans-pro`;
}

function buildPromptsForScenes(scenes, ctx, { styleGuide, customPrompt, sceneIndex } = {}) {
  const totalScenes = scenes.length;
  const buildOne = (scene, index) =>
    buildSceneImagePrompt(scene, {
      styleGuide,
      customPrompt: sceneIndex === index ? customPrompt : undefined,
      projectContext: ctx.projectContext,
      scenarioContext: ctx.scenarioContext,
      narrationContext: extractSceneNarrationHint(ctx.narration, index, totalScenes),
      sceneIndex: index,
      totalScenes,
    });

  if (typeof sceneIndex === 'number') {
    return [buildOne(scenes[sceneIndex], sceneIndex)];
  }

  return scenes.map((scene, index) => buildOne(scene, index));
}

function compactSceneForLlm(scene) {
  return {
    sceneNumber: scene.sceneNumber ?? scene.scene_number,
    title: scene.title,
    visual: scene.visualDescription || scene.visual,
    camera: scene.camera || scene.cameraAngle,
    action: scene.characterActions || scene.action,
    environment: scene.environment,
    lighting: scene.lighting,
    mood: scene.visualDirection,
  };
}

async function polishPromptWithLlm(fallbackPrompt, { scene, ctx, sceneIndex, totalScenes }) {
  if (!openRouterService.isConfigured() || env.aiProvider === 'mock') {
    return fallbackPrompt;
  }

  try {
    const shot = resolveShotType(scene);
    const result = await openRouterService.completeChat({
      model: env.openrouterBackupModel || env.openrouterModel,
      temperature: 0.18,
      maxTokens: 280,
      timeoutMs: 25000,
      responseFormat: { type: 'json_object' },
      system:
        'You write ONE English image-generation prompt for a premium commercial video storyboard still. Return JSON {"prompt":"..."}. The first 15 words MUST name the exact visible subject of this scene (translate Persian). Honor the shot type. Photoreal 16:9 cinema still, ARRI Alexa / 35mm look, sharp, cinematic grade. Do not invent a fashion model, sci-fi character, or unrelated portrait. No readable fake text. Max 70 words. ASCII only.',
      userContent: {
        lockedFallback: String(fallbackPrompt).slice(0, 280),
        shot: shot.key,
        frame: `${sceneIndex + 1}/${totalScenes}`,
        scene: compactSceneForLlm(scene),
        project: {
          title: ctx.projectContext?.projectTitle,
          product: ctx.projectContext?.productName,
          message: ctx.projectContext?.mainMessage,
          audience: ctx.projectContext?.audience,
          customer: ctx.projectContext?.customerName,
        },
        scenario: {
          concept: ctx.scenarioContext?.concept,
          hook: ctx.scenarioContext?.hook,
        },
        narration: ctx.narration
          ? extractSceneNarrationHint(ctx.narration, sceneIndex, totalScenes)
          : '',
      },
    });

    let parsed = {};
    try {
      parsed = JSON.parse(result.text);
    } catch {
      const match = String(result.text || '').match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }
    const polished = String(parsed.prompt || '')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (polished.length < 48) return fallbackPrompt;
    return polished.slice(0, 720);
  } catch {
    return fallbackPrompt;
  }
}

async function buildPolishedPrompts(scenes, ctx, options = {}) {
  const base = buildPromptsForScenes(scenes, ctx, options);
  const polished = [];
  for (let i = 0; i < base.length; i += 1) {
    const sceneIndex = typeof options.sceneIndex === 'number' ? options.sceneIndex : i;
    polished.push(
      await polishPromptWithLlm(base[i], {
        scene: scenes[sceneIndex],
        ctx,
        sceneIndex,
        totalScenes: scenes.length,
      }),
    );
  }
  return polished;
}

/**
 * Generate and attach stills for every storyboard scene.
 * Non-fatal: returns storyboard even if some/all images fail.
 */
export async function attachStoryboardImages(
  storyboard,
  { projectId, scenario, narration } = {},
) {
  if (!storyboard || typeof storyboard !== 'object') return storyboard;

  const normalized = normalizeStoryboardOutput(storyboard, projectId);
  const scenes = Array.isArray(normalized.storyboard) ? normalized.storyboard : [];
  if (!scenes.length) return normalized;

  const ctx = await loadImageGenerationContext(projectId, { scenario, narration });
  const styleGuide = normalized.visualStyleGuide || '';
  const prompts = await buildPolishedPrompts(scenes, ctx, { styleGuide });
  const seeds = scenes.map((scene, i) =>
    sceneImageSeed(projectId, scene.sceneNumber || i + 1),
  );

  const readyPrompts = prompts.map((prompt, i) => {
    const check = validateImagePrompt(prompt, scenes[i]);
    return check.ok ? prompt : '';
  });

  let generated = { provider: 'mock', model: null, images: [] };
  try {
    generated = await aiProvider.generateImagesFromPrompts(readyPrompts, {
      size: STORYBOARD_IMAGE_SIZE,
      seeds,
      enhance: false,
    });
  } catch (err) {
    generated = {
      provider: 'error',
      model: null,
      images: prompts.map((prompt, index) => ({
        index,
        prompt,
        error: err.message,
        url: null,
      })),
    };
  }

  const byIndex = new Map(
    (generated.images || []).map((img) => [img.index, img]),
  );
  const canGenerateImages = Boolean(
    env.openrouterApiKey ||
      env.openaiApiKey ||
      env.aiImageProvider === 'free' ||
      env.aiImageProvider === 'pollinations' ||
      env.aiImageProvider === 'auto',
  );

  const enriched = [];
  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    const promptCheck = validateImagePrompt(prompts[i], scene);
    const image = byIndex.get(i) || { index: i, prompt: prompts[i], url: null };
    const persisted = promptCheck.ok
      ? await persistGeneratedImage(image, {
          projectId,
          sceneNumber: scene.sceneNumber || i + 1,
        })
      : { url: null, storageKey: null };
    const url =
      persisted.url ||
      (env.aiProvider === 'mock' || !canGenerateImages
        ? placeholderUrl(scene.sceneNumber || i + 1, scene.title)
        : null);

    enriched.push({
      ...scene,
      imagePrompt: prompts[i],
      imageUrl: url,
      imageStorageKey: persisted.storageKey,
      imageProvider: generated.provider || null,
      imageModel:
        generated.model ||
        env.pollinationsImageModel ||
        env.openrouterImageModel ||
        env.openaiImageModel ||
        null,
      imageGeneratedAt: url ? new Date().toISOString() : null,
      imageError: promptCheck.ok
        ? image.error || null
        : promptCheck.error,
    });
  }

  return {
    ...normalized,
    storyboard: enriched,
    scenes: enriched,
    imagePrompts: enriched.map((s) => s.imagePrompt),
    openaiImagePrompts: enriched.map((s) => s.imagePrompt),
    imagesMeta: {
      provider: generated.provider,
      model: generated.model,
      generatedAt: new Date().toISOString(),
      count: enriched.filter((s) => s.imageUrl).length,
      size: STORYBOARD_IMAGE_SIZE,
    },
  };
}
