"use client";

import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  getCustomTabListClass,
  getCustomTabTriggerClass,
} from "@/components/shared/tab-styles";
import { resolveSingleScenario } from "@/components/projects/ai-content-views";

export type EditContentTab = "scenario" | "narration" | "storyboard";

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
    storyFlow: str(scenario.storyFlow || (scenario as { content?: string }).content),
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

export function loadStoryboardScenes(value: unknown): StoryboardSceneFormState[] {
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
    sceneNumber: Number(scene.sceneNumber ?? scene.scene_number ?? scene.shot ?? i + 1) || i + 1,
    title: str(scene.title || scene.sceneTitle),
    visualDescription: str(
      scene.visualDescription || scene.visual || scene.notes || scene.description,
    ),
    visualDirection: str(scene.visualDirection || scene.visualGuide),
    camera: str(scene.camera || scene.cameraAngle),
    transition: str(scene.transition),
    characterActions: str(scene.characterActions || scene.action),
    notes: str(scene.editingNotes || scene.notes),
    duration: str(scene.duration ?? scene.durationSec),
    imageUrl: str(scene.imageUrl || scene.image_url),
    imagePrompt: str(scene.imagePrompt || scene.image_prompt),
  }));
}

export function buildScenarioPayload(
  form: ScenarioFormState,
  original: unknown,
): Record<string, unknown> {
  const base = asRecord(original) || {};
  const fields = {
    id: 1,
    title: form.title.trim(),
    concept: form.concept.trim(),
    problem: form.problem.trim(),
    solution: form.solution.trim(),
    hook: form.hook.trim(),
    storyFlow: form.storyFlow.trim(),
    content: form.storyFlow.trim(),
    cta: form.cta.trim(),
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
    imagePrompt: scene.imagePrompt.trim() || null,
  }));

  return {
    ...base,
    projectId: base.projectId,
    storyboard: normalized,
    scenes: normalized,
  };
}

export function validateContentEditForm(input: {
  scenario: ScenarioFormState;
  narration: NarrationFormState;
  scenes: StoryboardSceneFormState[];
}): string | null {
  if (!input.scenario.title.trim()) {
    return "عنوان سناریو الزامی است.";
  }
  if (!input.scenario.hook.trim() && !input.scenario.storyFlow.trim()) {
    return "برای سناریو، هوک یا جریان ویدیو را وارد کنید.";
  }
  if (!input.narration.script.trim()) {
    return "متن نریشن نمی‌تواند خالی باشد.";
  }
  const validScenes = input.scenes.filter((s) => s.visualDescription.trim());
  if (validScenes.length === 0) {
    return "حداقل یک صحنه با توضیح تصویری در استوری‌بورد لازم است.";
  }
  return null;
}

function FieldBlock({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        {hint ? (
          <p className="text-[11px] leading-5 text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function ContentEditForm({
  tab,
  onTabChange,
  scenario,
  onScenarioChange,
  narration,
  onNarrationChange,
  scenes,
  onScenesChange,
  disabled,
}: {
  tab: EditContentTab;
  onTabChange: (tab: EditContentTab) => void;
  scenario: ScenarioFormState;
  onScenarioChange: (next: ScenarioFormState) => void;
  narration: NarrationFormState;
  onNarrationChange: (next: NarrationFormState) => void;
  scenes: StoryboardSceneFormState[];
  onScenesChange: (next: StoryboardSceneFormState[]) => void;
  disabled?: boolean;
}) {
  const patchScenario = (patch: Partial<ScenarioFormState>) =>
    onScenarioChange({ ...scenario, ...patch });
  const patchNarration = (patch: Partial<NarrationFormState>) =>
    onNarrationChange({ ...narration, ...patch });

  const patchScene = (index: number, patch: Partial<StoryboardSceneFormState>) => {
    onScenesChange(
      scenes.map((scene, i) => (i === index ? { ...scene, ...patch } : scene)),
    );
  };

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="بخش‌های ویرایش محتوا"
        className={cn(getCustomTabListClass("segmented"), "w-full")}
      >
        {(
          [
            ["scenario", "سناریو"],
            ["narration", "نریشن"],
            ["storyboard", "استوری‌بورد"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            disabled={disabled}
            onClick={() => onTabChange(id)}
            className={cn(
              getCustomTabTriggerClass(tab === id, "segmented"),
              "flex-1",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "scenario" && (
        <div className="space-y-3 rounded-xl border border-border/70 bg-card p-3.5 sm:p-4">
          <FieldBlock label="عنوان" hint="عنوان کوتاه و واضح برای سناریو">
            <Input
              value={scenario.title}
              disabled={disabled}
              placeholder="مثال: معرفی سریع خدمات اپیکس"
              onChange={(e) => patchScenario({ title: e.target.value })}
            />
          </FieldBlock>
          <FieldBlock label="مفهوم اصلی">
            <Textarea
              rows={2}
              value={scenario.concept}
              disabled={disabled}
              placeholder="ایده اصلی ویدیو را بنویسید…"
              className="min-h-[72px] resize-y leading-7"
              onChange={(e) => patchScenario({ concept: e.target.value })}
            />
          </FieldBlock>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldBlock label="مشکل">
              <Textarea
                rows={3}
                value={scenario.problem}
                disabled={disabled}
                placeholder="مشکلی که مخاطب دارد…"
                className="min-h-[88px] resize-y leading-7"
                onChange={(e) => patchScenario({ problem: e.target.value })}
              />
            </FieldBlock>
            <FieldBlock label="راه‌حل">
              <Textarea
                rows={3}
                value={scenario.solution}
                disabled={disabled}
                placeholder="راه‌حلی که ارائه می‌دهید…"
                className="min-h-[88px] resize-y leading-7"
                onChange={(e) => patchScenario({ solution: e.target.value })}
              />
            </FieldBlock>
          </div>
          <FieldBlock label="هوک" hint="جمله افتتاحیه برای جلب توجه در ثانیه‌های اول">
            <Textarea
              rows={2}
              value={scenario.hook}
              disabled={disabled}
              placeholder="هوک جذاب ویدیو…"
              className="min-h-[72px] resize-y leading-7"
              onChange={(e) => patchScenario({ hook: e.target.value })}
            />
          </FieldBlock>
          <FieldBlock label="جریان ویدیو" hint="داستان کامل از شروع تا پایان">
            <Textarea
              rows={5}
              value={scenario.storyFlow}
              disabled={disabled}
              placeholder="جریان کامل داستان ویدیو را بنویسید…"
              className="min-h-[140px] resize-y leading-7"
              onChange={(e) => patchScenario({ storyFlow: e.target.value })}
            />
          </FieldBlock>
          <FieldBlock label="فراخوان اقدام (CTA)">
            <Textarea
              rows={2}
              value={scenario.cta}
              disabled={disabled}
              placeholder="مثال: همین حالا در واتساپ پیام دهید"
              className="min-h-[72px] resize-y leading-7"
              onChange={(e) => patchScenario({ cta: e.target.value })}
            />
          </FieldBlock>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldBlock label="زاویه بازاریابی">
              <Textarea
                rows={2}
                value={scenario.marketingAngle}
                disabled={disabled}
                placeholder="مزیت رقابتی یا پیام کلیدی…"
                className="min-h-[72px] resize-y leading-7"
                onChange={(e) =>
                  patchScenario({ marketingAngle: e.target.value })
                }
              />
            </FieldBlock>
            <FieldBlock label="جهت احساسی">
              <Textarea
                rows={2}
                value={scenario.emotionalDirection}
                disabled={disabled}
                placeholder="مثال: اعتماد، هیجان، آرامش…"
                className="min-h-[72px] resize-y leading-7"
                onChange={(e) =>
                  patchScenario({ emotionalDirection: e.target.value })
                }
              />
            </FieldBlock>
          </div>
        </div>
      )}

      {tab === "narration" && (
        <div className="space-y-3 rounded-xl border border-border/70 bg-card p-3.5 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldBlock label="لحن">
              <Input
                value={narration.tone}
                disabled={disabled}
                placeholder="مثال: رسمی، صمیمی، حرفه‌ای"
                onChange={(e) => patchNarration({ tone: e.target.value })}
              />
            </FieldBlock>
            <FieldBlock label="زبان">
              <Input
                value={narration.language}
                disabled={disabled}
                placeholder="fa / en / …"
                onChange={(e) => patchNarration({ language: e.target.value })}
              />
            </FieldBlock>
          </div>
          <FieldBlock label="متن نریشن" hint="متن کامل voice-over">
            <Textarea
              rows={10}
              value={narration.script}
              disabled={disabled}
              placeholder="متن کامل نریشن را اینجا بنویسید…"
              className="min-h-[220px] resize-y text-[15px] leading-8"
              onChange={(e) => patchNarration({ script: e.target.value })}
            />
          </FieldBlock>
          <FieldBlock label="توضیح لحن" hint="اختیاری">
            <Textarea
              rows={2}
              value={narration.toneExplanation}
              disabled={disabled}
              placeholder="چرا این لحن انتخاب شده است…"
              className="min-h-[72px] resize-y leading-7"
              onChange={(e) =>
                patchNarration({ toneExplanation: e.target.value })
              }
            />
          </FieldBlock>
        </div>
      )}

      {tab === "storyboard" && (
        <div className="space-y-3">
          {scenes.map((scene, index) => (
            <div
              key={`scene-${index}`}
              className="space-y-3 rounded-xl border border-border/70 bg-card p-3.5 sm:p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  صحنه{" "}
                  {(scene.sceneNumber || index + 1).toLocaleString("fa-AF", {
                    numberingSystem: "latn",
                  })}
                </p>
                {scenes.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-destructive hover:text-destructive"
                    disabled={disabled}
                    onClick={() =>
                      onScenesChange(scenes.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف
                  </Button>
                ) : null}
              </div>
              {scene.imageUrl ? (
                <div className="overflow-hidden rounded-xl border border-border/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={scene.imageUrl}
                    alt={scene.title || `صحنه ${scene.sceneNumber}`}
                    className="aspect-video w-full object-cover"
                  />
                </div>
              ) : null}
              <FieldBlock label="عنوان صحنه">
                <Input
                  value={scene.title}
                  disabled={disabled}
                  placeholder="عنوان کوتاه صحنه"
                  onChange={(e) => patchScene(index, { title: e.target.value })}
                />
              </FieldBlock>
              <FieldBlock label="توضیحات صحنه">
                <Textarea
                  rows={3}
                  value={scene.visualDescription}
                  disabled={disabled}
                  placeholder="چه چیزی در این صحنه دیده می‌شود…"
                  className="min-h-[88px] resize-y leading-7"
                  onChange={(e) =>
                    patchScene(index, { visualDescription: e.target.value })
                  }
                />
              </FieldBlock>
              <FieldBlock label="راهنمای بصری">
                <Textarea
                  rows={2}
                  value={scene.visualDirection}
                  disabled={disabled}
                  placeholder="مود، نور، محیط، استایل برند…"
                  className="min-h-[72px] resize-y leading-7"
                  onChange={(e) =>
                    patchScene(index, { visualDirection: e.target.value })
                  }
                />
              </FieldBlock>
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldBlock label="نوع پلان / زاویه دوربین">
                  <Input
                    value={scene.camera}
                    disabled={disabled}
                    placeholder="نمای نزدیک، واید، …"
                    onChange={(e) =>
                      patchScene(index, { camera: e.target.value })
                    }
                  />
                </FieldBlock>
                <FieldBlock label="مدت">
                  <Input
                    value={scene.duration}
                    disabled={disabled}
                    placeholder="مثال: 5s"
                    onChange={(e) =>
                      patchScene(index, { duration: e.target.value })
                    }
                  />
                </FieldBlock>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldBlock label="اکشن / حرکت">
                  <Textarea
                    rows={2}
                    value={scene.characterActions}
                    disabled={disabled}
                    placeholder="حرکت شخصیت یا سوژه…"
                    className="min-h-[72px] resize-y leading-7"
                    onChange={(e) =>
                      patchScene(index, { characterActions: e.target.value })
                    }
                  />
                </FieldBlock>
                <FieldBlock label="انتقال">
                  <Input
                    value={scene.transition}
                    disabled={disabled}
                    placeholder="کات، فید، …"
                    onChange={(e) =>
                      patchScene(index, { transition: e.target.value })
                    }
                  />
                </FieldBlock>
              </div>
              <FieldBlock label="یادداشت تدوین" hint="اختیاری">
                <Textarea
                  rows={2}
                  value={scene.notes}
                  disabled={disabled}
                  placeholder="نکات تدوین برای این صحنه…"
                  className="min-h-[72px] resize-y leading-7"
                  onChange={(e) =>
                    patchScene(index, { notes: e.target.value })
                  }
                />
              </FieldBlock>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            disabled={disabled}
            onClick={() =>
              onScenesChange([
                ...scenes,
                {
                  sceneNumber: scenes.length + 1,
                  title: "",
                  visualDescription: "",
                  visualDirection: "",
                  camera: "",
                  transition: "",
                  characterActions: "",
                  notes: "",
                  duration: "",
                  imageUrl: "",
                  imagePrompt: "",
                },
              ])
            }
          >
            <Plus className="h-4 w-4" />
            افزودن صحنه
          </Button>
        </div>
      )}
    </div>
  );
}
