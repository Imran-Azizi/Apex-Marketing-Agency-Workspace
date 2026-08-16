"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ImagePlus, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { apiPatch, apiPost, ensureCsrf } from "@/lib/api";
import {
  uploadFileWithProgress,
  formatFileSize,
  UPLOAD_PURPOSE,
} from "@/lib/upload";
import type { PublicService } from "@/lib/services";
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

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type FormState = {
  name: string;
  description: string;
  startingPrice: string;
  revisionCount: string;
  sortOrder: string;
  isPublished: boolean;
  imageKey: string | null;
  imageUrl: string | null;
  ctaLabel: string;
  ctaHref: string;
  slug: string;
};

function emptyForm(): FormState {
  return {
    name: "",
    description: "",
    startingPrice: "",
    revisionCount: "2",
    sortOrder: "",
    isPublished: true,
    imageKey: null,
    imageUrl: null,
    ctaLabel: "",
    ctaHref: "",
    slug: "",
  };
}

function fromService(service: PublicService): FormState {
  return {
    name: service.name || "",
    description: service.description || "",
    startingPrice: service.startingPrice || "",
    revisionCount: String(service.revisionCount ?? 2),
    sortOrder: String(service.sortOrder ?? service.displayOrder ?? ""),
    isPublished: service.isPublished ?? service.isActive ?? true,
    imageKey: service.imageKey || null,
    imageUrl: service.imageUrl || null,
    ctaLabel: service.ctaLabel || "",
    ctaHref: service.ctaHref || "",
    slug: service.slug || "",
  };
}

export function ServiceFormDialog({
  open,
  onOpenChange,
  service,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: PublicService | null;
  onSaved: () => void;
}) {
  const editing = !!service;
  const [form, setForm] = useState<FormState>(emptyForm());
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(service ? fromService(service) : emptyForm());
    setLocalPreview(null);
    setUploadProgress(null);
  }, [open, service]);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const saveMut = useMutation({
    mutationFn: async () => {
      await ensureCsrf();
      const name = form.name.trim();
      if (name.length < 2) {
        throw new Error("عنوان خدمت الزامی است");
      }
      const payload = {
        name,
        description: form.description.trim() || null,
        startingPrice: form.startingPrice.trim()
          ? Number(form.startingPrice)
          : null,
        revisionCount: Number(form.revisionCount || 2),
        sortOrder: form.sortOrder.trim()
          ? Number(form.sortOrder)
          : undefined,
        isPublished: form.isPublished,
        imageKey: form.imageKey,
        ctaLabel: form.ctaLabel.trim() || null,
        ctaHref: form.ctaHref.trim() || null,
        slug: form.slug.trim() || null,
      };
      if (editing && service) {
        return apiPatch<PublicService>(`/services/${service.id}`, payload);
      }
      return apiPost<PublicService>("/services", payload);
    },
    onSuccess: () => {
      toast.success(editing ? "خدمت به‌روزرسانی شد" : "خدمت ایجاد شد");
      onOpenChange(false);
      onSaved();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "ذخیره خدمت ناموفق بود"),
  });

  async function handleImageFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("فقط فایل تصویری مجاز است");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("حجم تصویر نباید بیشتر از ۸ مگابایت باشد");
      return;
    }
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(URL.createObjectURL(file));
    setUploadProgress(0);
    try {
      const uploaded = await uploadFileWithProgress(
        file,
        { purpose: UPLOAD_PURPOSE.SERVICE_IMAGE },
        (pct) => setUploadProgress(pct),
      );
      setForm((prev) => ({
        ...prev,
        imageKey: uploaded.key,
        imageUrl: uploaded.url || prev.imageUrl,
      }));
      toast.success("تصویر بارگذاری شد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "آپلود تصویر ناموفق بود");
      setLocalPreview(null);
    } finally {
      setUploadProgress(null);
    }
  }

  const previewSrc = localPreview || form.imageUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto text-start sm:max-w-xl" dir="rtl">
        <DialogHeader className="text-start sm:text-start">
          <DialogTitle>
            {editing ? "ویرایش خدمت" : "ایجاد خدمت جدید"}
          </DialogTitle>
          <DialogDescription className="leading-6">
            اطلاعات کارت خدمات وب‌سایت عمومی را وارد کنید. فقط خدمات فعال در
            صفحه عمومی نمایش داده می‌شوند.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>تصویر خدمت</Label>
            <div
              className={cn(
                "relative overflow-hidden rounded-2xl border border-dashed border-border/80 bg-muted/20",
                dragOver && "border-brand bg-brand/5",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleImageFile(e.dataTransfer.files?.[0] || null);
              }}
            >
              {previewSrc ? (
                <div className="relative aspect-[16/9]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewSrc}
                    alt="پیش‌نمایش خدمت"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-2 bg-gradient-to-t from-black/60 to-transparent p-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="gap-1.5"
                      disabled={uploadProgress != null || saveMut.isPending}
                      onClick={() => inputRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      تغییر تصویر
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="gap-1.5"
                      disabled={uploadProgress != null || saveMut.isPending}
                      onClick={() => {
                        if (localPreview) URL.revokeObjectURL(localPreview);
                        setLocalPreview(null);
                        setForm((prev) => ({
                          ...prev,
                          imageKey: null,
                          imageUrl: null,
                        }));
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                      حذف
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex w-full flex-col items-center gap-2 px-4 py-10 text-center"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploadProgress != null || saveMut.isPending}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                    <ImagePlus className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium">
                    تصویر را بکشید و رها کنید یا انتخاب کنید
                  </span>
                  <span className="text-xs text-muted-foreground">
                    JPG، PNG، WEBP — حداکثر {formatFileSize(MAX_IMAGE_BYTES)}
                  </span>
                </button>
              )}
              {uploadProgress != null ? (
                <div className="absolute inset-x-4 bottom-4 rounded-full bg-background/90 p-2 shadow">
                  <div className="mb-1 flex justify-between text-[11px]">
                    <span>در حال آپلود…</span>
                    <span className="tabular-nums">{uploadProgress}٪</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand transition-[width]"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => {
                handleImageFile(e.target.files?.[0] || null);
                e.target.value = "";
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-name">عنوان خدمت</Label>
            <Input
              id="service-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="مثال: تولید ویدیوی تبلیغاتی"
              disabled={saveMut.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-desc">توضیحات</Label>
            <Textarea
              id="service-desc"
              rows={4}
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              placeholder="توضیح کوتاه و حرفه‌ای درباره این خدمت…"
              disabled={saveMut.isPending}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="service-price">قیمت شروع</Label>
              <Input
                id="service-price"
                inputMode="decimal"
                value={form.startingPrice}
                onChange={(e) =>
                  setForm((p) => ({ ...p, startingPrice: e.target.value }))
                }
                placeholder="اختیاری"
                disabled={saveMut.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-revisions">تعداد بازبینی</Label>
              <Input
                id="service-revisions"
                inputMode="numeric"
                value={form.revisionCount}
                onChange={(e) =>
                  setForm((p) => ({ ...p, revisionCount: e.target.value }))
                }
                disabled={saveMut.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-order">ترتیب نمایش</Label>
              <Input
                id="service-order"
                inputMode="numeric"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((p) => ({ ...p, sortOrder: e.target.value }))
                }
                placeholder="خودکار"
                disabled={saveMut.isPending}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="service-cta-label">متن دکمه (اختیاری)</Label>
              <Input
                id="service-cta-label"
                value={form.ctaLabel}
                onChange={(e) =>
                  setForm((p) => ({ ...p, ctaLabel: e.target.value }))
                }
                placeholder="جزئیات بیشتر"
                disabled={saveMut.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-cta-href">لینک دکمه (اختیاری)</Label>
              <Input
                id="service-cta-href"
                value={form.ctaHref}
                onChange={(e) =>
                  setForm((p) => ({ ...p, ctaHref: e.target.value }))
                }
                placeholder="/portal/login یا https://…"
                disabled={saveMut.isPending}
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
            <Checkbox
              id="service-published"
              checked={form.isPublished}
              onCheckedChange={(v) =>
                setForm((p) => ({ ...p, isPublished: v === true }))
              }
              disabled={saveMut.isPending}
            />
            <div className="space-y-1">
              <Label htmlFor="service-published" className="text-sm font-medium">
                انتشار در وب‌سایت
              </Label>
              <p className="text-xs leading-5 text-muted-foreground">
                در صورت غیرفعال بودن، فقط در پنل مدیریت دیده می‌شود.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            variant="outline"
            disabled={saveMut.isPending}
            onClick={() => onOpenChange(false)}
          >
            انصراف
          </Button>
          <Button
            variant="brand"
            disabled={saveMut.isPending || uploadProgress != null}
            onClick={() => saveMut.mutate()}
            className="gap-2"
          >
            {saveMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {editing ? "ذخیره تغییرات" : "ایجاد خدمت"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
