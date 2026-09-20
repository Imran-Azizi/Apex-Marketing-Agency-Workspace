/**
 * Shared helpers to normalize Scenario / Narration / Storyboard into
 * ContentVersion payloads (used by manual upload / import flows).
 */

import { resolveSingleScenario } from "@/components/projects/ai-content-views";

export type ScenarioFormState = {
  title: string;
  concept: string;
  problem: string;
  solution: string;
  hook: string;
  storyFlow: string;
  cta: string;
  emotionalDirection: string;
  marketingAngle: string;
};

export type NarrationFormState = {
  script: string;
  tone: string;
  language: string;
  toneExplanation: string;
};

export type StoryboardSceneFormState = {
  sceneNumber: number;
  title: string;
  visualDescription: string;
  visualDirection: string;
  camera: string;
  transition: string;
  characterActions: string;
  notes: string;
  duration: string;
  imageUrl: string;
  imageStorageKey: string;
  imagePrompt: string;
};

export type StoryboardUploadedImage = {
  url: string;
  storageKey: string;
  name?: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export function emptyScenarioForm(): ScenarioFormState {
  return {
    title: "",
    concept: "",
    problem: "",
    solution: "",
    hook: "",
    storyFlow: "",
    cta: "",
    emotionalDirection: "",
    marketingAngle: "",
  };
}

export function emptyNarrationForm(): NarrationFormState {
  return {
    script: "",
    tone: "",
    language: "fa",
    toneExplanation: "",
  };
}

export function emptyStoryboardScenes(): StoryboardSceneFormState[] {
  return [
    {
      sceneNumber: 1,
      title: "",
      visualDescription: "",
      visualDirection: "",
      camera: "",
      transition: "",
      characterActions: "",
      notes: "",
      duration: "",
      imageUrl: "",
      imageStorageKey: "",
      imagePrompt: "",
    },
  ];
}

export function loadScenarioForm(value: unknown): ScenarioFormState {
  const obj = asRecord(value);
  if (obj?.preserveExact === true && typeof obj.manualRaw === "string") {
    return {
      ...emptyScenarioForm(),
      title: str(obj.title) || "سناریوی دستی",
      storyFlow: obj.manualRaw,
      concept: str(obj.concept),
      problem: str(obj.problem),
      solution: str(obj.solution),
      hook: str(obj.hook),
      cta: str(obj.cta),
      emotionalDirection: str(obj.emotionalDirection),
      marketingAngle: str(obj.marketingAngle),
    };
  }
  const scenario = resolveSingleScenario(value);
  if (!scenario) return emptyScenarioForm();
  return {
    title: str(scenario.title),
    concept: str(scenario.concept),
    problem: str(scenario.problem),
    solution: str(scenario.solution),
    hook: str(scenario.hook),
    storyFlow: str(
      scenario.storyFlow || (scenario as { content?: string }).content,
    ),
    cta: str(scenario.cta),
    emotionalDirection: str(scenario.emotionalDirection),
    marketingAngle: str(scenario.marketingAngle),
  };
}

export function loadNarrationForm(value: unknown): NarrationFormState {
  const obj = asRecord(value);
  if (!obj) {
    if (typeof value === "string") {
      return { ...emptyNarrationForm(), script: value };
    }
    return emptyNarrationForm();
  }
  if (obj.preserveExact === true && typeof obj.manualRaw === "string") {
    return {
      ...emptyNarrationForm(),
      script: obj.manualRaw || str(obj.script),
      tone: str(obj.tone),
      language: str(obj.language) || "fa",
      toneExplanation: str(obj.toneExplanation),
    };
  }
  return {
    script: str(obj.script),
    tone: str(obj.tone),
    language: str(obj.language) || "fa",
    toneExplanation: str(obj.toneExplanation),
  };
}

function pushLabeledBlock(
  lines: string[],
  label: string,
  value: unknown,
) {
  const text = str(value).trim();
  if (!text) return;
  lines.push(`${label}:`);
  lines.push(text);
  lines.push("");
}

/** Flatten scenario JSON into one editable plain-text document. */
export function scenarioToEditableText(value: unknown): string {
  const obj = asRecord(value);
  if (obj?.preserveExact === true && typeof obj.manualRaw === "string") {
    return obj.manualRaw;
  }
  if (typeof value === "string") return value;

  const scenario = resolveSingleScenario(value);
  if (!scenario) return "";

  const lines: string[] = [];
  if (str(scenario.title).trim()) {
    lines.push(str(scenario.title).trim());
    lines.push("");
  }
  if (scenario.totalDurationSec) {
    lines.push(`مدت: ${scenario.totalDurationSec} ثانیه`);
    lines.push("");
  }
  pushLabeledBlock(lines, "مفهوم اصلی", scenario.concept);
  pushLabeledBlock(lines, "مشکل", scenario.problem);
  pushLabeledBlock(lines, "راه‌حل", scenario.solution);
  pushLabeledBlock(lines, "هوک", scenario.hook);
  pushLabeledBlock(lines, "جریان ویدیو", scenario.storyFlow || (scenario as { content?: string }).content);
  pushLabeledBlock(lines, "زاویه بازاریابی", scenario.marketingAngle);
  pushLabeledBlock(lines, "جهت احساسی", scenario.emotionalDirection);
  pushLabeledBlock(lines, "CTA", scenario.cta);

  if (Array.isArray(scenario.sceneBreakdown) && scenario.sceneBreakdown.length) {
    lines.push("ساختار صحنه:");
    scenario.sceneBreakdown.forEach((scene, i) => {
      const n = Number(scene?.scene ?? i + 1) || i + 1;
      const desc = str(scene?.description).trim() || "—";
      const dur = scene?.durationSec ? ` (${scene.durationSec}s)` : "";
      lines.push(`${n}. ${desc}${dur}`);
    });
    lines.push("");
  }

  return lines.join("\n").trim();
}

/** Flatten narration JSON into one editable plain-text document. */
export function narrationToEditableText(value: unknown): string {
  const obj = asRecord(value);
  if (obj?.preserveExact === true && typeof obj.manualRaw === "string") {
    return obj.manualRaw;
  }
  if (typeof value === "string") return value;
  return str(obj?.script).trim();
}

/** Flatten storyboard JSON into one editable plain-text document. */
export function storyboardToEditableText(value: unknown): string {
  const obj = asRecord(value);
  if (obj?.preserveExact === true && typeof obj.manualRaw === "string") {
    return obj.manualRaw;
  }
  if (typeof value === "string") return value;

  const scenes = loadStoryboardScenes(value).filter(
    (s) =>
      s.title.trim() ||
      s.visualDescription.trim() ||
      s.characterActions.trim() ||
      s.camera.trim() ||
      s.duration.trim(),
  );
  if (!scenes.length) return "";

  const lines: string[] = [];
  scenes.forEach((scene, i) => {
    const n = scene.sceneNumber || i + 1;
    lines.push(`صحنه ${n}${scene.title.trim() ? ` — ${scene.title.trim()}` : ""}`);
    if (scene.camera.trim()) lines.push(`دوربین: ${scene.camera.trim()}`);
    if (scene.duration.trim()) lines.push(`مدت: ${scene.duration.trim()}`);
    if (scene.visualDescription.trim()) {
      lines.push("توضیح تصویری:");
      lines.push(scene.visualDescription.trim());
    }
    if (scene.characterActions.trim()) {
      lines.push("اقدام شخصیت:");
      lines.push(scene.characterActions.trim());
    }
    if (scene.transition.trim()) lines.push(`انتقال: ${scene.transition.trim()}`);
    if (scene.notes.trim()) lines.push(`یادداشت: ${scene.notes.trim()}`);
    lines.push("");
  });
  return lines.join("\n").trim();
}

/** Keep previously uploaded / generated storyboard images when editing. */
export function extractStoryboardUploadedImages(
  value: unknown,
): StoryboardUploadedImage[] {
  const obj = asRecord(value);
  if (!obj) return [];

  if (Array.isArray(obj.uploadedImages) && obj.uploadedImages.length) {
    return obj.uploadedImages
      .map((item) => {
        const img = asRecord(item);
        if (!img) return null;
        const url = str(img.url).trim();
        const storageKey = str(img.storageKey).trim();
        if (!url && !storageKey) return null;
        const next: StoryboardUploadedImage = {
          url: url || (storageKey ? storageKey : ""),
          storageKey: storageKey || url,
          name: str(img.name) || undefined,
          originalName: str(img.originalName) || undefined,
          mimeType: str(img.mimeType) || undefined,
          sizeBytes:
            typeof img.sizeBytes === "number" ? img.sizeBytes : undefined,
        };
        return next;
      })
      .filter((item): item is StoryboardUploadedImage => item != null);
  }

  const collected: StoryboardUploadedImage[] = [];
  const collageKey = str(
    obj.collageImageStorageKey || obj.collage_image_storage_key,
  ).trim();
  const collageUrlRaw = str(
    obj.collageImageUrl || obj.collage_image_url,
  ).trim();
  if (collageKey || collageUrlRaw) {
    collected.push({
      url: collageUrlRaw || collageKey,
      storageKey: collageKey || collageUrlRaw,
      name: "شیت استوری‌بورد",
      originalName: "شیت استوری‌بورد",
    });
  }

  const scenes = (
    Array.isArray(obj.storyboard)
      ? obj.storyboard
      : Array.isArray(obj.scenes)
        ? obj.scenes
        : []
  ) as Array<Record<string, unknown>>;

  scenes.forEach((scene, i) => {
    const key = str(scene.imageStorageKey || scene.image_storage_key).trim();
    const url = str(scene.imageUrl || scene.image_url).trim();
    if (!key && !url) return;
    const storageKey = key || url;
    if (collected.some((img) => img.storageKey === storageKey || img.url === url)) {
      return;
    }
    collected.push({
      url: url || key,
      storageKey,
      name: str(scene.title) || `صحنه ${i + 1}`,
      originalName: str(scene.title) || `صحنه ${i + 1}`,
    });
  });

  return collected;
}

export function loadStoryboardScenes(
  value: unknown,
): StoryboardSceneFormState[] {
  const obj = asRecord(value);
  const raw = (
    Array.isArray(obj?.storyboard)
      ? obj.storyboard
      : Array.isArray(obj?.scenes)
        ? obj.scenes
        : Array.isArray(value)
          ? value
          : []
  ) as Array<Record<string, unknown>>;

  if (!raw.length) return emptyStoryboardScenes();

  return raw.map((scene, i) => ({
    sceneNumber:
      Number(scene.sceneNumber ?? scene.scene_number ?? scene.shot ?? i + 1) ||
      i + 1,
    title: str(scene.title || scene.sceneTitle),
    visualDescription: str(
      scene.visualDescription ||
        scene.visual ||
        scene.notes ||
        scene.description,
    ),
    visualDirection: str(scene.visualDirection || scene.visualGuide),
    camera: str(scene.camera || scene.cameraAngle),
    transition: str(scene.transition),
    characterActions: str(scene.characterActions || scene.action),
    notes: str(scene.editingNotes || scene.notes),
    duration: str(scene.duration ?? scene.durationSec),
    imageUrl: str(scene.imageUrl || scene.image_url),
    imageStorageKey: str(scene.imageStorageKey || scene.image_storage_key),
    imagePrompt: str(scene.imagePrompt || scene.image_prompt),
  }));
}

export function buildScenarioPayload(
  form: ScenarioFormState,
  original: unknown,
): Record<string, unknown> {
  const base = asRecord(original) || {};
  const title = form.title.trim() || "سناریوی دستی";
  const storyFlow =
    form.storyFlow.trim() || form.concept.trim() || form.hook.trim() || title;
  const concept = form.concept.trim() || storyFlow.slice(0, 600) || title;
  const hook = form.hook.trim() || storyFlow.slice(0, 180) || title;
  const fields = {
    id: 1,
    title,
    concept,
    problem: form.problem.trim(),
    solution: form.solution.trim(),
    hook,
    storyFlow,
    content: storyFlow,
    cta: form.cta.trim() || "تماس بگیرید",
    emotionalDirection: form.emotionalDirection.trim(),
    marketingAngle: form.marketingAngle.trim(),
    totalDurationSec: Number(base.totalDurationSec) || 30,
  };

  const next: Record<string, unknown> = {
    ...base,
    ...fields,
    projectId: base.projectId,
    recommendedScenarioId: 1,
    scenarios: [fields],
    hooks: fields.hook ? [fields.hook] : [],
  };
  delete next.preserveExact;
  delete next.manualRaw;
  return next;
}

export function buildNarrationPayload(
  form: NarrationFormState,
  original: unknown,
): Record<string, unknown> {
  const base = asRecord(original) || {};
  const next: Record<string, unknown> = {
    ...base,
    projectId: base.projectId,
    script: form.script.trim(),
    tone: form.tone.trim(),
    language: form.language.trim() || "fa",
    toneExplanation: "",
    estimatedSeconds: Number(base.estimatedSeconds) || 30,
    estimated_duration: String(Number(base.estimatedSeconds) || 30),
  };
  delete next.preserveExact;
  delete next.manualRaw;
  return next;
}

export function buildStoryboardPayload(
  scenes: StoryboardSceneFormState[],
  original: unknown,
  collage?: { url: string; storageKey: string } | null,
): Record<string, unknown> {
  const base = asRecord(original) || {};
  const normalized = scenes.map((scene, i) => ({
    sceneNumber: scene.sceneNumber || i + 1,
    scene_number: scene.sceneNumber || i + 1,
    shot: scene.sceneNumber || i + 1,
    title: scene.title.trim(),
    visualDescription: scene.visualDescription.trim(),
    visual: scene.visualDescription.trim(),
    description: scene.visualDescription.trim(),
    visualDirection: scene.visualDirection.trim(),
    camera: scene.camera.trim(),
    cameraAngle: scene.camera.trim(),
    transition: scene.transition.trim(),
    characterActions: scene.characterActions.trim(),
    action: scene.characterActions.trim(),
    notes: scene.notes.trim(),
    editingNotes: scene.notes.trim(),
    duration: scene.duration.trim() || undefined,
    imageUrl: scene.imageUrl.trim() || null,
    imageStorageKey: scene.imageStorageKey.trim() || null,
    imagePrompt: scene.imagePrompt.trim() || null,
  }));

  const next: Record<string, unknown> = {
    ...base,
    projectId: base.projectId,
    storyboard: normalized,
    scenes: normalized,
  };
  delete next.preserveExact;
  delete next.manualRaw;

  if (collage !== undefined) {
    if (collage) {
      next.collageImageUrl = collage.url;
      next.collageImageStorageKey = collage.storageKey;
      next.collageImageError = null;
    } else {
      next.collageImageUrl = null;
      next.collageImageStorageKey = null;
    }
  }

  return next;
}

/** Exact-preservation payload for manually typed/pasted/plain-text scenario. */
export function buildExactScenarioPayload(rawText: string): Record<string, unknown> {
  if (typeof rawText !== "string" || !rawText.trim()) {
    throw new Error("متن سناریو خالی است.");
  }
  return {
    preserveExact: true,
    manualRaw: rawText,
    title: "سناریوی دستی",
    concept: "",
    problem: "",
    solution: "",
    hook: "",
    storyFlow: rawText,
    content: rawText,
    cta: "",
    emotionalDirection: "",
    marketingAngle: "",
    totalDurationSec: 30,
    recommendedScenarioId: 1,
    scenarios: [
      {
        id: 1,
        title: "سناریوی دستی",
        concept: "",
        problem: "",
        solution: "",
        hook: "",
        storyFlow: rawText,
        content: rawText,
        cta: "",
        emotionalDirection: "",
        marketingAngle: "",
        totalDurationSec: 30,
      },
    ],
    hooks: [],
  };
}

/** Exact-preservation payload for manually typed/pasted narration. */
export function buildExactNarrationPayload(rawText: string): Record<string, unknown> {
  if (typeof rawText !== "string" || !rawText.trim()) {
    throw new Error("متن نریشن خالی است.");
  }
  return {
    preserveExact: true,
    manualRaw: rawText,
    script: rawText,
    tone: "",
    language: "fa",
    toneExplanation: "",
    estimatedSeconds: 30,
    estimated_duration: "30",
  };
}

function mapUploadedImages(images: StoryboardUploadedImage[]) {
  return images.map((img) => ({
    url: img.url,
    storageKey: img.storageKey,
    name: img.name || img.originalName || null,
    originalName: img.originalName || img.name || null,
    mimeType: img.mimeType || null,
    sizeBytes: img.sizeBytes ?? null,
  }));
}

/** Exact-preservation payload for manually typed/pasted storyboard text (+ optional images). */
export function buildExactStoryboardTextPayload(
  rawText: string,
  images?: StoryboardUploadedImage[],
): Record<string, unknown> {
  const uploadedImages = mapUploadedImages(
    Array.isArray(images) ? images : [],
  );
  const text = typeof rawText === "string" ? rawText : "";
  if (!text.trim() && !uploadedImages.length) {
    throw new Error("متن یا تصویر استوری‌بورد لازم است.");
  }
  const sceneFromImages = uploadedImages.map((img, i) => ({
    sceneNumber: i + 1,
    title: `تصویر ${i + 1}`,
    visualDescription: text.trim() ? text : "",
    visual: text.trim() ? text : "",
    description: text.trim() ? text : "",
    camera: "",
    transition: "",
    characterActions: "",
    notes: "",
    duration: "",
    imageUrl: img.url,
    imageStorageKey: img.storageKey,
    imagePrompt: "",
  }));
  const fallbackScene = text.trim()
    ? [
        {
          sceneNumber: 1,
          title: "متن استوری‌بورد",
          visualDescription: text,
          visual: text,
          description: text,
          camera: "",
          transition: "",
          characterActions: "",
          notes: "",
          duration: "",
          imageUrl: null,
          imageStorageKey: null,
          imagePrompt: "",
        },
      ]
    : [];
  const scenes = sceneFromImages.length ? sceneFromImages : fallbackScene;
  const collage =
    uploadedImages.length === 1
      ? {
          collageImageUrl: uploadedImages[0].url,
          collageImageStorageKey: uploadedImages[0].storageKey,
        }
      : {};

  return {
    preserveExact: true,
    manualRaw: text,
    uploadedImages,
    storyboard: scenes,
    scenes,
    ...collage,
  };
}

/** Storyboard from uploaded images only (no text rewrite). */
export function buildStoryboardImagesPayload(
  images: StoryboardUploadedImage[],
): Record<string, unknown> {
  if (!images.length) {
    throw new Error("حداقل یک تصویر برای استوری‌بورد لازم است.");
  }
  const uploadedImages = mapUploadedImages(images);

  if (images.length === 1) {
    const primary = images[0];
    const scenes = [
      {
        sceneNumber: 1,
        title: "شیت استوری‌بورد",
        visualDescription: "",
        visual: "",
        description: "",
        camera: "",
        transition: "",
        characterActions: "",
        notes: "",
        duration: "",
        imageUrl: primary.url,
        imageStorageKey: primary.storageKey,
        imagePrompt: "",
      },
    ];
    return {
      preserveExact: true,
      manualRaw: "",
      uploadedImages,
      collageImageUrl: primary.url,
      collageImageStorageKey: primary.storageKey,
      storyboard: scenes,
      scenes,
    };
  }

  const scenes = images.map((img, i) => ({
    sceneNumber: i + 1,
    title: `تصویر ${i + 1}`,
    visualDescription: "",
    visual: "",
    description: "",
    camera: "",
    transition: "",
    characterActions: "",
    notes: "",
    duration: "",
    imageUrl: img.url,
    imageStorageKey: img.storageKey,
    imagePrompt: "",
  }));

  return {
    preserveExact: true,
    manualRaw: "",
    uploadedImages,
    storyboard: scenes,
    scenes,
  };
}
