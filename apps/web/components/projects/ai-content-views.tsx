"use client";

import { useMemo, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveAssetSrc } from "@/lib/api";
import { filePreviewUrl } from "@/lib/upload";

type ScenarioFields = {
  id?: number;
  title?: string;
  concept?: string;
  problem?: string;
  solution?: string;
  hook?: string;
  storyFlow?: string;
  cta?: string;
  emotionalDirection?: string;
  marketingAngle?: string;
  totalDurationSec?: number;
  sceneBreakdown?: Array<{
    scene?: number;
    description?: string;
    durationSec?: number;
  }>;
};

type StoryboardScene = {
  sceneNumber?: number;
  scene_number?: number;
  shot?: number;
  title?: string;
  duration?: string;
  visualDescription?: string;
  visual?: string;
  description?: string;
  camera?: string;
  cameraAngle?: string;
  transition?: string;
  characterActions?: string;
  action?: string;
  notes?: string;
  editingNotes?: string;
  visualDirection?: string;
  environment?: string;
  lighting?: string;
  imageUrl?: string | null;
  image_url?: string | null;
  imageStorageKey?: string | null;
  image_storage_key?: string | null;
  imagePrompt?: string | null;
  imageError?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function faNum(n: number) {
  return n.toLocaleString("fa-AF", { numberingSystem: "latn" });
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (value == null || !String(value).trim()) return null;
  return (
    <div className="text-start">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-7">{value}</p>
    </div>
  );
}

function ExactManualText({
  text,
  dir,
  className,
  emptyLabel,
}: {
  text: string;
  dir?: "rtl" | "ltr";
  className?: string;
  emptyLabel: string;
}) {
  if (!text) {
    return (
      <p className="text-sm text-muted-foreground" dir={dir}>
        {emptyLabel}
      </p>
    );
  }
  return (
    <article
      className={cn(
        "rounded-xl border border-border/60 bg-card p-4 text-start sm:p-5",
        className,
      )}
      dir={dir}
    >
      <div className="whitespace-pre-wrap break-words text-[15px] leading-8">
        {text}
      </div>
    </article>
  );
}

function getManualRaw(value: unknown): string | null {
  const obj = asRecord(value);
  if (!obj || obj.preserveExact !== true) return null;
  if (typeof obj.manualRaw === "string") return obj.manualRaw;
  return null;
}

function getUploadedImages(value: unknown): Array<{
  url: string;
  storageKey?: string | null;
  originalName?: string | null;
  name?: string | null;
}> {
  const obj = asRecord(value);
  if (!obj || !Array.isArray(obj.uploadedImages)) return [];
  return obj.uploadedImages
    .map((item) => {
      const img = asRecord(item);
      if (!img) return null;
      const url = String(img.url || "").trim();
      if (!url) {
        const key = String(img.storageKey || "").trim();
        if (!key) return null;
        const resolved =
          resolveAssetSrc({ storageKey: key, meta: img }) ||
          filePreviewUrl(key);
        if (!resolved) return null;
        return {
          url: resolved,
          storageKey: key,
          originalName:
            typeof img.originalName === "string" ? img.originalName : null,
          name: typeof img.name === "string" ? img.name : null,
        };
      }
      const resolved =
        resolveAssetSrc({
          url,
          storageKey:
            typeof img.storageKey === "string" ? img.storageKey : null,
          meta: img,
        }) || url;
      return {
        url: resolved,
        storageKey:
          typeof img.storageKey === "string" ? img.storageKey : null,
        originalName:
          typeof img.originalName === "string" ? img.originalName : null,
        name: typeof img.name === "string" ? img.name : null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function ManualUploadedImagesGallery({
  images,
}: {
  images: Array<{
    url: string;
    originalName?: string | null;
    name?: string | null;
  }>;
}) {
  if (!images.length) return null;

  const single = images.length === 1;

  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold tracking-tight">
            تصاویر آپلودشده
          </h4>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            تصاویر دستی استوری‌بورد
          </p>
        </div>
        <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-brand">
          {faNum(images.length)} تصویر
        </span>
      </div>

      <div
        className={cn(
          "bg-[#0f1115]/80 p-3 sm:p-4",
          single
            ? "flex justify-center"
            : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
        )}
      >
        {images.map((img, idx) => {
          const label =
            img.originalName || img.name || `تصویر ${faNum(idx + 1)}`;
          return (
            <a
              key={`${img.url}-${idx}`}
              href={img.url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "group relative overflow-hidden rounded-xl border border-white/10 bg-black/30 shadow-sm transition",
                "hover:border-brand/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                single ? "w-full max-w-4xl" : "w-full",
              )}
            >
              <div
                className={cn(
                  "relative flex items-center justify-center overflow-hidden",
                  single ? "min-h-[280px] sm:min-h-[360px]" : "aspect-[4/3]",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={label}
                  className={cn(
                    "max-h-full w-full object-contain transition duration-300 group-hover:scale-[1.01]",
                    single ? "max-h-[min(70vh,520px)]" : "h-full",
                  )}
                  loading={idx === 0 ? "eager" : "lazy"}
                  decoding="async"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-3 pb-2.5 pt-8">
                  <p className="truncate text-xs font-medium text-white/95">
                    {label}
                  </p>
                </div>
                <span className="absolute start-2.5 top-2.5 flex h-7 min-w-7 items-center justify-center rounded-lg bg-background/90 px-1.5 text-[11px] font-semibold tabular-nums shadow-sm ring-1 ring-border/60">
                  {faNum(idx + 1)}
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function sceneNumberOf(scene: StoryboardScene, index: number) {
  return Number(
    scene.sceneNumber ?? scene.scene_number ?? scene.shot ?? index + 1,
  );
}

function resolveStoryboardImageUrl(scene: StoryboardScene): string | null {
  const direct = scene.imageUrl || scene.image_url || null;
  if (typeof direct === "string" && direct.trim()) {
    const value = direct.trim();
    if (/^https?:\/\//i.test(value)) return value;
  }
  const key = scene.imageStorageKey || scene.image_storage_key || null;
  if (typeof key === "string" && key.trim()) {
    return filePreviewUrl(key.trim());
  }
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return null;
}

export function resolveStoryboardCollage(value: unknown): {
  src: string | null;
  error: string | null;
  sceneCount: number | null;
} {
  const obj = asRecord(value);
  if (!obj) return { src: null, error: null, sceneCount: null };

  const direct = obj.collageImageUrl || obj.collage_image_url;
  let src: string | null = null;
  if (typeof direct === "string" && direct.trim()) {
    const value = direct.trim();
    src = /^https?:\/\//i.test(value) ? value : filePreviewUrl(value);
  }
  const key = obj.collageImageStorageKey || obj.collage_image_storage_key;
  if (!src && typeof key === "string" && key.trim()) {
    src = filePreviewUrl(key.trim());
  }

  const layout = asRecord(obj.collageLayout);
  const sceneCount =
    typeof layout?.sceneCount === "number"
      ? layout.sceneCount
      : typeof obj.collageSceneCount === "number"
        ? obj.collageSceneCount
        : null;
  const error =
    typeof obj.collageImageError === "string" && obj.collageImageError.trim()
      ? obj.collageImageError.trim()
      : null;

  return { src, error, sceneCount };
}

function StoryboardSceneImage({
  scene,
  sceneNo,
  objectFit = "cover",
}: {
  scene: StoryboardScene;
  sceneNo: number;
  objectFit?: "cover" | "contain";
}) {
  const src = resolveStoryboardImageUrl(scene);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    src ? "loading" : "error",
  );
  const imageError = scene.imageError || null;

  if (!src) {
    return (
      <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
        <ImageOff className="h-5 w-5 opacity-50" aria-hidden />
        <span className="text-xs">
          {imageError ? "تولید تصویر ناموفق بود" : "تصویر مرجع هنوز تولید نشده"}
        </span>
      </div>
    );
  }

  return (
    <>
      {status === "loading" ? (
        <div className="absolute inset-0 z-[1] flex items-center justify-center bg-muted/40">
          <Loader2
            className="h-5 w-5 animate-spin text-muted-foreground"
            aria-hidden
          />
        </div>
      ) : null}
      {status === "error" ? (
        <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
          <ImageOff className="h-5 w-5 opacity-50" aria-hidden />
          <span className="text-xs">بارگذاری تصویر ناموفق بود</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={scene.title || `صحنه ${sceneNo}`}
          className={cn(
            "h-full w-full transition-opacity",
            objectFit === "contain" ? "object-contain" : "object-cover",
            status === "ready" ? "opacity-100" : "opacity-0",
          )}
          loading="lazy"
          decoding="async"
          sizes="(min-width: 768px) 55vw, 100vw"
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
        />
      )}
    </>
  );
}

function StoryboardCollageImage({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  return (
    <div className="relative w-full bg-[#0f1115]">
      {status === "loading" ? (
        <div className="absolute inset-0 z-[1] flex min-h-[240px] items-center justify-center">
          <Loader2
            className="h-5 w-5 animate-spin text-muted-foreground"
            aria-hidden
          />
        </div>
      ) : null}
      {status === "error" ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 px-4 py-10 text-center text-muted-foreground">
          <ImageOff className="h-5 w-5 opacity-50" aria-hidden />
          <span className="text-xs">بارگذاری شیت استوری‌بورد ناموفق بود</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={cn(
            "mx-auto h-auto w-full max-h-[min(80vh,920px)] object-contain object-top transition-opacity",
            status === "ready" ? "opacity-100" : "opacity-0",
          )}
          loading="lazy"
          decoding="async"
          sizes="(min-width: 768px) 70vw, 100vw"
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
        />
      )}
    </div>
  );
}

export function resolveSingleScenario(value: unknown): ScenarioFields | null {
  const obj = asRecord(value);
  if (!obj) return null;
  const list = Array.isArray(obj.scenarios)
    ? (obj.scenarios as ScenarioFields[])
    : [];
  if (list.length > 0) {
    return (
      list.find((s) => s?.id === obj.recommendedScenarioId) || list[0] || null
    );
  }
  if (obj.title || obj.concept || obj.hook || obj.storyFlow) {
    return obj as ScenarioFields;
  }
  return null;
}

export function ScenarioFinalView({
  value,
  dir = "rtl",
  className,
}: {
  value: unknown;
  dir?: "rtl" | "ltr";
  className?: string;
}) {
  const manualRaw = getManualRaw(value);
  if (manualRaw !== null) {
    return (
      <ExactManualText
        text={manualRaw}
        dir={dir}
        className={className}
        emptyLabel="سناریویی ثبت نشده"
      />
    );
  }

  const scenario = resolveSingleScenario(value);
  if (!scenario) {
    return (
      <p className="text-sm text-muted-foreground" dir={dir}>
        سناریویی ثبت نشده
      </p>
    );
  }

  return (
    <article
      className={cn(
        "space-y-4 rounded-xl border border-border/60 bg-card p-4 text-start sm:p-5",
        className,
      )}
      dir={dir}
    >
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight">
          {scenario.title || "سناریوی تبلیغاتی"}
        </h3>
        {scenario.totalDurationSec ? (
          <p className="text-xs tabular-nums text-muted-foreground">
            {faNum(scenario.totalDurationSec)} ثانیه
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        <Field label="مفهوم اصلی" value={scenario.concept} />
        <Field label="مشکل" value={scenario.problem} />
        <Field label="راه‌حل" value={scenario.solution} />
        <Field label="هوک" value={scenario.hook} />
        <Field label="جریان ویدیو" value={scenario.storyFlow} />
        <Field label="زاویه بازاریابی" value={scenario.marketingAngle} />
        <Field label="جهت احساسی" value={scenario.emotionalDirection} />
        <Field label="CTA" value={scenario.cta} />
      </div>

      {Array.isArray(scenario.sceneBreakdown) &&
      scenario.sceneBreakdown.length > 0 ? (
        <div className="space-y-2 border-t border-border/50 pt-4">
          <p className="text-[11px] text-muted-foreground">ساختار صحنه</p>
          <div className="space-y-2">
            {scenario.sceneBreakdown.map((scene, i) => (
              <div
                key={i}
                className="flex gap-3 rounded-lg bg-muted/30 px-3 py-2.5 text-start"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background text-xs font-semibold tabular-nums">
                  {faNum(scene.scene ?? i + 1)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-6">{scene.description || "—"}</p>
                  {scene.durationSec ? (
                    <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                      {faNum(scene.durationSec)} ثانیه
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function NarrationFinalView({
  value,
  dir = "rtl",
  className,
}: {
  value: unknown;
  dir?: "rtl" | "ltr";
  className?: string;
}) {
  const manualRaw = getManualRaw(value);
  if (manualRaw !== null) {
    return (
      <ExactManualText
        text={manualRaw}
        dir={dir}
        className={className}
        emptyLabel="نریشنی ثبت نشده"
      />
    );
  }

  const obj = asRecord(value);
  const script =
    typeof obj?.script === "string"
      ? obj.script
      : typeof value === "string"
        ? value
        : "";
  if (!script) {
    return (
      <p className="text-sm text-muted-foreground" dir={dir}>
        نریشنی ثبت نشده
      </p>
    );
  }

  const tone = typeof obj?.tone === "string" ? obj.tone : null;
  const toneExplanation =
    typeof obj?.toneExplanation === "string" ? obj.toneExplanation : null;
  const estimatedSeconds = Number(obj?.estimatedSeconds) || null;

  return (
    <article
      className={cn(
        "space-y-4 rounded-xl border border-border/60 bg-card p-4 text-start sm:p-5",
        className,
      )}
      dir={dir}
    >
      {(tone || estimatedSeconds) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {tone ? <span>لحن: {tone}</span> : null}
          {estimatedSeconds ? (
            <span className="tabular-nums">حدود {faNum(estimatedSeconds)} ثانیه</span>
          ) : null}
        </div>
      )}
      <p className="whitespace-pre-wrap break-words text-[15px] leading-8">
        {script}
      </p>
      {toneExplanation ? (
        <p className="text-xs leading-6 text-muted-foreground">{toneExplanation}</p>
      ) : null}
    </article>
  );
}

export function StoryboardFinalView({
  value,
  dir = "rtl",
  className,
}: {
  value: unknown;
  dir?: "rtl" | "ltr";
  className?: string;
}) {
  const exactRaw = getManualRaw(value);
  const uploadedImages = useMemo(() => getUploadedImages(value), [value]);
  const collage = resolveStoryboardCollage(value);
  const scenes = useMemo(() => {
    const obj = asRecord(value);
    const list = (
      Array.isArray(obj?.storyboard)
        ? obj.storyboard
        : Array.isArray(obj?.scenes)
          ? obj.scenes
          : Array.isArray(value)
            ? value
            : []
    ) as StoryboardScene[];

    return [...list].sort(
      (a, b) => sceneNumberOf(a, 0) - sceneNumberOf(b, 0),
    );
  }, [value]);

  const uploadedUrlSet = useMemo(
    () => new Set(uploadedImages.map((img) => img.url)),
    [uploadedImages],
  );
  const collageIsUploadedDuplicate =
    Boolean(collage.src) && uploadedUrlSet.has(collage.src as string);
  const hasManualUploads = uploadedImages.length > 0;

  if (exactRaw !== null) {
    const hasText = exactRaw.trim().length > 0;
    return (
      <div className={cn("space-y-4", className)} dir={dir}>
        <ManualUploadedImagesGallery images={uploadedImages} />
        {hasText ? (
          <ExactManualText
            text={exactRaw}
            dir={dir}
            emptyLabel="استوری‌بوردی ثبت نشده"
          />
        ) : null}
        {!hasText && !uploadedImages.length ? (
          <p className="text-sm text-muted-foreground" dir={dir}>
            استوری‌بوردی ثبت نشده
          </p>
        ) : null}
      </div>
    );
  }

  const showLegacySceneImages =
    !hasManualUploads &&
    !collage.src &&
    scenes.some((scene) => Boolean(resolveStoryboardImageUrl(scene)));

  const meaningfulScenes = hasManualUploads
    ? scenes.filter((scene) => {
        const visual =
          scene.visualDescription ||
          scene.visual ||
          scene.description ||
          scene.notes ||
          "";
        const camera = scene.camera || scene.cameraAngle;
        const action = scene.characterActions || scene.action;
        return Boolean(
          String(visual).trim() ||
            camera ||
            action ||
            scene.visualDirection ||
            scene.environment ||
            scene.lighting ||
            scene.transition ||
            scene.editingNotes,
        );
      })
    : scenes;

  if (
    meaningfulScenes.length === 0 &&
    !collage.src &&
    !hasManualUploads &&
    !collage.error
  ) {
    return (
      <p className="text-sm text-muted-foreground" dir={dir}>
        استوری‌بوردی ثبت نشده
      </p>
    );
  }

  return (
    <div className={cn("space-y-4", className)} dir={dir}>
      <ManualUploadedImagesGallery images={uploadedImages} />

      {(collage.src || collage.error) && !collageIsUploadedDuplicate ? (
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
            <h4 className="text-sm font-semibold tracking-tight">
              استوری‌بورد تصویری
            </h4>
            <p className="text-[11px] text-muted-foreground">
              {faNum(collage.sceneCount || scenes.length)} صحنه در یک شیت
            </p>
          </div>
          {collage.error && !collage.src ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 px-4 py-10 text-center text-muted-foreground">
              <ImageOff className="h-5 w-5 opacity-50" aria-hidden />
              <span className="text-xs leading-6">{collage.error}</span>
            </div>
          ) : collage.src ? (
            <StoryboardCollageImage
              src={collage.src}
              alt="شیت استوری‌بورد تصویری همه صحنه‌ها"
            />
          ) : null}
        </section>
      ) : null}

      {meaningfulScenes.length ? (
      <ol className="space-y-4">
        {meaningfulScenes.map((scene, i) => {
          const sceneNo = sceneNumberOf(scene, i);
          const camera = scene.camera || scene.cameraAngle;
          const action = scene.characterActions || scene.action;
          const visual =
            scene.visualDescription ||
            scene.visual ||
            scene.description ||
            scene.notes ||
            "—";
          const imageError = scene.imageError || null;
          const details = (
            <div className="flex flex-col gap-3 p-4 sm:p-5">
              <div className="min-w-0 space-y-1">
                <h5 className="text-sm font-semibold tracking-tight">
                  {scene.title?.trim() || `صحنه ${faNum(sceneNo)}`}
                </h5>
                {scene.duration ? (
                  <p className="text-xs tabular-nums text-muted-foreground">
                    مدت: {scene.duration}
                  </p>
                ) : null}
              </div>

              {imageError && showLegacySceneImages ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-6 text-destructive">
                  {imageError}
                </p>
              ) : null}

              <p className="whitespace-pre-wrap text-sm leading-7">{visual}</p>

              <div className="space-y-2">
                <Field label="عنوان صحنه" value={scene.title} />
                <Field label="نوع پلان / زاویه دوربین" value={camera} />
                <Field label="راهنمای بصری" value={scene.visualDirection} />
                <Field label="محیط" value={scene.environment} />
                <Field label="نورپردازی" value={scene.lighting} />
                <Field label="اکشن" value={action} />
                <Field label="انتقال" value={scene.transition} />
                <Field label="یادداشت تدوین" value={scene.editingNotes} />
              </div>
            </div>
          );

          if (!showLegacySceneImages) {
            return (
              <li
                key={`${sceneNo}-${i}`}
                className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
              >
                {details}
              </li>
            );
          }

          return (
            <li
              key={`${sceneNo}-${i}`}
              className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
            >
              <div className="grid gap-0 md:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
                <div className="relative bg-muted/30 md:min-h-[280px]">
                  <div className="relative aspect-video w-full overflow-hidden md:aspect-auto md:h-full md:min-h-[280px]">
                    <StoryboardSceneImage
                      key={`${sceneNo}-${resolveStoryboardImageUrl(scene) || "none"}`}
                      scene={scene}
                      sceneNo={sceneNo}
                    />
                  </div>
                  <div className="absolute start-3 top-3 z-[2] flex h-8 w-8 items-center justify-center rounded-lg bg-background/90 text-xs font-semibold tabular-nums shadow-sm ring-1 ring-border/60">
                    {faNum(sceneNo)}
                  </div>
                </div>
                {details}
              </div>
            </li>
          );
        })}
      </ol>
      ) : null}
    </div>
  );
}
