"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Loader2,
  Send,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const SUCCESS_STORY_MAX = 4000;

export type PortfolioEligibleVideo = {
  id: string;
  name: string;
  kind: string;
  videoType: string | null;
  status: string;
  version: number;
};

export type ProjectPortfolioState = {
  project: {
    id: string;
    code: string;
    title: string;
    status: string;
    completedAt: string | null;
  };
  canPublish: boolean;
  videos: PortfolioEligibleVideo[];
  portfolio: {
    id: string;
    title: string;
    description: string;
    successStory: string;
    slug: string;
    status: string;
    publishedAt: string | null;
    videoFileId: string;
  } | null;
};

type GeneratedPortfolioCopy = {
  title: string;
  description: string;
  successStory: string;
};

type PublishToPortfolioDialogProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ProjectPortfolioState | null;
  /** Required: the manager-selected final video file id */
  videoFileId?: string | null;
};

export function PublishToPortfolioDialog({
  projectId,
  open,
  onOpenChange,
  initial,
  videoFileId,
}: PublishToPortfolioDialogProps) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [successStory, setSuccessStory] = useState("");
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const stateQ = useQuery({
    queryKey: ["portfolio-project", projectId],
    queryFn: () =>
      apiGet<ProjectPortfolioState>(`/portfolio/projects/${projectId}`),
    enabled: open && !!projectId,
    initialData: initial ?? undefined,
  });

  const selectedVideo = useMemo(() => {
    const videos = stateQ.data?.videos || [];
    if (!videoFileId) return null;
    return videos.find((v) => v.id === videoFileId) || null;
  }, [stateQ.data?.videos, videoFileId]);

  useEffect(() => {
    if (!open) {
      setConfirmOverwrite(false);
      setConfirmPublish(false);
      setGenerateError(null);
      return;
    }
    const existing = stateQ.data?.portfolio;
    if (existing) {
      setTitle(existing.title || "");
      setDescription(existing.description || "");
      setSuccessStory(existing.successStory || "");
    } else {
      setTitle("");
      setDescription("");
      setSuccessStory("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when dialog opens / data arrives
  }, [open, stateQ.data?.portfolio?.id]);

  const generateMut = useMutation({
    mutationFn: async () => {
      if (!videoFileId) {
        throw new Error("لطفاً ابتدا یک ویدیو را انتخاب کنید");
      }
      return apiPost<GeneratedPortfolioCopy>(
        `/portfolio/projects/${projectId}/generate`,
        { videoFileId },
      );
    },
    onSuccess: (data) => {
      setGenerateError(null);
      setConfirmOverwrite(false);
      setTitle(data.title || "");
      setDescription(data.description || "");
      setSuccessStory(data.successStory || "");
      toast.success("محتوا با هوش مصنوعی تولید شد");
    },
    onError: (e) => {
      const message =
        e instanceof Error ? e.message : "تولید محتوا با هوش مصنوعی ناموفق بود";
      setGenerateError(message);
      toast.error(message);
    },
  });

  const publishMut = useMutation({
    mutationFn: () => {
      if (!videoFileId) {
        throw new Error("لطفاً ابتدا یک ویدیو را انتخاب کنید");
      }
      return apiPost(`/portfolio/projects/${projectId}/publish`, {
        title: title.trim(),
        description: description.trim(),
        successStory: successStory.trim() || null,
        videoFileId,
      });
    },
    onSuccess: () => {
      toast.success("پروژه با موفقیت به نمونه‌کارها ارسال شد");
      qc.invalidateQueries({ queryKey: ["portfolio-project", projectId] });
      qc.invalidateQueries({ queryKey: ["portfolio-admin"] });
      qc.invalidateQueries({ queryKey: ["public-portfolio"] });
      setConfirmPublish(false);
      onOpenChange(false);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "انتشار نمونه‌کار ناموفق بود"),
  });

  const titleOk = title.trim().length >= 3;
  const descOk = description.trim().length >= 20;
  const busy = generateMut.isPending || publishMut.isPending;
  const alreadyPublished = stateQ.data?.portfolio?.status === "PUBLISHED";
  const hasSelectedVideo = Boolean(selectedVideo);
  const canGenerate =
    Boolean(stateQ.data?.canPublish) && hasSelectedVideo && !busy;
  const canPublish =
    Boolean(stateQ.data?.canPublish) &&
    hasSelectedVideo &&
    titleOk &&
    descOk &&
    !busy;
  const hasExistingCopy =
    Boolean(title.trim()) ||
    Boolean(description.trim()) ||
    Boolean(successStory.trim());

  function requestGenerate() {
    setGenerateError(null);
    if (hasExistingCopy && !confirmOverwrite) {
      setConfirmOverwrite(true);
      return;
    }
    generateMut.mutate();
  }

  function requestPublish() {
    if (!hasSelectedVideo) {
      toast.error("لطفاً ابتدا یک ویدیو را برای نمونه‌کارها انتخاب کنید");
      return;
    }
    if (!confirmPublish) {
      setConfirmPublish(true);
      return;
    }
    publishMut.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent
        className="flex max-h-[min(92dvh,100svh)] w-[calc(100%-1.25rem)] max-w-[calc(100vw-1.25rem)] flex-col gap-0 overflow-hidden p-0 text-start sm:max-w-xl"
        dir="rtl"
      >
        <DialogHeader className="shrink-0 space-y-1.5 px-4 pb-3 pt-5 pe-12 text-start sm:px-6 sm:pe-14">
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-brand" />
            ارسال به نمونه‌کارها
          </DialogTitle>
          <DialogDescription className="sr-only">
            انتشار ویدیوی انتخاب‌شده در نمونه‌کارها
          </DialogDescription>
        </DialogHeader>

        {stateQ.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            در حال بارگذاری…
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 text-start sm:px-6">
            {alreadyPublished ? (
              <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                این پروژه قبلاً در نمونه‌کارها منتشر شده است. ذخیرهٔ جدید محتوا و
                ویدیوی انتخاب‌شده را به‌روز می‌کند.
              </div>
            ) : null}

            {!selectedVideo ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="leading-6">
                  ویدیویی انتخاب نشده است. دیالوگ را ببندید و یک ویدیو را در تب
                  محصول نهایی انتخاب کنید.
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="outline" className="font-normal">
                {stateQ.data?.project.code}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={!canGenerate}
                onClick={requestGenerate}
              >
                {generateMut.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-brand" />
                )}
                Generate with AI
              </Button>
            </div>

            {confirmOverwrite ? (
              <div
                role="alertdialog"
                className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm"
              >
                <p className="leading-6">
                  محتوای فعلی با نسخهٔ جدید هوش مصنوعی جایگزین می‌شود. ادامه
                  می‌دهید؟
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="brand"
                    disabled={busy}
                    onClick={() => generateMut.mutate()}
                  >
                    جایگزینی
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setConfirmOverwrite(false)}
                  >
                    انصراف
                  </Button>
                </div>
              </div>
            ) : null}

            {generateMut.isPending ? (
              <div
                className="flex items-center gap-2 rounded-lg border border-dashed border-brand/30 bg-brand/5 px-3 py-2 text-sm text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand" />
                در حال تولید محتوا با هوش مصنوعی…
              </div>
            ) : null}

            {generateError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 space-y-2">
                  <p className="leading-6">{generateError}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={!canGenerate}
                    onClick={requestGenerate}
                  >
                    تلاش دوباره
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="portfolio-title">عنوان</Label>
              <Input
                id="portfolio-title"
                value={title}
                disabled={busy}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (confirmPublish) setConfirmPublish(false);
                  if (confirmOverwrite) setConfirmOverwrite(false);
                }}
                placeholder="عنوان جذاب برای نمایش عمومی"
                maxLength={120}
              />
              <p className="text-[11px] text-muted-foreground">
                حداقل ۳ کاراکتر · {title.trim().length}/120
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="portfolio-description">توضیحات کوتاه</Label>
              <Textarea
                id="portfolio-description"
                rows={4}
                value={description}
                disabled={busy}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (confirmPublish) setConfirmPublish(false);
                  if (confirmOverwrite) setConfirmOverwrite(false);
                }}
                placeholder="توضیح کوتاه برای کارت نمونه‌کار…"
                maxLength={2000}
              />
              <p className="text-[11px] text-muted-foreground">
                حداقل ۲۰ کاراکتر · {description.trim().length}/2000
              </p>
            </div>

            <section
              className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3 sm:p-4"
              aria-labelledby="success-story-label"
            >
              <Label id="success-story-label" htmlFor="portfolio-success-story">
                داستان موفقیت
              </Label>

              <Textarea
                id="portfolio-success-story"
                rows={10}
                value={successStory}
                disabled={busy}
                onChange={(e) => {
                  setSuccessStory(e.target.value);
                  if (confirmOverwrite) setConfirmOverwrite(false);
                  if (confirmPublish) setConfirmPublish(false);
                }}
                placeholder="داستان موفقیت را اینجا بنویسید یا با هوش مصنوعی تولید کنید…"
                maxLength={SUCCESS_STORY_MAX}
                className="min-h-[11rem] bg-background"
              />
              <p className="text-[11px] text-muted-foreground">
                اختیاری · قابل ویرایش قبل از ارسال · {successStory.trim().length}/
                {SUCCESS_STORY_MAX}
              </p>
            </section>
          </div>
        )}

        <DialogFooter className="shrink-0 gap-2 border-t px-4 py-3 sm:justify-start sm:px-6">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (confirmPublish) {
                setConfirmPublish(false);
                return;
              }
              onOpenChange(false);
            }}
          >
            {confirmPublish ? "بازگشت" : "انصراف"}
          </Button>
          <Button
            variant="brand"
            className="gap-2"
            disabled={!canPublish}
            onClick={requestPublish}
          >
            {publishMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {confirmPublish
              ? "تأیید و ارسال"
              : alreadyPublished
                ? "به‌روزرسانی نمونه‌کار"
                : "ارسال به نمونه‌کارها"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
