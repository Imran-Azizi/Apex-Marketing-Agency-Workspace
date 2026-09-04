/**
 * Storyboard still-image generation helpers.
 * Generates a sharp still per scene, then composites ONE labeled storyboard sheet.
 */

import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { storage } from '../storage.js';
import { aiProvider } from './ai.service.js';
import { normalizeStoryboardOutput } from './validate.js';
import {
  STORYBOARD_IMAGE_SIZE,
  buildSceneImagePrompt,
  collageGrid,
  extractProjectBrandContext,
  extractScenarioContext,
  extractSceneNarrationHint,
  sceneImageSeed,
  validateImagePrompt,
} from './storyboard-image-prompt.js';
import { composeStoryboardSheet, storyboardSheetLayout } from './storyboard-sheet.js';

export { buildSceneImagePrompt, collageGrid } from './storyboard-image-prompt.js';
export { storyboardSheetLayout } from './storyboard-sheet.js';

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

async function imageToBuffer(image) {
  if (image?.b64) {
    const buffer = Buffer.from(image.b64, 'base64');
    return buffer.length >= 8000 ? buffer : null;
  }
  if (!image?.url) return null;
  try {
    const res = await fetch(image.url, { redirect: 'follow' });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.startsWith('image/')) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return buffer.length >= 8000 ? buffer : null;
  } catch {
    return null;
  }
}

async function persistJpegBuffer(buffer, { projectId, label = 'collage' }) {
  if (!buffer || buffer.length < 8000) return { url: null, storageKey: null };
  try {
    const saved = await storage.saveBuffer(buffer, {
      filename: `storyboard-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}.jpg`,
      folder: 'uploads',
      contentType: 'image/jpeg',
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

function placeholderCollageUrl(sceneCount = 1) {
  const label = encodeURIComponent(`Storyboard ${sceneCount} scenes`);
  return `https://placehold.co/1920x1080/1f2937/d4af37/png?text=${label}&font=source-sans-pro`;
}

function canGenerateImages() {
  return Boolean(
    env.openrouterApiKey ||
      env.openaiApiKey ||
      env.aiImageProvider === 'free' ||
      env.aiImageProvider === 'pollinations' ||
      env.aiImageProvider === 'auto',
  );
}

/**
 * Generate distinct stills, then one composed storyboard sheet for the UI.
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
  const grid = collageGrid(scenes.length);
  const layout = storyboardSheetLayout(scenes.length);

  const prompts = [];
  for (let i = 0; i < scenes.length; i += 1) {
    const fallback = buildSceneImagePrompt(scenes[i], {
      styleGuide,
      projectContext: ctx.projectContext,
      scenarioContext: ctx.scenarioContext,
      narrationContext: extractSceneNarrationHint(ctx.narration, i, scenes.length),
      sceneIndex: i,
      totalScenes: scenes.length,
    });
    prompts.push(fallback);
  }

  const readyPrompts = prompts.map((prompt, i) => {
    const check = validateImagePrompt(prompt, scenes[i]);
    return check.ok ? prompt : '';
  });
  const seeds = scenes.map((scene, i) =>
    sceneImageSeed(projectId, scene.sceneNumber || i + 1, i + 1),
  );

  let generated = { provider: 'mock', model: null, images: [] };
  try {
    generated = await aiProvider.generateImagesFromPrompts(readyPrompts, {
      size: STORYBOARD_IMAGE_SIZE,
      seeds,
      enhance: false,
      preferQuality: true,
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

  const byIndex = new Map((generated.images || []).map((img) => [img.index, img]));
  const sheetPanels = [];
  const enriched = [];

  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    const promptCheck = validateImagePrompt(prompts[i], scene);
    const image = byIndex.get(i) || { index: i, prompt: prompts[i], url: null };
    const buffer = promptCheck.ok ? await imageToBuffer(image) : null;
    sheetPanels.push({
      buffer,
      sceneNumber: scene.sceneNumber || i + 1,
      title: scene.title || '',
    });
    enriched.push({
      ...scene,
      imagePrompt: prompts[i],
      imageUrl: null,
      imageStorageKey: null,
      imageProvider: generated.provider || null,
      imageModel: generated.model || null,
      imageGeneratedAt: null,
      imageError: promptCheck.ok
        ? image.error || (buffer ? null : 'تولید تصویر صحنه ناموفق بود')
        : promptCheck.error,
    });
  }

  let collageUrl = null;
  let collageKey = null;
  let collageError = null;
  const usablePanels = sheetPanels.filter((panel) => panel.buffer).length;

  if (usablePanels > 0) {
    try {
      const sheet = await composeStoryboardSheet(sheetPanels);
      const saved = await persistJpegBuffer(sheet, { projectId, label: 'collage' });
      collageUrl = saved.url;
      collageKey = saved.storageKey;
      if (!collageUrl) collageError = 'ذخیره شیت استوری‌بورد ناموفق بود';
    } catch (err) {
      collageError = err.message || 'ساخت شیت استوری‌بورد ناموفق بود';
    }
  } else if (env.aiProvider === 'mock' || !canGenerateImages()) {
    collageUrl = placeholderCollageUrl(scenes.length);
  } else {
    collageError = 'تولید تصاویر صحنه‌ها ناموفق بود';
  }

  return {
    ...normalized,
    storyboard: enriched,
    scenes: enriched,
    imagePrompts: enriched.map((s) => s.imagePrompt),
    openaiImagePrompts: enriched.map((s) => s.imagePrompt),
    collageImageUrl: collageUrl,
    collageImageStorageKey: collageKey,
    collageImagePrompt: `Composed ${scenes.length}-scene storyboard sheet (${grid.cols}x${grid.rows}).`,
    collageLayout: {
      cols: grid.cols,
      rows: grid.rows,
      sceneCount: scenes.length,
      unused: layout.unused,
    },
    collageImageError: collageError,
    imagesMeta: {
      layout: 'composed-sheet',
      provider: generated.provider,
      model:
        generated.model ||
        env.pollinationsImageModel ||
        env.openrouterImageModel ||
        env.openaiImageModel ||
        null,
      generatedAt: new Date().toISOString(),
      count: collageUrl ? 1 : 0,
      sceneStills: usablePanels,
      sceneCount: scenes.length,
      cols: grid.cols,
      rows: grid.rows,
      size: `${layout.width}x${layout.height}`,
      error: collageError,
    },
  };
}
