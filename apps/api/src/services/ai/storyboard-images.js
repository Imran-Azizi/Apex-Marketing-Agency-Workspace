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
import { fetchRelatedStockStill } from './related-stock-images.js';

export { buildSceneImagePrompt, collageGrid } from './storyboard-image-prompt.js';
export { storyboardSheetLayout } from './storyboard-sheet.js';

async function loadImageGenerationContext(
  projectId,
  { scenario, narration, projectContext: providedContext } = {},
) {
  if (providedContext && typeof providedContext === 'object') {
    return {
      projectContext: providedContext,
      scenarioContext: extractScenarioContext(scenario),
      narration,
    };
  }

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
    return buffer.length >= 4000 ? buffer : null;
  }
  if (!image?.url || !isSafeExternalUrl(image.url)) return null;
  try {
    const res = await fetch(image.url, { redirect: 'follow' });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || (ct && !ct.startsWith('image/') && !ct.includes('octet-stream'))) {
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    return buffer.length >= 4000 ? buffer : null;
  } catch {
    return null;
  }
}

async function persistJpegBuffer(buffer, { projectId, label = 'collage' }) {
  if (!buffer || buffer.length < 4000) return { url: null, storageKey: null };
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
  } catch (err) {
    console.warn('[AI storyboard images] persist failed:', err?.message || err);
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
      env.geminiApiKey ||
      env.pollinationsApiKey ||
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
  { projectId, scenario, narration, projectContext } = {},
) {
  if (!storyboard || typeof storyboard !== 'object') return storyboard;

  const normalized = normalizeStoryboardOutput(storyboard, projectId);
  const scenes = Array.isArray(normalized.storyboard) ? normalized.storyboard : [];
  if (!scenes.length) return normalized;

  const ctx = await loadImageGenerationContext(projectId, {
    scenario,
    narration,
    projectContext,
  });
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
  const sheetPanels = new Array(scenes.length);
  const enriched = new Array(scenes.length);
  let regeneratedCount = 0;

  /** @type {Array<{ index: number, scene: any, meta: any, promptCheck: any, image: any, buffer: Buffer | null, usedPrompt: string, relevance: any, imageError: string | null, needsRetry: boolean }>} */
  const draft = [];

  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    const meta = promptMeta[i];
    const promptCheck = validateImagePrompt(prompts[i], scene, meta.options);
    const image = byIndex.get(i) || { index: i, prompt: prompts[i], url: null };
    let buffer = promptCheck.ok ? await imageToBuffer(image) : null;
    let usedPrompt = prompts[i];
    let relevance = scorePromptRelevance(usedPrompt, scene, meta.options);
    let imageError = null;

    // Vision only when text grounding is weak — saves latency on healthy generations.
    const shouldVisionCheck =
      Boolean(buffer) &&
      (meta.check?.grounded === false || (relevance.score ?? 1) < 0.4);
    if (shouldVisionCheck) {
      const summary = buildSceneRelevanceSummary(scene, meta.options);
      const vision = await scoreImageRelevanceWithVision(buffer, summary);
      if (vision) {
        const softRelevant =
          vision.relevant !== false || Number(vision.score ?? 0) >= 0.3;
        relevance = {
          relevant: softRelevant,
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

    if (!promptCheck.ok) {
      imageError = promptCheck.error;
    } else if (!buffer) {
      imageError = image.error || 'تولید تصویر صحنه ناموفق بود';
    } else if (relevance.relevant === false) {
      imageError = 'تصویر تولیدشده با محتوای صحنه هم‌خوان نبود';
    }

    draft.push({
      index: i,
      scene,
      meta,
      promptCheck,
      image,
      buffer,
      usedPrompt,
      relevance,
      imageError,
      needsRetry,
      wasRegenerated: false,
    });
  }

  // Batch weak/failed scenes in one image call instead of N sequential retries.
  const retryIndexes = draft
    .filter((row) => row.needsRetry)
    .map((row) => row.index);
  if (retryIndexes.length) {
    const retryPrompts = retryIndexes.map((i) => {
      const reinforced = buildReinforcedSceneImagePrompt(
        draft[i].scene,
        draft[i].meta.options,
      );
      const reinforcedCheck = validateImagePrompt(reinforced, draft[i].scene, {
        ...draft[i].meta.options,
        reinforce: true,
      });
      return reinforcedCheck.ok ? reinforced : '';
    });
    const retrySeeds = retryIndexes.map((i) =>
      sceneImageSeed(projectId, draft[i].scene.sceneNumber || i + 1, i + 101),
    );

    let retryGenerated = { provider: null, model: null, images: [] };
    try {
      retryGenerated = await aiProvider.generateImagesFromPrompts(retryPrompts, {
        size: STORYBOARD_IMAGE_SIZE,
        seeds: retrySeeds,
        enhance: false,
        preferQuality: true,
      });
    } catch (err) {
      console.warn(
        '[AI storyboard images] batched retry failed:',
        err?.message || err,
      );
    }

    for (let r = 0; r < retryIndexes.length; r += 1) {
      const i = retryIndexes[r];
      const row = draft[i];
      const reinforced = retryPrompts[r];
      if (!reinforced) continue;
      const retryImage =
        (retryGenerated.images || []).find((img) => img.index === r) ||
        (retryGenerated.images || [])[r] ||
        null;
      if (!retryImage) continue;
      const retryBuffer = await imageToBuffer({ ...retryImage, index: i });
      if (!retryBuffer) {
        if (!row.buffer) {
          row.imageError =
            retryImage.error || 'تولید مجدد تصویر صحنه ناموفق بود';
        }
        continue;
      }

      let acceptRetry = true;
      if (row.buffer && row.relevance?.relevant !== false) {
        const summary = buildSceneRelevanceSummary(row.scene, row.meta.options);
        const vision = await scoreImageRelevanceWithVision(retryBuffer, summary);
        if (vision && vision.relevant === false && Number(vision.score ?? 0) < 0.3) {
          acceptRetry = false;
        }
      }
      if (!acceptRetry) continue;

      row.buffer = retryBuffer;
      row.usedPrompt = reinforced;
      row.image = { ...retryImage, index: i };
      row.wasRegenerated = true;
      regeneratedCount += 1;
      row.relevance = {
        relevant: true,
        score: Math.max(row.relevance?.score ?? 0.5, 0.55),
        reason: 'regenerated',
      };
      row.imageError = null;
      if (
        generated.provider &&
        retryGenerated.provider &&
        !String(generated.provider).includes(retryGenerated.provider)
      ) {
        generated.provider = `${generated.provider}+retry`;
      }
    }
  }

  // Persist accepted scene stills in parallel.
  await Promise.all(
    draft.map(async (row) => {
      const { index: i, scene, image, relevance, wasRegenerated } = row;
      const acceptedBuffer =
        relevance?.relevant === false ? null : row.buffer;

      sheetPanels[i] = {
        buffer: acceptedBuffer,
        sceneNumber: scene.sceneNumber || i + 1,
        title: scene.title || '',
      };

      let sceneUrl = null;
      let sceneKey = null;
      if (acceptedBuffer) {
        const savedScene = await persistJpegBuffer(acceptedBuffer, {
          projectId,
          label: `scene-${scene.sceneNumber || i + 1}`,
        });
        sceneUrl = savedScene.url;
        sceneKey = savedScene.storageKey;
      } else if (!row.imageError) {
        row.imageError =
          row.promptCheck?.ok === false
            ? row.promptCheck.error
            : !row.buffer
              ? image.error || 'تولید تصویر صحنه ناموفق بود'
              : 'تصویر تولیدشده با محتوای صحنه هم‌خوان نبود';
      }

      enriched[i] = {
        ...scene,
        imagePrompt: row.usedPrompt,
        imageUrl: sceneUrl,
        imageStorageKey: sceneKey,
        imageProvider: image.provider || generated.provider || null,
        imageModel: image.model || generated.model || null,
        imageGeneratedAt: acceptedBuffer ? new Date().toISOString() : null,
        imageError: acceptedBuffer ? null : row.imageError,
        imageRelevance:
          acceptedBuffer || relevance
            ? {
                relevant: Boolean(acceptedBuffer) && relevance.relevant !== false,
                score: relevance.score ?? null,
                reason: relevance.reason || null,
                regenerated: wasRegenerated,
              }
            : null,
      };
    }),
  );

  let collageUrl = null;
  let collageKey = null;
  let collageError = null;
  let usablePanels = sheetPanels.filter((panel) => panel?.buffer).length;
  let usedStockFallback = false;

  // When paid AI image APIs fail (quota/key), pull project-related photoreal
  // Creative Commons stills grounded in each scene prompt — never fake gradients.
  if (usablePanels === 0 && env.aiProvider !== 'mock') {
    usedStockFallback = true;
    await Promise.all(
      scenes.map(async (scene, i) => {
        try {
          const stock = await fetchRelatedStockStill(
            prompts[i] || scene.imagePrompt,
            {
              scene,
              seed: seeds[i] || i + 1,
            },
          );
          const stockBuffer = stock.b64
            ? Buffer.from(stock.b64, 'base64')
            : null;
          if (!stockBuffer || stockBuffer.length < 8000) {
            enriched[i] = {
              ...enriched[i],
              imageError: stock.error || 'تصویر مرتبط برای صحنه یافت نشد',
            };
            return;
          }
          sheetPanels[i] = {
            buffer: stockBuffer,
            sceneNumber: scene.sceneNumber || i + 1,
            title: scene.title || '',
          };
          const savedScene = await persistJpegBuffer(stockBuffer, {
            projectId,
            label: `scene-${scene.sceneNumber || i + 1}`,
          });
          enriched[i] = {
            ...enriched[i],
            imageUrl: savedScene.url,
            imageStorageKey: savedScene.storageKey,
            imageProvider: 'openverse',
            imageModel: 'related-stock',
            imageGeneratedAt: new Date().toISOString(),
            imageError: null,
            imageSource: stock.meta || null,
            imageRelevance: {
              relevant: true,
              score: 0.65,
              reason: 'project-related-stock',
              regenerated: false,
            },
          };
        } catch (err) {
          console.warn(
            '[AI storyboard images] related stock failed:',
            err?.message || err,
          );
          enriched[i] = {
            ...enriched[i],
            imageError: err?.message || 'دریافت تصویر مرتبط ناموفق بود',
          };
        }
      }),
    );
    usablePanels = sheetPanels.filter((panel) => panel?.buffer).length;
    if (usablePanels > 0) {
      generated = {
        provider: 'openverse',
        model: 'related-stock',
        images: generated.images || [],
      };
    }
  }

  if (usablePanels > 0) {
    try {
      const sheet = await composeStoryboardSheet(sheetPanels);
      const saved = await persistJpegBuffer(sheet, { projectId, label: 'collage' });
      collageUrl = saved.url;
      collageKey = saved.storageKey;
      // URL may be missing while storageKey is valid — UI resolves via filePreviewUrl(key).
      if (!collageUrl && !collageKey) {
        collageError = 'ذخیره شیت استوری‌بورد ناموفق بود';
      }
    } catch (err) {
      collageError = err.message || 'ساخت شیت استوری‌بورد ناموفق بود';
    }

    // Fallback: if collage compose/save failed, use the first persisted scene still.
    if (!collageUrl && !collageKey) {
      const firstScene = enriched.find((s) => s.imageUrl || s.imageStorageKey);
      if (firstScene) {
        collageUrl = firstScene.imageUrl || null;
        collageKey = firstScene.imageStorageKey || null;
        collageError = null;
      }
    }
  } else if (env.aiProvider === 'mock' || !canGenerateImages()) {
    collageUrl = placeholderCollageUrl(scenes.length);
  } else {
    collageError =
      'تولید تصاویر صحنه‌ها ناموفق بود. برای تصاویر AI اعتبار OpenRouter/Gemini اضافه کنید.';
    console.warn(
      '[AI storyboard images] no usable stills',
      JSON.stringify({
        provider: generated.provider,
        model: generated.model,
        stockFallback: usedStockFallback,
        errors: (generated.images || [])
          .map((img) => img.error)
          .filter(Boolean)
          .slice(0, 5),
      }),
    );
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
        env.geminiImageModel ||
        env.openaiImageModel ||
        null,
      generatedAt: new Date().toISOString(),
      count: collageUrl || collageKey ? 1 : 0,
      sceneStills: usablePanels,
      sceneCount: scenes.length,
      regeneratedScenes: regeneratedCount,
      relatedStockFallback: usedStockFallback,
      cols: grid.cols,
      rows: grid.rows,
      size: `${layout.width}x${layout.height}`,
      error: collageError,
    },
  };
}
