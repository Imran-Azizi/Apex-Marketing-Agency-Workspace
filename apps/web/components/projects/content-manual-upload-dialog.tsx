"use client";

import { useRef, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  FileText,
  ImagePlus,
  Loader2,
  Mic2,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  buildExactNarrationPayload,
  buildExactScenarioPayload,
  buildExactStoryboardTextPayload,
  buildNarrationPayload,
  buildScenarioPayload,
  buildStoryboardImagesPayload,
  buildStoryboardPayload,
  type StoryboardUploadedImage,
} from "@/lib/content-payload";
import {
  NARRATION_ACCEPT,
  SCENARIO_ACCEPT,
  STORYBOARD_IMAGE_ACCEPT,
  STORYBOARD_TEXT_ACCEPT,
  type ImportedSourceFile,
  importNarrationFile,
  importScenarioFile,
  importStoryboardTextOrJsonFile,
  isImageImportFile,
  isJsonImportFile,
  readImportableText,
} from "@/lib/content-import";
import { assertSupportedContentDocumentFile } from "@/lib/content-document-extract";
import {
  UPLOAD_PURPOSE,
  filePreviewUrl,
  formatFileSize,
  uploadFileWithProgress,
} from "@/lib/upload";

type ManualVersion = {
  id: string;
  versionNumber: number;
  scenario?: unknown;
  narration?: unknown;
  storyboard?: unknown;
};

type InputSource = "file" | "text" | "image" | null;

type SlotState = {
  source: InputSource;
  draftText: string;
  fileName?: string;
  payload?: Record<string, unknown> | null;
  sourceFiles: ImportedSourceFile[];
};

type StoryboardSlotState = SlotState & {
  images: StoryboardUploadedImage[];
  imageProgress: number | null;
};

const emptySlot = (): SlotState => ({
  source: null,
  draftText: "",
  payload: null,
  sourceFiles: [],
});

const emptyStoryboardSlot = (): StoryboardSlotState => ({
  ...emptySlot(),
  images: [],
  imageProgress: null,
});

function slotReady(slot: SlotState): boolean {
  return Boolean(slot.source && slot.payload);
}

function storyboardReady(slot: StoryboardSlotState): boolean {
  return Boolean(slot.payload);
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith("{") || t.startsWith("[");
}

function rebuildStoryboardFromParts(
  text: string,
  images: StoryboardUploadedImage[],
  structured?: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (structured) {
    if (!images.length) return structured;
    return {
      ...structured,
      preserveExact: false,
      uploadedImages: images.map((img) => ({
        url: img.url,
        storageKey: img.storageKey,
        name: img.name || null,
        originalName: img.originalName || img.name || null,
        mimeType: img.mimeType || null,
        sizeBytes: img.sizeBytes ?? null,
      })),
    };
  }
  if (text.trim() && images.length) {
    return buildExactStoryboardTextPayload(text, images);
  }
  if (text.trim()) return buildExactStoryboardTextPayload(text);
  if (images.length) return buildStoryboardImagesPayload(images);
  return null;
}

function ActiveBadge() {
  return (
    <span className="rounded-md bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand">
      منبع فعال
    </span>
  );
}

function SectionCard({
  title,
  description,
  icon,
  accept,
  multiple,
  busy,
  disabled,
  slot,
  textPlaceholder,
  onPickFile,
  onTextChange,
  onClear,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  accept: string;
  multiple?: boolean;
  busy?: boolean;
  disabled?: boolean;
  slot: SlotState;
  textPlaceholder: string;
  onPickFile: (files: FileList) => void;
  onTextChange: (value: string) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const ready = slotReady(slot);

  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-3.5 transition-colors sm:px-4 sm:py-4",
        ready
          ? "border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-500/25 dark:bg-emerald-500/10"
          : "border-border/70 bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            {icon}
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-[11px] leading-5 text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        {ready ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1.5 text-destructive hover:text-destructive"
            disabled={disabled || busy}
            onClick={onClear}
          >
            <Trash2 className="h-3.5 w-3.5" />
            پاک کردن
          </Button>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div
          className={cn(
            "flex flex-col rounded-lg border px-3 py-3",
            slot.source === "file"
              ? "border-brand/35 bg-brand/[0.04]"
              : "border-border/60 bg-background/60",
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">انتخاب فایل</p>
            {slot.source === "file" ? <ActiveBadge /> : null}
          </div>
          <p className="mb-3 text-[11px] leading-5 text-muted-foreground">
            فایل TXT، DOC، DOCX یا PDF را انتخاب کنید.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className="hidden"
            disabled={disabled || busy}
            onChange={(e) => {
              const files = e.target.files;
              if (files?.length) onPickFile(files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-auto w-full gap-1.5 sm:w-auto"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UploadCloud className="h-3.5 w-3.5" />
            )}
            {busy ? "در حال آماده‌سازی…" : "انتخاب فایل"}
          </Button>
          {slot.source === "file" && slot.fileName ? (
            <p className="mt-2 truncate text-[11px] text-foreground">
              {slot.fileName}
            </p>
          ) : null}
        </div>

        <div
          className={cn(
            "flex min-h-0 flex-col rounded-lg border px-3 py-3",
            slot.source === "text"
              ? "border-brand/35 bg-brand/[0.04]"
              : "border-border/60 bg-background/60",
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <Label className="text-xs font-semibold text-foreground">
              وارد کردن متن
            </Label>
            {slot.source === "text" ? <ActiveBadge /> : null}
          </div>
          <p className="mb-2 text-[11px] leading-5 text-muted-foreground">
            متن دقیقاً همان‌طور که وارد می‌کنید ذخیره و نمایش داده می‌شود.
          </p>
          <Textarea
            value={slot.draftText}
            disabled={disabled || busy}
            rows={6}
            placeholder={textPlaceholder}
            className="min-h-[140px] flex-1 resize-y bg-background text-sm leading-7 text-right placeholder:text-right"
            dir="rtl"
            lang="fa"
            onChange={(e) => onTextChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function StoryboardSectionCard({
  busy,
  disabled,
  slot,
  onPickTextFile,
  onPickImageFiles,
  onTextChange,
  onRemoveImage,
  onClear,
}: {
  busy?: boolean;
  disabled?: boolean;
  slot: StoryboardSlotState;
  onPickTextFile: (files: FileList) => void;
  onPickImageFiles: (files: FileList) => void;
  onTextChange: (value: string) => void;
  onRemoveImage: (storageKey: string) => void;
  onClear: () => void;
}) {
  const textInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const ready = storyboardReady(slot);
  const hasText =
    slot.source === "text" ||
    (slot.source === "file" && Boolean(slot.fileName)) ||
    Boolean(slot.draftText.trim());
  const hasImages = slot.images.length > 0;

  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-3.5 transition-colors sm:px-4 sm:py-4",
        ready
          ? "border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-500/25 dark:bg-emerald-500/10"
          : "border-border/70 bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ImagePlus className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold">استوری‌بورد</p>
            <p className="text-[11px] leading-5 text-muted-foreground">
              آپلود متن (TXT / DOC / DOCX / PDF)، آپلود تصویر، یا ورود مستقیم —
              متن بدون تغییر ذخیره می‌شود
            </p>
          </div>
        </div>
        {ready ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1.5 text-destructive hover:text-destructive"
            disabled={disabled || busy}
            onClick={onClear}
          >
            <Trash2 className="h-3.5 w-3.5" />
            پاک کردن
          </Button>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div
          className={cn(
            "flex flex-col rounded-lg border px-3 py-3",
            slot.source === "file"
              ? "border-brand/35 bg-brand/[0.04]"
              : "border-border/60 bg-background/60",
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">آپلود متن</p>
            {slot.source === "file" ? <ActiveBadge /> : null}
          </div>
          <p className="mb-3 text-[11px] leading-5 text-muted-foreground">
            فایل TXT / DOC / DOCX / PDF
          </p>
          <input
            ref={textInputRef}
            type="file"
            accept={STORYBOARD_TEXT_ACCEPT}
            className="hidden"
            disabled={disabled || busy}
            onChange={(e) => {
              const files = e.target.files;
              if (files?.length) onPickTextFile(files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-auto w-full gap-1.5"
            disabled={disabled || busy}
            onClick={() => textInputRef.current?.click()}
          >
            {busy && slot.source === "file" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            آپلود متن
          </Button>
          {slot.source === "file" && slot.fileName ? (
            <p className="mt-2 truncate text-[11px] text-foreground">
              {slot.fileName}
            </p>
          ) : null}
        </div>

        <div
          className={cn(
            "flex flex-col rounded-lg border px-3 py-3",
            hasImages
              ? "border-brand/35 bg-brand/[0.04]"
              : "border-border/60 bg-background/60",
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">آپلود تصویر</p>
            {hasImages && !hasText ? <ActiveBadge /> : null}
            {hasImages && hasText ? (
              <span className="rounded-md bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand">
                همراه متن
              </span>
            ) : null}
          </div>
          <p className="mb-3 text-[11px] leading-5 text-muted-foreground">
            یک یا چند تصویر استوری‌بورد
          </p>
          <input
            ref={imageInputRef}
            type="file"
            accept={STORYBOARD_IMAGE_ACCEPT}
            multiple
            className="hidden"
            disabled={disabled || busy}
            onChange={(e) => {
              const files = e.target.files;
              if (files?.length) onPickImageFiles(files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-auto w-full gap-1.5"
            disabled={disabled || busy}
            onClick={() => imageInputRef.current?.click()}
          >
            {busy && slot.imageProgress != null ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" />
            )}
            {slot.imageProgress != null
              ? `آپلود… ${slot.imageProgress}%`
              : "آپلود تصویر"}
          </Button>
        </div>

        <div
          className={cn(
            "flex min-h-0 flex-col rounded-lg border px-3 py-3 lg:col-span-1",
            slot.source === "text"
              ? "border-brand/35 bg-brand/[0.04]"
              : "border-border/60 bg-background/60",
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <Label className="text-xs font-semibold">وارد کردن متن</Label>
            {slot.source === "text" ? <ActiveBadge /> : null}
          </div>
          <p className="mb-2 text-[11px] leading-5 text-muted-foreground">
            خط‌ها و فاصله‌ها دقیقاً حفظ می‌شوند.
          </p>
          <Textarea
            value={slot.draftText}
            disabled={disabled || busy}
            rows={6}
            placeholder="متن استوری‌بورد را اینجا وارد یا Paste کنید..."
            className="min-h-[140px] flex-1 resize-y bg-background text-sm leading-7 text-right placeholder:text-right"
            dir="rtl"
            lang="fa"
            onChange={(e) => onTextChange(e.target.value)}
          />
        </div>
      </div>

      {slot.images.length ? (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground">
            پیش‌نمایش تصاویر (
            {slot.images.length.toLocaleString("fa-AF", {
              numberingSystem: "latn",
            })}
            )
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {slot.images.map((img) => (
              <div
                key={img.storageKey}
                className="group relative overflow-hidden rounded-lg border bg-muted/20"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.originalName || img.name || "storyboard"}
                  className="aspect-video w-full object-contain"
                />
                <div className="flex items-center justify-between gap-1 border-t px-2 py-1">
                  <span className="truncate text-[10px] text-muted-foreground">
                    {img.originalName || img.name}
                  </span>
                  <button
                    type="button"
                    className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    disabled={disabled || busy}
                    onClick={() => onRemoveImage(img.storageKey)}
                    aria-label="حذف تصویر"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ContentManualUploadDialog({
  open,
  onOpenChange,
  projectId,
  disabled,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  disabled?: boolean;
  onCreated: (version: ManualVersion) => void;
}) {
  const [scenarioSlot, setScenarioSlot] = useState<SlotState>(emptySlot);
  const [narrationSlot, setNarrationSlot] = useState<SlotState>(emptySlot);
  const [storyboardSlot, setStoryboardSlot] =
    useState<StoryboardSlotState>(emptyStoryboardSlot);
  const [slotBusy, setSlotBusy] = useState<
    "scenario" | "narration" | "storyboard" | null
  >(null);

  const reset = () => {
    setScenarioSlot(emptySlot());
    setNarrationSlot(emptySlot());
    setStoryboardSlot(emptyStoryboardSlot());
    setSlotBusy(null);
  };

  const resolveSlotPayload = (slot: SlotState) =>
    slotReady(slot) ? slot.payload || undefined : undefined;

  const createMut = useMutation({
    mutationFn: () => {
      const pendingText =
        (scenarioSlot.draftText.trim() && !slotReady(scenarioSlot)
          ? "سناریو"
          : null) ||
        (narrationSlot.draftText.trim() && !slotReady(narrationSlot)
          ? "نریشن"
          : null) ||
        (storyboardSlot.draftText.trim() &&
        !storyboardReady(storyboardSlot) &&
        !storyboardSlot.images.length
          ? "استوری‌بورد"
          : null);
      if (pendingText) {
        throw new Error(
          `متن ${pendingText} هنوز معتبر نیست. محتوا را کامل کنید یا پاک کنید.`,
        );
      }
      if (
        !slotReady(scenarioSlot) &&
        !slotReady(narrationSlot) &&
        !storyboardReady(storyboardSlot)
      ) {
        throw new Error("حداقل یک بخش را با فایل، تصویر یا متن وارد کنید");
      }
      const sourceFiles = [
        ...scenarioSlot.sourceFiles,
        ...narrationSlot.sourceFiles,
        ...storyboardSlot.sourceFiles,
      ];
      return apiPost<ManualVersion>(`/ai/${projectId}/versions/manual`, {
        scenario: resolveSlotPayload(scenarioSlot),
        narration: resolveSlotPayload(narrationSlot),
        storyboard: storyboardReady(storyboardSlot)
          ? storyboardSlot.payload || undefined
          : undefined,
        sourceFiles,
      });
    },
    onSuccess: (version) => {
      toast.success(
        `نسخه ${version.versionNumber.toLocaleString("fa-AF", {
          numberingSystem: "latn",
        })} با ورود دستی ایجاد و به‌صورت خودکار تأیید شد`,
      );
      reset();
      onOpenChange(false);
      onCreated(version);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "ایجاد نسخه ناموفق بود"),
  });

  const applyScenarioText = (raw: string) => {
    if (!raw.trim()) {
      setScenarioSlot(emptySlot());
      return;
    }
    setScenarioSlot((prev) => {
      if (prev.source === "file") {
        queueMicrotask(() =>
          toast.message("منبع سناریو به متن تغییر کرد", {
            description: "فایل قبلی برای این بخش کنار گذاشته شد.",
          }),
        );
      }
      try {
        return {
          source: "text" as const,
          draftText: raw,
          payload: buildExactScenarioPayload(raw),
          sourceFiles: [
            {
              section: "scenario" as const,
              name: "pasted-text.txt",
              mimeType: "text/plain",
              sizeBytes: new TextEncoder().encode(raw).length,
              inputMethod: "text" as const,
            },
          ],
        };
      } catch {
        return {
          source: null,
          draftText: raw,
          payload: null,
          sourceFiles: [],
        };
      }
    });
  };

  const applyNarrationText = (raw: string) => {
    if (!raw.trim()) {
      setNarrationSlot(emptySlot());
      return;
    }
    setNarrationSlot((prev) => {
      if (prev.source === "file") {
        queueMicrotask(() =>
          toast.message("منبع نریشن به متن تغییر کرد", {
            description: "فایل قبلی برای این بخش کنار گذاشته شد.",
          }),
        );
      }
      try {
        return {
          source: "text" as const,
          draftText: raw,
          payload: buildExactNarrationPayload(raw),
          sourceFiles: [
            {
              section: "narration" as const,
              name: "pasted-text.txt",
              mimeType: "text/plain",
              sizeBytes: new TextEncoder().encode(raw).length,
              inputMethod: "text" as const,
            },
          ],
        };
      } catch {
        return {
          source: null,
          draftText: raw,
          payload: null,
          sourceFiles: [],
        };
      }
    });
  };

  const applyStoryboardText = (raw: string) => {
    setStoryboardSlot((prev) => {
      if (!raw.trim() && !prev.images.length) {
        return emptyStoryboardSlot();
      }
      if (prev.source === "file" && raw.trim()) {
        queueMicrotask(() =>
          toast.message("منبع استوری‌بورد به متن تغییر کرد", {
            description: "فایل متنی قبلی برای این بخش کنار گذاشته شد.",
          }),
        );
      }
      const textSourceFiles: ImportedSourceFile[] = raw.trim()
        ? [
            {
              section: "storyboard",
              name: "pasted-text.txt",
              mimeType: "text/plain",
              sizeBytes: new TextEncoder().encode(raw).length,
              inputMethod: "text",
            },
          ]
        : [];
      const imageSourceFiles = prev.sourceFiles.filter(
        (f) => f.inputMethod === "image",
      );
      try {
        const payload = rebuildStoryboardFromParts(raw, prev.images);
        return {
          ...prev,
          source: raw.trim()
            ? ("text" as const)
            : prev.images.length
              ? ("image" as const)
              : null,
          draftText: raw,
          fileName: undefined,
          payload,
          sourceFiles: [...textSourceFiles, ...imageSourceFiles],
        };
      } catch {
        return {
          ...prev,
          source: null,
          draftText: raw,
          payload: null,
          sourceFiles: imageSourceFiles,
        };
      }
    });
  };

  const handleScenario = async (files: FileList) => {
    const file = files[0];
    if (!file) return;
    setSlotBusy("scenario");
    try {
      assertSupportedContentDocumentFile(file);
      const text = await readImportableText(file);
      let source: ImportedSourceFile = {
        section: "scenario",
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        inputMethod: "file",
      };
      try {
        const uploaded = await uploadFileWithProgress(file, {
          purpose: UPLOAD_PURPOSE.CONTENT_IMPORT,
          projectId,
        });
        source = {
          ...source,
          storageKey: uploaded.key,
          url:
            uploaded.url ||
            filePreviewUrl(uploaded.key, uploaded.storageMeta) ||
            null,
        };
      } catch {
        // Content still usable from parsed text even if archive upload fails
      }
      if (scenarioSlot.draftText.trim()) {
        toast.message("منبع سناریو به فایل تغییر کرد", {
          description: "متن واردشده برای این بخش کنار گذاشته شد.",
        });
      }

      let payload: Record<string, unknown>;
      if (isJsonImportFile(file) || looksLikeJson(text)) {
        const result = await importScenarioFile(file);
        payload = buildScenarioPayload(result.form, null);
      } else {
        payload = buildExactScenarioPayload(text);
      }

      setScenarioSlot({
        source: "file",
        draftText: "",
        fileName: `${file.name} · ${formatFileSize(file.size)}`,
        payload,
        sourceFiles: [source],
      });
      toast.success("سناریو از فایل آماده شد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ورود سناریو ناموفق بود");
    } finally {
      setSlotBusy(null);
    }
  };

  const handleNarration = async (files: FileList) => {
    const file = files[0];
    if (!file) return;
    setSlotBusy("narration");
    try {
      assertSupportedContentDocumentFile(file);
      const text = await readImportableText(file);
      let source: ImportedSourceFile = {
        section: "narration",
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        inputMethod: "file",
      };
      try {
        const uploaded = await uploadFileWithProgress(file, {
          purpose: UPLOAD_PURPOSE.CONTENT_IMPORT,
          projectId,
        });
        source = {
          ...source,
          storageKey: uploaded.key,
          url:
            uploaded.url ||
            filePreviewUrl(uploaded.key, uploaded.storageMeta) ||
            null,
        };
      } catch {
        // ignore archive failure
      }
      if (narrationSlot.draftText.trim()) {
        toast.message("منبع نریشن به فایل تغییر کرد", {
          description: "متن واردشده برای این بخش کنار گذاشته شد.",
        });
      }

      let payload: Record<string, unknown>;
      if (isJsonImportFile(file) || looksLikeJson(text)) {
        const result = await importNarrationFile(file);
        payload = buildNarrationPayload(result.form, null);
      } else {
        payload = buildExactNarrationPayload(text);
      }

      setNarrationSlot({
        source: "file",
        draftText: "",
        fileName: `${file.name} · ${formatFileSize(file.size)}`,
        payload,
        sourceFiles: [source],
      });
      toast.success("نریشن از فایل آماده شد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ورود نریشن ناموفق بود");
    } finally {
      setSlotBusy(null);
    }
  };

  const handleStoryboardTextFile = async (files: FileList) => {
    const file = files[0];
    if (!file) return;
    if (isImageImportFile(file)) {
      toast.error("برای آپلود متن، فایل TXT، DOC، DOCX یا PDF انتخاب کنید.");
      return;
    }
    setSlotBusy("storyboard");
    try {
      assertSupportedContentDocumentFile(file);
      const text = await readImportableText(file);
      let source: ImportedSourceFile = {
        section: "storyboard",
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        inputMethod: "file",
      };
      try {
        const uploaded = await uploadFileWithProgress(file, {
          purpose: UPLOAD_PURPOSE.CONTENT_IMPORT,
          projectId,
        });
        source = {
          ...source,
          storageKey: uploaded.key,
          url:
            uploaded.url ||
            filePreviewUrl(uploaded.key, uploaded.storageMeta) ||
            null,
        };
      } catch {
        // ignore archive failure
      }

      const isJson = isJsonImportFile(file) || looksLikeJson(text);
      let structured: Record<string, unknown> | null = null;
      let draftText = "";
      if (isJson) {
        const result = await importStoryboardTextOrJsonFile(file);
        structured = buildStoryboardPayload(
          result.scenes,
          result.original ?? null,
          result.collage,
        );
      } else {
        draftText = text;
      }

      setStoryboardSlot((prev) => {
        const imageSourceFiles = prev.sourceFiles.filter(
          (f) => f.inputMethod === "image",
        );
        return {
          ...prev,
          source: "file",
          draftText,
          fileName: `${file.name} · ${formatFileSize(file.size)}`,
          payload: rebuildStoryboardFromParts(
            draftText,
            prev.images,
            structured,
          ),
          sourceFiles: [source, ...imageSourceFiles],
        };
      });
      toast.success("استوری‌بورد از فایل متنی آماده شد");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "ورود متن استوری‌بورد ناموفق بود",
      );
    } finally {
      setSlotBusy(null);
    }
  };

  const handleStoryboardImages = async (files: FileList) => {
    const list = Array.from(files).filter(isImageImportFile);
    if (!list.length) {
      toast.error("فقط فایل تصویری انتخاب کنید.");
      return;
    }
    setSlotBusy("storyboard");
    setStoryboardSlot((prev) => ({ ...prev, imageProgress: 0 }));
    try {
      const uploadedRefs: StoryboardUploadedImage[] = [];
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        const uploaded = await uploadFileWithProgress(
          file,
          {
            purpose: UPLOAD_PURPOSE.CONTENT_IMPORT,
            projectId,
          },
          (percent) => {
            const overall = Math.round(
              ((i + percent / 100) / list.length) * 100,
            );
            setStoryboardSlot((prev) => ({
              ...prev,
              imageProgress: overall,
            }));
          },
        );
        const url =
          uploaded.url ||
          (uploaded.key
            ? filePreviewUrl(uploaded.key, uploaded.storageMeta)
            : null);
        if (!url || !uploaded.key) {
          throw new Error(`آپلود «${file.name}» ناموفق بود`);
        }
        uploadedRefs.push({
          url,
          storageKey: uploaded.key,
          name: file.name,
          originalName: file.name,
          mimeType: file.type || "image/jpeg",
          sizeBytes: file.size,
        });
      }

      setStoryboardSlot((prev) => {
        const nextImages = [...prev.images, ...uploadedRefs];
        const textSources = prev.sourceFiles.filter(
          (f) => f.inputMethod === "text" || f.inputMethod === "file",
        );
        const imageSources: ImportedSourceFile[] = nextImages.map((img) => ({
          section: "storyboard" as const,
          name: img.originalName || img.name || "image",
          mimeType: img.mimeType || "image/jpeg",
          sizeBytes: img.sizeBytes || 0,
          storageKey: img.storageKey,
          url: img.url,
          inputMethod: "image" as const,
        }));
        const text =
          prev.source === "text" || prev.source === "file"
            ? prev.draftText
            : prev.draftText;
        const structured =
          prev.source === "file" &&
          prev.payload &&
          prev.payload.preserveExact !== true
            ? prev.payload
            : null;
        return {
          ...prev,
          source: text.trim()
            ? prev.source === "file"
              ? ("file" as const)
              : ("text" as const)
            : ("image" as const),
          images: nextImages,
          imageProgress: null,
          payload: rebuildStoryboardFromParts(text, nextImages, structured),
          sourceFiles: [...textSources, ...imageSources],
        };
      });
      toast.success(
        `${uploadedRefs.length.toLocaleString("fa-AF", {
          numberingSystem: "latn",
        })} تصویر استوری‌بورد آپلود شد`,
      );
    } catch (e) {
      setStoryboardSlot((prev) => ({ ...prev, imageProgress: null }));
      toast.error(
        e instanceof Error ? e.message : "آپلود تصویر استوری‌بورد ناموفق بود",
      );
    } finally {
      setSlotBusy(null);
    }
  };

  const removeStoryboardImage = (storageKey: string) => {
    setStoryboardSlot((prev) => {
      const nextImages = prev.images.filter(
        (img) => img.storageKey !== storageKey,
      );
      const textSources = prev.sourceFiles.filter(
        (f) => f.inputMethod === "text" || f.inputMethod === "file",
      );
      const imageSources: ImportedSourceFile[] = nextImages.map((img) => ({
        section: "storyboard" as const,
        name: img.originalName || img.name || "image",
        mimeType: img.mimeType || "image/jpeg",
        sizeBytes: img.sizeBytes || 0,
        storageKey: img.storageKey,
        url: img.url,
        inputMethod: "image" as const,
      }));
      const structured =
        prev.source === "file" &&
        prev.payload &&
        prev.payload.preserveExact !== true
          ? (prev.payload as Record<string, unknown>)
          : null;
      const payload = rebuildStoryboardFromParts(
        prev.draftText,
        nextImages,
        structured,
      );
      return {
        ...prev,
        images: nextImages,
        payload,
        source:
          prev.draftText.trim() || structured
            ? prev.source === "file"
              ? ("file" as const)
              : ("text" as const)
            : nextImages.length
              ? ("image" as const)
              : null,
        sourceFiles: [...textSources, ...imageSources],
      };
    });
  };

  const busy = createMut.isPending || Boolean(slotBusy);
  const canSubmit =
    slotReady(scenarioSlot) ||
    slotReady(narrationSlot) ||
    storyboardReady(storyboardSlot);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl lg:max-w-5xl">
        <div className="border-b border-border/60 bg-gradient-to-l from-brand/[0.07] via-transparent to-transparent px-5 pb-4 pt-5 sm:px-6">
          <DialogHeader className="pe-6 text-start">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <UploadCloud className="h-4 w-4" />
              </span>
              آپلود محتوا از منبع خارجی
            </DialogTitle>
            <DialogDescription className="leading-6">
              متن دستی بدون بازنویسی ذخیره می‌شود و پس از ثبت، بدون نیاز به تأیید
              مشتری به‌صورت خودکار تأیید می‌گردد. برای استوری‌بورد می‌توانید متن و
              تصویر را جداگانه آپلود کنید.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
          <SectionCard
            title="سناریو"
            description="فایل TXT / DOC / DOCX / PDF یا ورود مستقیم متن"
            icon={<FileText className="h-4 w-4" />}
            accept={SCENARIO_ACCEPT}
            busy={slotBusy === "scenario"}
            disabled={busy}
            slot={scenarioSlot}
            textPlaceholder="متن سناریو را اینجا وارد یا Paste کنید..."
            onPickFile={handleScenario}
            onTextChange={applyScenarioText}
            onClear={() => setScenarioSlot(emptySlot())}
          />
          <SectionCard
            title="نریشن"
            description="فایل TXT / DOC / DOCX / PDF یا ورود مستقیم متن"
            icon={<Mic2 className="h-4 w-4" />}
            accept={NARRATION_ACCEPT}
            busy={slotBusy === "narration"}
            disabled={busy}
            slot={narrationSlot}
            textPlaceholder="متن نریشن را اینجا وارد یا Paste کنید..."
            onPickFile={handleNarration}
            onTextChange={applyNarrationText}
            onClear={() => setNarrationSlot(emptySlot())}
          />
          <StoryboardSectionCard
            busy={slotBusy === "storyboard"}
            disabled={busy}
            slot={storyboardSlot}
            onPickTextFile={handleStoryboardTextFile}
            onPickImageFiles={handleStoryboardImages}
            onTextChange={applyStoryboardText}
            onRemoveImage={removeStoryboardImage}
            onClear={() => setStoryboardSlot(emptyStoryboardSlot())}
          />
        </div>

        <DialogFooter className="gap-2 border-t border-border/60 bg-muted/20 px-5 py-4 sm:px-6">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            انصراف
          </Button>
          <Button
            variant="brand"
            className="gap-2"
            disabled={busy || disabled || !canSubmit}
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            {createMut.isPending ? "در حال ایجاد…" : "ایجاد نسخه"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
