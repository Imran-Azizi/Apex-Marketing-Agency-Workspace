/**
 * Client-side helpers to turn uploaded Scenario / Narration / Storyboard
 * files into form state (no AI pipeline).
 */

import type {
  NarrationFormState,
  ScenarioFormState,
  StoryboardSceneFormState,
} from "@/lib/content-payload";
import {
  emptyNarrationForm,
  emptyScenarioForm,
  loadNarrationForm,
  loadScenarioForm,
  loadStoryboardScenes,
} from "@/lib/content-payload";
import {
  CONTENT_DOCUMENT_ACCEPT,
  CONTENT_DOCUMENT_ACCEPT_WITH_JSON,
  assertSupportedContentDocumentFile,
  extractContentDocumentText,
  getContentDocumentKind,
  readFileAsUtf8Text,
} from "@/lib/content-document-extract";

export type ContentImportSection = "scenario" | "narration" | "storyboard";

export type ImportedSourceFile = {
  section: ContentImportSection;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storageKey?: string | null;
  url?: string | null;
  inputMethod?: "file" | "text" | "image";
};

export type ScenarioImportResult = {
  form: ScenarioFormState;
  sourceFiles: ImportedSourceFile[];
};

export type NarrationImportResult = {
  form: NarrationFormState;
  sourceFiles: ImportedSourceFile[];
};

export type StoryboardImportResult = {
  scenes: StoryboardSceneFormState[];
  collage?: { url: string; storageKey: string } | null;
  original?: unknown;
  sourceFiles: ImportedSourceFile[];
};

const TEXT_EXT = new Set([".txt", ".md", ".markdown", ".csv"]);
const JSON_EXT = new Set([".json"]);
const IMAGE_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".jfif",
]);
const DOCUMENT_EXT = new Set([".txt", ".doc", ".docx", ".pdf"]);

function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function titleFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").trim();
  return base || "محتوای واردشده";
}

function firstLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean) || text.trim().slice(0, 120)
  );
}

export function isTextImportFile(file: File): boolean {
  const ext = fileExt(file.name);
  return (
    TEXT_EXT.has(ext) ||
    DOCUMENT_EXT.has(ext) ||
    file.type.startsWith("text/") ||
    file.type === "application/json" ||
    file.type === "application/pdf" ||
    file.type === "application/msword" ||
    file.type.includes("wordprocessingml")
  );
}

export function isJsonImportFile(file: File): boolean {
  const ext = fileExt(file.name);
  return JSON_EXT.has(ext) || file.type === "application/json";
}

export function isImageImportFile(file: File): boolean {
  const ext = fileExt(file.name);
  return IMAGE_EXT.has(ext) || file.type.startsWith("image/");
}

export function isContentDocumentFile(file: File): boolean {
  const kind = getContentDocumentKind(file);
  return (
    kind === "txt" ||
    kind === "doc" ||
    kind === "docx" ||
    kind === "pdf" ||
    kind === "json" ||
    kind === "markdown"
  );
}

/** @deprecated Use extractContentDocumentText for document formats */
export async function readFileAsText(file: File): Promise<string> {
  return readFileAsUtf8Text(file);
}

/** Read/import text from txt, doc, docx, pdf (and legacy json/md). */
export async function readImportableText(file: File): Promise<string> {
  assertSupportedContentDocumentFile(file);
  return extractContentDocumentText(file);
}

function scenarioFormFromPlainText(
  text: string,
  filename: string,
): ScenarioFormState {
  const trimmed = text.trim();
  if (!trimmed) return emptyScenarioForm();
  const title = titleFromFilename(filename);
  const hook = firstLine(trimmed).slice(0, 180);
  return {
    ...emptyScenarioForm(),
    title,
    concept: trimmed.slice(0, 600),
    hook,
    storyFlow: trimmed,
    cta: "تماس بگیرید",
  };
}

function narrationFormFromPlainText(text: string): NarrationFormState {
  return {
    ...emptyNarrationForm(),
    script: text.trim(),
    tone: "Professional",
    language: "fa",
  };
}

function scenesFromPlainText(text: string): StoryboardSceneFormState[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const lines =
    blocks.length > 1
      ? blocks
      : text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
  if (!lines.length) {
    return [
      {
        sceneNumber: 1,
        title: "صحنه ۱",
        visualDescription: text.trim() || "توضیح صحنه",
        visualDirection: "",
        camera: "",
        transition: "",
        characterActions: "",
        notes: "",
        duration: "5s",
        imageUrl: "",
        imageStorageKey: "",
        imagePrompt: "",
      },
    ];
  }
  return lines.map((line, i) => ({
    sceneNumber: i + 1,
    title: `صحنه ${i + 1}`,
    visualDescription: line,
    visualDirection: "",
    camera: "",
    transition: i < lines.length - 1 ? "Cut" : "",
    characterActions: "",
    notes: "",
    duration: "5s",
    imageUrl: "",
    imageStorageKey: "",
    imagePrompt: "",
  }));
}

/** Build scenario form from pasted/typed plain text (or JSON string). */
export function importScenarioFromText(
  text: string,
  titleHint = "سناریوی واردشده",
): ScenarioImportResult {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("متن سناریو خالی است.");
  }

  let form: ScenarioFormState;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      form = loadScenarioForm(parsed);
      if (!form.title.trim() && !form.storyFlow.trim()) {
        form = scenarioFormFromPlainText(trimmed, titleHint);
      }
    } catch {
      form = scenarioFormFromPlainText(trimmed, titleHint);
    }
  } else {
    form = scenarioFormFromPlainText(trimmed, titleHint);
  }

  if (!form.title.trim()) form.title = titleHint;
  if (!form.hook.trim()) {
    form.hook = firstLine(form.storyFlow || form.concept) || form.title;
  }
  if (!form.concept.trim()) {
    form.concept = form.storyFlow.slice(0, 600) || form.title;
  }
  if (!form.storyFlow.trim()) form.storyFlow = form.concept || form.hook;
  if (!form.cta.trim()) form.cta = "تماس بگیرید";

  return {
    form,
    sourceFiles: [
      {
        section: "scenario",
        name: "pasted-text.txt",
        mimeType: "text/plain",
        sizeBytes: new TextEncoder().encode(trimmed).length,
        inputMethod: "text",
      },
    ],
  };
}

/** Build narration form from pasted/typed plain text (or JSON string). */
export function importNarrationFromText(text: string): NarrationImportResult {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("متن نریشن خالی است.");
  }

  let form: NarrationFormState;
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      form = loadNarrationForm(parsed);
      if (!form.script.trim()) {
        form = narrationFormFromPlainText(trimmed);
      }
    } catch {
      form = narrationFormFromPlainText(trimmed);
    }
  } else {
    form = narrationFormFromPlainText(trimmed);
  }

  if (!form.script.trim()) {
    throw new Error("متن نریشن یافت نشد.");
  }

  return {
    form,
    sourceFiles: [
      {
        section: "narration",
        name: "pasted-text.txt",
        mimeType: "text/plain",
        sizeBytes: new TextEncoder().encode(trimmed).length,
        inputMethod: "text",
      },
    ],
  };
}

/** Build storyboard scenes from pasted/typed plain text (or JSON string). */
export function importStoryboardFromText(text: string): StoryboardImportResult {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("متن استوری‌بورد خالی است.");
  }

  let scenes: StoryboardSceneFormState[];
  let original: unknown = null;
  let collage: { url: string; storageKey: string } | null = null;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      original = JSON.parse(trimmed);
      scenes = loadStoryboardScenes(original);
      const rec = asRecord(original);
      const collageUrl =
        (typeof rec?.collageImageUrl === "string" && rec.collageImageUrl) ||
        (typeof rec?.collage_image_url === "string" && rec.collage_image_url) ||
        null;
      const collageKey =
        (typeof rec?.collageImageStorageKey === "string" &&
          rec.collageImageStorageKey) ||
        (typeof rec?.collage_image_storage_key === "string" &&
          rec.collage_image_storage_key) ||
        null;
      if (collageUrl && collageKey) {
        collage = { url: collageUrl, storageKey: collageKey };
      }
    } catch {
      scenes = scenesFromPlainText(trimmed);
    }
  } else {
    scenes = scenesFromPlainText(trimmed);
  }

  const valid = scenes.filter((s) => s.visualDescription.trim());
  if (!valid.length) {
    throw new Error("هیچ صحنه‌ای در متن استوری‌بورد یافت نشد.");
  }

  return {
    scenes: valid,
    collage,
    original,
    sourceFiles: [
      {
        section: "storyboard",
        name: "pasted-text.txt",
        mimeType: "text/plain",
        sizeBytes: new TextEncoder().encode(trimmed).length,
        inputMethod: "text",
      },
    ],
  };
}

export async function importScenarioFile(
  file: File,
): Promise<ScenarioImportResult> {
  if (isImageImportFile(file)) {
    throw new Error("برای سناریو فایل متنی یا سندی آپلود کنید (نه تصویر).");
  }
  assertSupportedContentDocumentFile(file);
  const text = await readImportableText(file);
  let form: ScenarioFormState;
  if (isJsonImportFile(file) || getContentDocumentKind(file) === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("فایل JSON سناریو نامعتبر است.");
    }
    form = loadScenarioForm(parsed);
    if (!form.title.trim() && !form.storyFlow.trim()) {
      const rec = asRecord(parsed);
      if (typeof rec?.raw === "string") {
        form = scenarioFormFromPlainText(rec.raw, file.name);
      } else {
        form = scenarioFormFromPlainText(text, file.name);
      }
    }
  } else {
    form = scenarioFormFromPlainText(text, file.name);
  }
  if (!form.title.trim()) form.title = titleFromFilename(file.name);
  if (!form.hook.trim()) {
    form.hook = firstLine(form.storyFlow || form.concept) || form.title;
  }
  if (!form.concept.trim()) {
    form.concept = form.storyFlow.slice(0, 600) || form.title;
  }
  if (!form.storyFlow.trim()) form.storyFlow = form.concept || form.hook;
  if (!form.cta.trim()) form.cta = "تماس بگیرید";

  return {
    form,
    sourceFiles: [
      {
        section: "scenario",
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      },
    ],
  };
}

export async function importNarrationFile(
  file: File,
): Promise<NarrationImportResult> {
  if (isImageImportFile(file)) {
    throw new Error("برای نریشن فایل متنی یا سندی آپلود کنید (نه تصویر).");
  }
  assertSupportedContentDocumentFile(file);
  const text = await readImportableText(file);
  let form: NarrationFormState;
  if (isJsonImportFile(file) || getContentDocumentKind(file) === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("فایل JSON نریشن نامعتبر است.");
    }
    form = loadNarrationForm(parsed);
    if (!form.script.trim()) {
      const rec = asRecord(parsed);
      form = narrationFormFromPlainText(
        typeof rec?.raw === "string" ? rec.raw : text,
      );
    }
  } else {
    form = narrationFormFromPlainText(text);
  }
  if (!form.script.trim()) {
    throw new Error("متن نریشن در فایل یافت نشد.");
  }

  return {
    form,
    sourceFiles: [
      {
        section: "narration",
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      },
    ],
  };
}

export type UploadedImageRef = {
  url: string;
  storageKey: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

/** Build storyboard from already-uploaded image refs (client uploads first). */
export function importStoryboardFromImages(
  images: UploadedImageRef[],
  mode: "scenes" | "collage" = "scenes",
): StoryboardImportResult {
  if (!images.length) {
    throw new Error("حداقل یک تصویر برای استوری‌بورد لازم است.");
  }

  const sourceFiles: ImportedSourceFile[] = images.map((img) => ({
    section: "storyboard" as const,
    name: img.name,
    mimeType: img.mimeType,
    sizeBytes: img.sizeBytes,
    storageKey: img.storageKey,
    url: img.url,
  }));

  if (mode === "collage" || images.length === 1) {
    const primary = images[0];
    const scenes: StoryboardSceneFormState[] = [
      {
        sceneNumber: 1,
        title: "شیت استوری‌بورد",
        visualDescription: "شیت تصویری استوری‌بورد آپلود‌شده از منبع خارجی",
        visualDirection: "",
        camera: "",
        transition: "",
        characterActions: "",
        notes: "",
        duration: "30s",
        imageUrl: primary.url,
        imageStorageKey: primary.storageKey,
        imagePrompt: "",
      },
    ];
    const collage = { url: primary.url, storageKey: primary.storageKey };
    return { scenes, collage, original: null, sourceFiles };
  }

  const scenes: StoryboardSceneFormState[] = images.map((img, i) => ({
    sceneNumber: i + 1,
    title: `صحنه ${i + 1}`,
    visualDescription: `تصویر آپلود‌شده برای صحنه ${i + 1}`,
    visualDirection: "",
    camera: "",
    transition: i < images.length - 1 ? "Cut" : "",
    characterActions: "",
    notes: "",
    duration: "5s",
    imageUrl: img.url,
    imageStorageKey: img.storageKey,
    imagePrompt: "",
  }));

  return {
    scenes,
    collage: null,
    original: null,
    sourceFiles,
  };
}

export async function importStoryboardTextOrJsonFile(
  file: File,
): Promise<StoryboardImportResult> {
  if (isImageImportFile(file)) {
    throw new Error("برای آپلود متن استوری‌بورد، فایل تصویری انتخاب نکنید.");
  }
  assertSupportedContentDocumentFile(file);
  const text = await readImportableText(file);
  let scenes: StoryboardSceneFormState[];
  let original: unknown = null;

  if (isJsonImportFile(file) || getContentDocumentKind(file) === "json") {
    try {
      original = JSON.parse(text);
    } catch {
      throw new Error("فایل JSON استوری‌بورد نامعتبر است.");
    }
    scenes = loadStoryboardScenes(original);
  } else {
    scenes = scenesFromPlainText(text);
  }

  const valid = scenes.filter((s) => s.visualDescription.trim());
  if (!valid.length) {
    throw new Error("هیچ صحنه‌ای در فایل استوری‌بورد یافت نشد.");
  }

  const rec = asRecord(original);
  const collageUrl =
    (typeof rec?.collageImageUrl === "string" && rec.collageImageUrl) ||
    (typeof rec?.collage_image_url === "string" && rec.collage_image_url) ||
    null;
  const collageKey =
    (typeof rec?.collageImageStorageKey === "string" &&
      rec.collageImageStorageKey) ||
    (typeof rec?.collage_image_storage_key === "string" &&
      rec.collage_image_storage_key) ||
    null;

  const collage =
    collageUrl && collageKey
      ? { url: collageUrl, storageKey: collageKey }
      : null;

  return {
    scenes: valid,
    collage,
    original,
    sourceFiles: [
      {
        section: "storyboard",
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      },
    ],
  };
}

export const SCENARIO_ACCEPT = CONTENT_DOCUMENT_ACCEPT_WITH_JSON;
export const NARRATION_ACCEPT = CONTENT_DOCUMENT_ACCEPT_WITH_JSON;
export const STORYBOARD_TEXT_ACCEPT = CONTENT_DOCUMENT_ACCEPT_WITH_JSON;
export const STORYBOARD_IMAGE_ACCEPT =
  ".png,.jpg,.jpeg,.webp,.gif,.jfif,image/*";
/** @deprecated Prefer STORYBOARD_TEXT_ACCEPT / STORYBOARD_IMAGE_ACCEPT */
export const STORYBOARD_ACCEPT = `${STORYBOARD_TEXT_ACCEPT},${STORYBOARD_IMAGE_ACCEPT}`;

export { CONTENT_DOCUMENT_ACCEPT };