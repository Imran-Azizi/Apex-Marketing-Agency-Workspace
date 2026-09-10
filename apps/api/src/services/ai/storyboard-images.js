/**
 * Storyboard still-image generation helpers.
 * Generates a sharp still per scene, then composites ONE labeled storyboard sheet.
 * Validates scene grounding and regenerates clearly unrelated stills once.
 */

import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { storage } from '../storage.js';
import { aiProvider } from './ai.service.js';
import { openRouterService } from './openrouter.service.js';
import { normalizeStoryboardOutput } from './validate.js';
import { isSafeExternalUrl } from '../../utils/ssrf.js';
import {
  STORYBOARD_IMAGE_SIZE,
  buildReinforcedSceneImagePrompt,
  buildSceneImagePrompt,
  buildSceneRelevanceSummary,
  collageGrid,
  extractProjectBrandContext,
  extractScenarioContext,
  extractSceneNarrationHint,
  sceneImageSeed,
  scorePromptRelevance,
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
  if (!image?.url || !isSafeExternalUrl(image.url)) return null;
  try {
    const res = await fetch(image.url, { redirect: 'error' });
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

function promptOptionsForScene(scene, index, scenes, ctx, styleGuide, { reinforce = false } = {}) {
  return {
    styleGuide,
    projectContext: ctx.projectContext,
    scenarioContext: ctx.scenarioContext,
    narrationContext: extractSceneNarrationHint(ctx.narration, index, scenes.length),
    sceneIndex: index,
    totalScenes: scenes.length,
    reinforce,
  };
}

/**
 * Optional vision check: ask a light multimodal model if the still matches the scene.
 * Non-fatal — returns null when vision is unavailable or times out.
 */
async function scoreImageRelevanceWithVision(buffer, sceneSummary) {
  if (!buffer || buffer.length < 8000 || !sceneSummary) return null;

  const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
  const system =
    'You validate advertising storyboard stills. Reply ONLY JSON: {"relevant":true|false,"score":0-1,"reason":"short"}. relevant=false only when the image clearly does not match the scene/product.';
  const userContent = [
    {
      type: 'text',
      text: `Does this image visually match this storyboard scene?\n${sceneSummary}\nReply JSON only.`,
    },
    { type: 'image_url', image_url: { url: dataUrl } },
  ];

  async function askOpenAI() {
    if (!env.openaiApiKey) return null;
    const baseUrl = (env.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: env.openaiModelLight || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userContent },
          ],
          temperature: 0,
          max_tokens: 120,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || '';
      return JSON.parse(text);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function askOpenRouter() {
    if (!openRouterService.isConfigured?.() && !env.openrouterApiKey) return null;
    const baseUrl = (env.openrouterBaseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.openrouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': env.webUrl || 'http://localhost:3000',
          'X-Title': 'APEX Workspace',
        },
        body: JSON.stringify({
          model: env.openrouterBackupModel || 'openai/gpt-4o-mini',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userContent },
          ],
          temperature: 0,
          max_tokens: 120,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || '';
      return JSON.parse(text);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  const parsed = (await askOpenAI()) || (await askOpenRouter());
  if (!parsed || typeof parsed !== 'object') return null;
  return {
    relevant: parsed.relevant !== false && Number(parsed.score ?? 1) >= 0.45,
    score: Number(parsed.score ?? (parsed.relevant === false ? 0 : 0.8)),
    reason: String(parsed.reason || '').slice(0, 160),
  };
}

async function generateSingleStill(prompt, { size, seed }) {
  if (!String(prompt || '').trim()) {
    return { prompt, url: null, b64: null, error: 'Empty image prompt' };
  }
  try {
    const result = await aiProvider.generateImagesFromPrompts([prompt], {
      size,
      seeds: [seed],
      enhance: false,
      preferQuality: true,
    });
    const image = result?.images?.[0] || {};
    return {
      prompt,
      url: image.url || null,
      b64: image.b64 || null,
      error: image.error || null,
      provider: result?.provider || null,
      model: result?.model || null,
    };
  } catch (err) {
    return { prompt, url: null, b64: null, error: err.message };
  }
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
  const promptMeta = [];
  for (let i = 0; i < scenes.length; i += 1) {
    const options = promptOptionsForScene(scenes[i], i, scenes, ctx, styleGuide);
    let prompt = buildSceneImagePrompt(scenes[i], options);
    let check = validateImagePrompt(prompt, scenes[i], options);
    if (!check.ok || check.grounded === false) {
      prompt = buildReinforcedSceneImagePrompt(scenes[i], options);
      check = validateImagePrompt(prompt, scenes[i], { ...options, reinforce: true });
    }
    prompts.push(check.ok ? prompt : '');
    promptMeta.push({ check, options, prompt });
  }

  const readyPrompts = prompts.map((prompt) => prompt || '');
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
  let regeneratedCount = 0;

  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    const meta = promptMeta[i];
    const promptCheck = validateImagePrompt(prompts[i], scene, meta.options);
    let image = byIndex.get(i) || { index: i, prompt: prompts[i], url: null };
    let buffer = promptCheck.ok ? await imageToBuffer(image) : null;
    let usedPrompt = prompts[i];
    let wasRegenerated = false;
    let relevance = scorePromptRelevance(usedPrompt, scene, meta.options);
    let imageError = null;

    // Vision is reserved for weakly grounded prompts — avoids slowing every scene.
    const shouldVisionCheck =
      Boolean(buffer) &&
      (meta.check?.grounded === false || (relevance.score ?? 1) < 0.45);
    if (shouldVisionCheck) {
      const summary = buildSceneRelevanceSummary(scene, meta.options);
      const vision = await scoreImageRelevanceWithVision(buffer, summary);
      if (vision) {
        relevance = {
          relevant: vision.relevant,
          score: vision.score,
          reason: vision.reason || relevance.reason,
        };
      }
    }

    const needsRetry =
      promptCheck.ok &&
      (!buffer || relevance.relevant === false) &&
      canGenerateImages() &&
      env.aiProvider !== 'mock';

    if (needsRetry) {
      const reinforced = buildReinforcedSceneImagePrompt(scene, meta.options);
      const reinforcedCheck = validateImagePrompt(reinforced, scene, {
        ...meta.options,
        reinforce: true,
      });
      if (reinforcedCheck.ok) {
        const retrySeed = sceneImageSeed(projectId, scene.sceneNumber || i + 1, i + 101);
        const retry = await generateSingleStill(reinforced, {
          size: STORYBOARD_IMAGE_SIZE,
          seed: retrySeed,
        });
        const retryBuffer = await imageToBuffer(retry);
        if (retryBuffer) {
          let acceptRetry = true;
          const summary = buildSceneRelevanceSummary(scene, meta.options);
          const vision = await scoreImageRelevanceWithVision(retryBuffer, summary);
          if (vision && vision.relevant === false && buffer && relevance.relevant !== false) {
            acceptRetry = false;
          }
          if (acceptRetry) {
            buffer = retryBuffer;
            usedPrompt = reinforced;
            image = { ...retry, index: i };
            wasRegenerated = true;
            regeneratedCount += 1;
            relevance = vision
              ? {
                  relevant: vision.relevant !== false,
                  score: vision.score,
                  reason: vision.reason || 'regenerated',
                }
              : scorePromptRelevance(reinforced, scene, meta.options);
            if (
              generated.provider &&
              retry.provider &&
              !String(generated.provider).includes(retry.provider)
            ) {
              generated.provider = `${generated.provider}+retry`;
            }
          }
        } else if (!buffer) {
          imageError = retry.error || 'تولید مجدد تصویر صحنه ناموفق بود';
        }
      }
    }

    if (!promptCheck.ok) {
      imageError = promptCheck.error;
    } else if (!buffer) {
      imageError = imageError || image.error || 'تولید تصویر صحنه ناموفق بود';
    } else if (relevance.relevant === false) {
      imageError = 'تصویر تولیدشده با محتوای صحنه هم‌خوان نبود';
    }

    sheetPanels.push({
      buffer: relevance.relevant === false ? null : buffer,
      sceneNumber: scene.sceneNumber || i + 1,
      title: scene.title || '',
    });

    // Keep buffer in collage only when relevant; still record prompt/meta on the scene.
    const acceptedBuffer = relevance.relevant === false ? null : buffer;

    enriched.push({
      ...scene,
      imagePrompt: usedPrompt,
      imageUrl: null,
      imageStorageKey: null,
      imageProvider: image.provider || generated.provider || null,
      imageModel: image.model || generated.model || null,
      imageGeneratedAt: acceptedBuffer ? new Date().toISOString() : null,
      imageError: acceptedBuffer ? null : imageError,
      imageRelevance:
        acceptedBuffer || relevance
          ? {
              relevant: Boolean(acceptedBuffer) && relevance.relevant !== false,
              score: relevance.score ?? null,
              reason: relevance.reason || null,
              regenerated: wasRegenerated,
            }
          : null,
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
      regeneratedScenes: regeneratedCount,
      cols: grid.cols,
      rows: grid.rows,
      size: `${layout.width}x${layout.height}`,
      error: collageError,
    },
  };
}
