"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Film, ImagePlus, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiPatch, apiPost, ensureCsrf } from "@/lib/api";
import { uploadFileWithProgress, UPLOAD_PURPOSE } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PortfolioAdminCategory, PortfolioAdminItem } from "./types";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type FormState = {
  title: string;
  description: string;
  storageKey: string | null;
  thumbnailKey: string | null;
  thumbnailUrl: string | null;
  videoName: string | null;
  categoryIds: string[];
  isPublished: boolean;
  sortOrder: string;
};

function emptyForm(): FormState {
  return {
    title: "",
    description: "",
    storageKey: null,
    thumbnailKey: null,
    thumbnailUrl: null,
    videoName: null,
    categoryIds: [],
    isPublished: true,
    sortOrder: "0",
  };
}

function fromItem(item: PortfolioAdminItem): FormState {
  return {
    title: item.title,
    description: item.description || "",
    storageKey: item.storageKey,
    thumbnailKey: item.thumbnailKey,
    thumbnailUrl: item.thumbnailUrl,
    videoName: item.video?.name || item.title,
    categoryIds: item.categories.map((category) => category.id),
    isPublished: item.status === "PUBLISHED",
    sortOrder: String(item.sortOrder ?? 0),
  };
}

export function PortfolioVideoForm({
  open,
  onOpenChange,
  item,
  categories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PortfolioAdminItem | null;
  categories: PortfolioAdminCategory[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [thumbProgress, setThumbProgress] = useState<number | null>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setForm(item ? fromItem(item) : emptyForm());
  }, [open, item]);

  const saveMut = useMutation({
    mutationFn: async () => {
      await ensureCsrf();
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        thumbnailKey: form.thumbnailKey,
        categoryIds: form.categoryIds,
        status: form.isPublished ? "PUBLISHED" : "UNPUBLISHED",
        sortOrder: Number(form.sortOrder || 0),
        ...(form.storageKey ? { storageKey: form.storageKey } : {}),
      };
      if (item) {
        return apiPatch(`/portfolio/${item.id}`, payload);
      }
      if (!form.storageKey) {
        throw new Error("ویدیوی نمونه‌کار الزامی است");
      }
      return apiPost("/portfolio", payload);
    },
    onSuccess: () => {
      toast.success(item ? "نمونه‌کار به‌روزرسانی شد" : "نمونه‌کار افزوده شد");
      onSaved();
      onOpenChange(false);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "ذخیره نمونه‌کار ناموفق بود"),
  });

  async function handleVideo(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("فقط فایل ویدیویی مجاز است");
      return;
    }
    setVideoProgress(0);
    try {
      const uploaded = await uploadFileWithProgress(
        file,
        { purpose: UPLOAD_PURPOSE.PORTFOLIO_VIDEO },
        (pct) => setVideoProgress(pct),
      );
      setForm((prev) => ({
        ...prev,
        storageKey: uploaded.key,
        videoName: uploaded.name,
      }));
      toast.success("ویدیو بارگذاری شد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "آپلود ویدیو ناموفق بود");
    } finally {
      setVideoProgress(null);
    }
  }

  async function handleThumb(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("فقط فایل تصویری مجاز است");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("حجم تصویر نباید بیشتر از ۸ مگابایت باشد");
      return;
    }
    setThumbProgress(0);
    try {
      const uploaded = await uploadFileWithProgress(
        file,
        { purpose: UPLOAD_PURPOSE.PORTFOLIO_THUMBNAIL },
        (pct) => setThumbProgress(pct),
      );
      setForm((prev) => ({
        ...prev,
        thumbnailKey: uploaded.key,
        thumbnailUrl: uploaded.url || prev.thumbnailUrl,
      }));
      toast.success("تصویر بارگذاری شد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "آپلود تصویر ناموفق بود");
    } finally {
      setThumbProgress(null);
    }
  }

  const uploading = videoProgress != null || thumbProgress != null;
  const canSubmit =
    form.title.trim().length >= 3 &&
    (item ? true : Boolean(form.storageKey)) &&
    !uploading &&
    !saveMut.isPending;

  function toggleCategory(id: string, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      categoryIds: checked
        ? [...prev.categoryIds, id]
        : prev.categoryIds.filter((value) => value !== id),
    }));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saveMut.isPending && onOpenChange(next)}>
      <DialogContent
        className="flex min-h-0 max-h-[min(92dvh,100svh)] w-[calc(100%-1.25rem)] max-w-[calc(100vw-1.25rem)] flex-col gap-0 overflow-hidden p-0 text-start sm:max-w-xl"
        dir="rtl"
      >
        <DialogHeader className="shrink-0 space-y-1.5 px-4 pb-3 pt-5 pe-12 text-start sm:px-6 sm:pe-14">
          <DialogTitle>{item ? "ویرایش نمونه‌کار" : "افزودن نمونه‌کار"}</DialogTitle>
          <DialogDescription>
            ویدیو، کتگوری و وضعیت نمایش در وب‌سایت عمومی را تنظیم کنید.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 text-start sm:px-6">
          <div className="space-y-2">
            <Label htmlFor="portfolio-title">عنوان</Label>
            <Input
              id="portfolio-title"
              value={form.title}
              maxLength={120}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="portfolio-desc">توضیحات (اختیاری)</Label>
            <Textarea
              id="portfolio-desc"
              rows={3}
              maxLength={2000}
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>ویدیوی نمونه‌کار</Label>
            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <Film className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">
                    {form.videoName || form.storageKey || "ویدیویی انتخاب نشده است"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    MP4، WEBM و فرمت‌های ویدیویی مشابه
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full shrink-0 gap-1.5 sm:w-auto"
                  disabled={uploading}
                  onClick={() => videoRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {form.storageKey ? "تغییر" : "آپلود"}
                </Button>
              </div>
              {videoProgress != null ? (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[11px]">
                    <span>در حال آپلود ویدیو…</span>
                    <span className="tabular-nums">{videoProgress}٪</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand transition-[width]"
                      style={{ width: `${videoProgress}%` }}
                    />
                  </div>
                </div>
              ) : null}
              <input
                ref={videoRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="sr-only"
                onChange={(e) => {
                  void handleVideo(e.target.files?.[0] || null);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>تصویر / Thumbnail</Label>
            <div
              className={cn(
                "overflow-hidden rounded-2xl border border-dashed border-border/80 bg-muted/20",
              )}
            >
              {form.thumbnailUrl ? (
                <div className="relative aspect-video">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.thumbnailUrl}
                    alt="پیش‌نمایش تصویر"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/60 p-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={uploading}
                      onClick={() => thumbRef.current?.click()}
                    >
                      تغییر تصویر
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex w-full flex-col items-center gap-2 px-4 py-8"
                  disabled={uploading}
                  onClick={() => thumbRef.current?.click()}
                >
                  <ImagePlus className="h-5 w-5 text-brand" />
                  <span className="text-sm">تصویر ۱۶:۹ را انتخاب کنید</span>
                </button>
              )}
              {thumbProgress != null ? (
                <div className="px-4 pb-3">
                  <div className="mb-1 flex justify-between text-[11px]">
                    <span>در حال آپلود تصویر…</span>
                    <span className="tabular-nums">{thumbProgress}٪</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${thumbProgress}%` }}
                    />
                  </div>
                </div>
              ) : null}
              <input
                ref={thumbRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => {
                  void handleThumb(e.target.files?.[0] || null);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>کتگوری</Label>
            <div className="grid gap-2 rounded-xl border border-border/70 p-3 sm:grid-cols-2">
              {categories.map((category) => {
                const checked = form.categoryIds.includes(category.id);
                return (
                  <label
                    key={category.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        toggleCategory(category.id, value === true)
                      }
                    />
                    {category.name}
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              کتگوری مختلط جداگانه از بخش «مدیریت مختلط» انتخاب می‌شود.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="portfolio-order">ترتیب نمایش</Label>
              <Input
                id="portfolio-order"
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, sortOrder: e.target.value }))
                }
              />
            </div>
            <label className="flex min-h-10 items-center gap-2 text-sm">
              <Checkbox
                checked={form.isPublished}
                onCheckedChange={(value) =>
                  setForm((prev) => ({ ...prev, isPublished: value === true }))
                }
              />
              وضعیت: فعال / منتشرشده
            </label>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-start sm:px-6">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            disabled={saveMut.isPending}
            onClick={() => onOpenChange(false)}
          >
            انصراف
          </Button>
          <Button
            variant="brand"
            className="w-full gap-2 sm:w-auto"
            disabled={!canSubmit}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
