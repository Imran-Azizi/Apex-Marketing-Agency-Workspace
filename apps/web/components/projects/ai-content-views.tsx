"use client";

import { useMemo, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return (
    <div className="text-start">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-7">{trimmed}</p>
    </div>
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

function StoryboardSceneImage({
  scene,
  sceneNo,
}: {
  scene: StoryboardScene;
  sceneNo: number;
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
            "h-full w-full object-cover transition-opacity",
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
      <p className="whitespace-pre-wrap text-[15px] leading-8">{script}</p>
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

  if (scenes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" dir={dir}>
        استوری‌بوردی ثبت نشده
      </p>
    );
  }

  return (
    <ol className={cn("space-y-4", className)} dir={dir}>
      {scenes.map((scene, i) => {
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

                {imageError ? (
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
            </div>
          </li>
        );
      })}
    </ol>
  );
}
