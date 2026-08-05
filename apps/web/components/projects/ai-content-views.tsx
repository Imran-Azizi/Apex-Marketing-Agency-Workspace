"use client";

import { cn } from "@/lib/utils";

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
  shot?: number;
  duration?: string;
  visualDescription?: string;
  camera?: string;
  cameraAngle?: string;
  transition?: string;
  characterActions?: string;
  notes?: string;
  editingNotes?: string;
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
  const obj = asRecord(value);
  const scenes = (
    Array.isArray(obj?.storyboard)
      ? obj.storyboard
      : Array.isArray(obj?.scenes)
        ? obj.scenes
        : Array.isArray(value)
          ? value
          : []
  ) as Array<
    StoryboardScene & {
      scene_number?: number;
      visual?: string;
      action?: string;
    }
  >;

  if (scenes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" dir={dir}>
        استوری‌بوردی ثبت نشده
      </p>
    );
  }

  return (
    <ol className={cn("space-y-2", className)} dir={dir}>
      {scenes.map((scene, i) => {
        const sceneNo =
          scene.sceneNumber ?? scene.scene_number ?? scene.shot ?? i + 1;
        const camera = scene.camera || scene.cameraAngle;
        const action = scene.characterActions || scene.action;
        const visual =
          scene.visualDescription || scene.visual || scene.notes || "—";

        return (
          <li
            key={i}
            className="rounded-xl border border-border/60 bg-card p-4 text-start"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold tabular-nums">
                {faNum(Number(sceneNo))}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <h5 className="text-sm font-medium">
                    صحنه {faNum(Number(sceneNo))}
                  </h5>
                  {scene.duration ? (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {scene.duration}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm leading-7">{visual}</p>
                <div className="space-y-2">
                  <Field label="دوربین" value={camera} />
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
