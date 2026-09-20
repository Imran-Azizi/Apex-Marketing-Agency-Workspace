"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Check,
  ImagePlus,
  Loader2,
  Replace,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  isImageImportFile,
  STORYBOARD_IMAGE_ACCEPT,
} from "@/lib/content-import";
import { UPLOAD_PURPOSE } from "@/lib/media-manager";
import { filePreviewUrl, uploadFileWithProgress } from "@/lib/upload";
import {
  buildExactNarrationPayload,
  buildExactScenarioPayload,
  buildExactStoryboardTextPayload,
  extractStoryboardUploadedImages,
  narrationToEditableText,
  scenarioToEditableText,
  storyboardToEditableText,
  type StoryboardUploadedImage,
} from "@/lib/content-payload";

export type ContentEditSection = "scenario" | "narration" | "storyboard";

const SECTION_LABEL: Record<ContentEditSection, string> = {
  scenario: "سناریو",
  narration: "نریشن",
  storyboard: "استوری‌بورد",
};

const TEXT_LABEL: Record<ContentEditSection, string> = {
  scenario: "متن سناریو",
  narration: "متن نریشن",
  storyboard: "متن استوری‌بورد",
};

type ContentSectionInlineEditorProps = {
  projectId: string;
  baseVersionId: string;
  section: ContentEditSection;
  scenario?: unknown;
  narration?: unknown;
  storyboard?: unknown;
  dir?: "rtl" | "ltr";
  className?: string;
  onCancel: () => void;
  onSaved?: (version: { id: string; versionNumber: number }) => void;
};

function sectionSourceText(
  section: ContentEditSection,
  scenario: unknown,
  narration: unknown,
  storyboard: unknown,
) {
  if (section === "scenario") return scenarioToEditableText(scenario);
  if (section === "narration") return narrationToEditableText(narration);
  return storyboardToEditableText(storyboard);
}

function resolveImageSrc(img: StoryboardUploadedImage): string {
  const url = (img.url || "").trim();
  if (/^https?:\/\//i.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }
  const key = (img.storageKey || url).trim();
  return key ? filePreviewUrl(key) || url || key : url;
}

export function ContentSectionInlineEditor({
  projectId,
  baseVersionId,
  section,
  scenario,
  narration,
  storyboard,
  dir = "rtl",
  className,
  onCancel,
  onSaved,
}: ContentSectionInlineEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const replaceOneInputRef = useRef<HTMLInputElement>(null);
  const replaceAllInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetKeyRef = useRef<string | null>(null);

  const [text, setText] = useState(() =>
    sectionSourceText(section, scenario, narration, storyboard),
  );
  const [images, setImages] = useState<StoryboardUploadedImage[]>(() =>
    extractStoryboardUploadedImages(storyboard),
  );
  const [imageProgress, setImageProgress] = useState<number | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);

  useEffect(() => {
    setText(sectionSourceText(section, scenario, narration, storyboard));
    setImages(extractStoryboardUploadedImages(storyboard));
    setImageProgress(null);
    setUploadingImages(false);
  }, [section, scenario, narration, storyboard]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const trimmed = text.trim();
      const body: Record<string, unknown> = {
        baseVersionId,
        section,
        changeNotes: `ویرایش دستی ${SECTION_LABEL[section]}`,
      };

      if (section === "scenario") {
        if (!trimmed) throw new Error("متن سناریو خالی است.");
        body.scenario = buildExactScenarioPayload(text);
      } else if (section === "narration") {
        if (!trimmed) throw new Error("متن نریشن خالی است.");
        body.narration = buildExactNarrationPayload(text);
      } else {
        if (!trimmed && !images.length) {
          throw new Error("متن یا تصویر استوری‌بورد لازم است.");
        }
        body.storyboard = buildExactStoryboardTextPayload(text, images);
      }

      return apiPost<{ id: string; versionNumber: number }>(
        `/ai/${projectId}/versions/edit`,
        body,
      );
    },
    onSuccess: (version) => {
      toast.success(`نسخه ${version.versionNumber} با ویرایش دستی ذخیره شد`);
      onSaved?.(version);
    },
    onError: (err: Error) => {
      toast.error(err.message || "ذخیره ویرایش ناموفق بود");
    },
  });

  const pending = saveMut.isPending || uploadingImages;

  const uploadImageFiles = async (
    files: FileList | File[],
    mode: "append" | "replace-all" | "replace-one",
    replaceKey?: string | null,
  ) => {
    const list = Array.from(files).filter(isImageImportFile);
    if (!list.length) {
      toast.error("فقط فایل تصویری انتخاب کنید.");
      return;
    }

    setUploadingImages(true);
    setImageProgress(0);
    try {
      const uploadedRefs: StoryboardUploadedImage[] = [];
      for (let i = 0; i < list.length; i += 1) {
        const file = list[i];
        const uploaded = await uploadFileWithProgress(
          file,
          {
            purpose: UPLOAD_PURPOSE.CONTENT_IMPORT,
            projectId,
          },
          (percent) => {
            const overall = Math.round(((i + percent / 100) / list.length) * 100);
            setImageProgress(overall);
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

      setImages((prev) => {
        if (mode === "replace-all") return uploadedRefs;
        if (mode === "replace-one" && replaceKey) {
          const idx = prev.findIndex((img) => img.storageKey === replaceKey);
          if (idx < 0) return [...prev, ...uploadedRefs];
          const next = [...prev];
          next.splice(idx, 1, ...uploadedRefs);
          return next;
        }
        return [...prev, ...uploadedRefs];
      });

      toast.success(
        mode === "replace-all" || mode === "replace-one"
          ? "تصویر استوری‌بورد به‌روزرسانی شد"
          : `${uploadedRefs.length.toLocaleString("fa-AF", {
              numberingSystem: "latn",
            })} تصویر اضافه شد`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "آپلود تصویر ناموفق بود");
    } finally {
      setUploadingImages(false);
      setImageProgress(null);
      replaceTargetKeyRef.current = null;
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-[24rem] flex-col rounded-xl border border-brand/20 bg-card",
        className,
      )}
      dir={dir}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-brand/[0.04] px-3 py-2.5 sm:px-4">
        <p className="text-sm font-medium">
          در حال ویرایش {SECTION_LABEL[section]}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled={pending}
            onClick={onCancel}
          >
            <X className="h-3.5 w-3.5" />
            لغو
          </Button>
          <Button
            type="button"
            variant="brand"
            size="sm"
            className="h-8 gap-1.5"
            disabled={pending}
            onClick={() => saveMut.mutate()}
          >
            {pending && !uploadingImages ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            ذخیره
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        {section === "storyboard" ? (
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">
                  تصویر استوری‌بورد
                </Label>
                <p className="text-[11px] leading-5 text-muted-foreground">
                  تصویر فعلی را عوض کنید، تصویر جدید اضافه کنید، یا حذف نمایید.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept={STORYBOARD_IMAGE_ACCEPT}
                  multiple
                  className="hidden"
                  disabled={pending}
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files?.length) {
                      void uploadImageFiles(files, "append");
                    }
                    e.target.value = "";
                  }}
                />
                <input
                  ref={replaceOneInputRef}
                  type="file"
                  accept={STORYBOARD_IMAGE_ACCEPT}
                  className="hidden"
                  disabled={pending}
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files?.length) {
                      void uploadImageFiles(
                        files,
                        "replace-one",
                        replaceTargetKeyRef.current,
                      );
                    }
                    e.target.value = "";
                  }}
                />
                <input
                  ref={replaceAllInputRef}
                  type="file"
                  accept={STORYBOARD_IMAGE_ACCEPT}
                  multiple
                  className="hidden"
                  disabled={pending}
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files?.length) {
                      void uploadImageFiles(files, "replace-all");
                    }
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  disabled={pending}
                  onClick={() => imageInputRef.current?.click()}
                >
                  {uploadingImages ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" />
                  )}
                  {imageProgress != null
                    ? `آپلود… ${imageProgress}%`
                    : "افزودن تصویر"}
                </Button>
                {images.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    disabled={pending}
                    onClick={() => replaceAllInputRef.current?.click()}
                  >
                    <Replace className="h-3.5 w-3.5" />
                    تعویض همه
                  </Button>
                ) : null}
              </div>
            </div>

            {images.length ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {images.map((img) => (
                  <div
                    key={img.storageKey}
                    className="group overflow-hidden rounded-lg border bg-background"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveImageSrc(img)}
                      alt={img.originalName || img.name || "storyboard"}
                      className="aspect-video w-full object-contain bg-muted/30"
                    />
                    <div className="flex items-center justify-between gap-1 border-t px-2 py-1.5">
                      <span className="min-w-0 truncate text-[10px] text-muted-foreground">
                        {img.originalName || img.name || "تصویر"}
                      </span>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          disabled={pending}
                          title="تعویض این تصویر"
                          aria-label="تعویض این تصویر"
                          onClick={() => {
                            replaceTargetKeyRef.current = img.storageKey;
                            replaceOneInputRef.current?.click();
                          }}
                        >
                          <Replace className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          disabled={pending}
                          title="حذف تصویر"
                          aria-label="حذف تصویر"
                          onClick={() =>
                            setImages((prev) =>
                              prev.filter((item) => item.storageKey !== img.storageKey),
                            )
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => imageInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-background/70 px-4 py-8 text-center transition-colors hover:border-brand/40 hover:bg-brand/[0.03]"
              >
                <ImagePlus className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">افزودن تصویر استوری‌بورد</span>
                <span className="text-[11px] text-muted-foreground">
                  JPG، PNG، WebP یا تصویر مشابه
                </span>
              </button>
            )}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            {TEXT_LABEL[section]}
          </Label>
          <Textarea
            rows={14}
            value={text}
            disabled={pending}
            onChange={(e) => setText(e.target.value)}
            placeholder={`متن ${SECTION_LABEL[section]} را اینجا ویرایش کنید...`}
            className="min-h-[min(50vh,22rem)] resize-y text-[15px] leading-8"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 px-3 py-2.5 sm:px-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          disabled={pending}
          onClick={onCancel}
        >
          <X className="h-3.5 w-3.5" />
          لغو
        </Button>
        <Button
          type="button"
          variant="brand"
          size="sm"
          className="h-8 gap-1.5"
          disabled={pending}
          onClick={() => saveMut.mutate()}
        >
          {pending && !uploadingImages ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          ذخیره
        </Button>
      </div>
    </div>
  );
}
