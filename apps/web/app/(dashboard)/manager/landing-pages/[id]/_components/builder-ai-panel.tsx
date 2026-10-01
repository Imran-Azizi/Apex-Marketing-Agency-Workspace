"use client";

import { useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiPost, ApiError } from "@/lib/api";
import {
  stripRemovedFromContent,
  type LandingContent,
} from "@/lib/landing-content";

type BuilderSelection =
  | { kind: "hero" }
  | { kind: "section"; id: string }
  | { kind: "element"; sectionId: string; elementId: string }
  | { kind: "none" }
  | null;

const PROMPT_MAX_CHARS = 20000;

type AiGenerateResult = {
  content: LandingContent;
  metaDescription?: string;
  mode?: "edit" | "replace" | "append";
  intent?: "edit" | "regenerate" | "clarify" | "append";
  clarify?: boolean;
  question?: string;
  summary?: string | null;
  appliedOps?: number;
  provider?: string;
  model?: string;
  warning?: string;
};

export function BuilderAiPanel({
  canEdit,
  pageTitle,
  content,
  selection,
  onApply,
}: {
  canEdit: boolean;
  pageTitle: string;
  content: LandingContent;
  selection: BuilderSelection;
  onApply: (
    next: LandingContent,
    meta?: {
      warning?: string;
      model?: string;
      intent?: string;
      keepSelection?: boolean;
    },
  ) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState(false);

  async function handleGenerate() {
    if (!canEdit || pending) return;
    const trimmed = prompt.trim();
    if (trimmed.length < 8) {
      toast.error("پرامپت را کمی کامل‌تر بنویسید (حداقل ۸ کاراکتر)");
      return;
    }

    setPending(true);
    try {
      const selectionPayload =
        !selection || selection.kind === "none"
          ? { kind: "none" as const }
          : selection.kind === "hero"
            ? { kind: "hero" as const }
            : selection.kind === "section"
              ? { kind: "section" as const, id: selection.id }
              : {
                  kind: "element" as const,
                  sectionId: selection.sectionId,
                  elementId: selection.elementId,
                };

      const result = await apiPost<AiGenerateResult>(
        "/landing-pages/ai/generate",
        {
          prompt: trimmed,
          pageTitle: pageTitle || undefined,
          language: "fa",
          tone: "professional",
          mode: "edit",
          currentContent: content,
          selection: selectionPayload,
        },
      );

      if (result.clarify || result.intent === "clarify") {
        toast.message(
          result.question || "لطفاً بخش یا عنصر هدف را دقیق‌تر مشخص کنید",
        );
        return;
      }

      const generated = stripRemovedFromContent(result.content);
      const keepSelection = result.intent === "edit";

      onApply(generated, {
        warning: result.warning,
        model: result.model,
        intent: result.intent,
        keepSelection,
      });

      if (result.warning) {
        toast.message(result.warning);
      } else if (result.intent === "edit") {
        toast.success(
          result.summary
            ? `ویرایش اعمال شد: ${result.summary}`
            : `${result.appliedOps || 1} تغییر هدفمند اعمال شد`,
        );
      } else if (result.intent === "append" || result.mode === "append") {
        toast.success("بخش‌های جدید اضافه شد");
      } else {
        toast.success("صفحه با هوش مصنوعی بازسازی شد");
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "تولید ناموفق بود";
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-brand" />
        ویرایش با هوش مصنوعی
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">پرامپت شما</Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, PROMPT_MAX_CHARS))}
          disabled={!canEdit || pending}
          rows={8}
          maxLength={PROMPT_MAX_CHARS}
          placeholder="مثال: رنگ پس‌زمینه این بخش را تیره کن و عنوان را سفید کن…"
          className="min-h-[160px] resize-y text-sm"
        />
        <p className="text-[10px] text-muted-foreground">
          {prompt.trim().length.toLocaleString("fa-AF")} /{" "}
          {PROMPT_MAX_CHARS.toLocaleString("fa-AF")}
        </p>
      </div>

      <Button
        type="button"
        variant="brand"
        className="w-full gap-2"
        disabled={!canEdit || pending}
        onClick={() => void handleGenerate()}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wand2 className="h-4 w-4" />
        )}
        {pending ? "در حال اعمال…" : "اعمال ویرایش"}
      </Button>
    </div>
  );
}
