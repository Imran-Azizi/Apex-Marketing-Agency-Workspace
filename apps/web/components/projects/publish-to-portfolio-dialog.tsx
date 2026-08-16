"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, Send, CheckCircle2 } from "lucide-react";
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

export type ProjectPortfolioState = {
  project: {
    id: string;
    code: string;
    title: string;
    status: string;
    completedAt: string | null;
  };
  canPublish: boolean;
  videos: Array<{
    id: string;
    name: string;
    kind: string;
    videoType: string | null;
    status: string;
    version: number;
  }>;
  portfolio: {
    id: string;
    title: string;
    description: string;
    slug: string;
    status: string;
    publishedAt: string | null;
    videoFileId: string;
  } | null;
};

type PublishToPortfolioDialogProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ProjectPortfolioState | null;
};

export function PublishToPortfolioDialog({
  projectId,
  open,
  onOpenChange,
  initial,
}: PublishToPortfolioDialogProps) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const stateQ = useQuery({
    queryKey: ["portfolio-project", projectId],
    queryFn: () =>
      apiGet<ProjectPortfolioState>(`/portfolio/projects/${projectId}`),
    enabled: open && !!projectId,
    initialData: initial ?? undefined,
  });

  useEffect(() => {
    if (!open) return;
    const existing = stateQ.data?.portfolio;
    if (existing) {
      setTitle(existing.title || "");
      setDescription(existing.description || "");
    } else if (!title && !description) {
      setTitle("");
      setDescription("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when dialog opens / data arrives
  }, [open, stateQ.data?.portfolio?.id]);

  const generateMut = useMutation({
    mutationFn: () =>
      apiPost<{ title: string; description: string }>(
        `/portfolio/projects/${projectId}/generate`,
        {},
      ),
    onSuccess: (data) => {
      setTitle(data.title || "");
      setDescription(data.description || "");
      toast.success("عنوان و توضیحات با هوش مصنوعی تولید شد");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "تولید محتوا با هوش مصنوعی ناموفق بود",
      ),
  });

  const publishMut = useMutation({
    mutationFn: () =>
      apiPost(`/portfolio/projects/${projectId}/publish`, {
        title: title.trim(),
        description: description.trim(),
      }),
    onSuccess: () => {
      toast.success("پروژه با موفقیت به نمونه‌کارها ارسال شد");
      qc.invalidateQueries({ queryKey: ["portfolio-project", projectId] });
      qc.invalidateQueries({ queryKey: ["portfolio-admin"] });
      qc.invalidateQueries({ queryKey: ["public-portfolio"] });
      onOpenChange(false);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "انتشار نمونه‌کار ناموفق بود"),
  });

  const titleOk = title.trim().length >= 3;
  const descOk = description.trim().length >= 20;
  const busy = generateMut.isPending || publishMut.isPending;
  const alreadyPublished = stateQ.data?.portfolio?.status === "PUBLISHED";

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="text-start sm:max-w-lg" dir="rtl">
        <DialogHeader className="text-start sm:text-start">
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-brand" />
            ارسال به نمونه‌کارها
          </DialogTitle>
          <DialogDescription className="leading-6">
            عنوان و توضیحاتی حرفه‌ای برای نمایش عمومی این پروژه بنویسید. می‌توانید
            از هوش مصنوعی کمک بگیرید و قبل از انتشار ویرایش کنید.
          </DialogDescription>
        </DialogHeader>

        {stateQ.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            در حال بارگذاری…
          </div>
        ) : (
          <div className="space-y-4">
            {alreadyPublished ? (
              <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                این پروژه قبلاً در نمونه‌کارها منتشر شده است. ذخیرهٔ جدید محتوا را
                به‌روز می‌کند.
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
                disabled={busy || !stateQ.data?.canPublish}
                onClick={() => generateMut.mutate()}
              >
                {generateMut.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-brand" />
                )}
                Generate with AI
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="portfolio-title">عنوان</Label>
              <Input
                id="portfolio-title"
                value={title}
                disabled={busy}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="عنوان جذاب برای نمایش عمومی"
                maxLength={120}
              />
              <p className="text-[11px] text-muted-foreground">
                حداقل ۳ کاراکتر · {title.trim().length}/120
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="portfolio-description">توضیحات</Label>
              <Textarea
                id="portfolio-description"
                rows={5}
                value={description}
                disabled={busy}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="توضیح کوتاه و حرفه‌ای درباره این نمونه‌کار…"
                maxLength={2000}
              />
              <p className="text-[11px] text-muted-foreground">
                حداقل ۲۰ کاراکتر · {description.trim().length}/2000
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            انصراف
          </Button>
          <Button
            variant="brand"
            className="gap-2"
            disabled={busy || !titleOk || !descOk || !stateQ.data?.canPublish}
            onClick={() => publishMut.mutate()}
          >
            {publishMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {alreadyPublished ? "به‌روزرسانی نمونه‌کار" : "ارسال به نمونه‌کارها"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
