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
  return {
    script: str(obj.script),
    tone: str(obj.tone),
    language: str(obj.language) || "fa",
    toneExplanation: str(obj.toneExplanation),
  };
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

  return {
    ...base,
    ...fields,
    projectId: base.projectId,
    recommendedScenarioId: 1,
    scenarios: [fields],
    hooks: fields.hook ? [fields.hook] : [],
  };
}

export function buildNarrationPayload(
  form: NarrationFormState,
  original: unknown,
): Record<string, unknown> {
  const base = asRecord(original) || {};
  return {
    ...base,
    projectId: base.projectId,
    script: form.script.trim(),
    tone: form.tone.trim() || "Professional",
    language: form.language.trim() || "fa",
    toneExplanation: form.toneExplanation.trim(),
    estimatedSeconds: Number(base.estimatedSeconds) || 30,
    estimated_duration: String(Number(base.estimatedSeconds) || 30),
  };
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

export type StoryboardUploadedImage = {
  url: string;
  storageKey: string;
  name?: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
};

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
