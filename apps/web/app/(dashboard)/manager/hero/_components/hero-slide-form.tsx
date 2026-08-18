"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiPatch, apiPost, ensureCsrf } from "@/lib/api";
import {
  DEFAULT_HERO_DURATION_SECONDS,
  HERO_DURATION_OPTIONS,
  normalizeHeroDurationSeconds,
  type HeroSlide,
} from "@/lib/hero";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HeroSlideUploader } from "./hero-slide-uploader";

type FormState = {
  title: string;
  description: string;
  durationSeconds: string;
  sortOrder: string;
  isPublished: boolean;
  imageKey: string | null;
  imageUrl: string | null;
};

function emptyForm(): FormState {
  return {
    title: "",
    description: "",
    durationSeconds: String(DEFAULT_HERO_DURATION_SECONDS),
    sortOrder: "",
    isPublished: true,
    imageKey: null,
    imageUrl: null,
  };
}

function fromSlide(slide: HeroSlide): FormState {
  return {
    title: slide.title || "",
    description: slide.description || "",
    durationSeconds: String(
      normalizeHeroDurationSeconds(slide.durationSeconds),
    ),
    sortOrder: String(slide.sortOrder ?? ""),
    isPublished: slide.isPublished ?? true,
    imageKey: slide.imageKey || null,
    imageUrl: slide.imageUrl || null,
  };
}

export function HeroSlideForm({
  open,
  onOpenChange,
  slide,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slide: HeroSlide | null;
  onSaved: () => void;
}) {
  const editing = !!slide;
  const [form, setForm] = useState<FormState>(emptyForm());

  useEffect(() => {
    if (!open) return;
    setForm(slide ? fromSlide(slide) : emptyForm());
  }, [open, slide]);

  const saveMut = useMutation({
    mutationFn: async () => {
      await ensureCsrf();
      const title = form.title.trim();
      if (title.length < 2) throw new Error("عنوان اسلاید الزامی است");
      if (!form.imageKey) throw new Error("تصویر اسلاید الزامی است");
      const payload = {
        title,
        description: form.description.trim() || null,
        imageKey: form.imageKey,
        durationSeconds: normalizeHeroDurationSeconds(
          Number(form.durationSeconds),
        ),
        sortOrder: form.sortOrder.trim() ? Number(form.sortOrder) : undefined,
        isPublished: form.isPublished,
      };
      if (editing && slide) {
        return apiPatch<HeroSlide>(`/hero/${slide.id}`, payload);
      }
      return apiPost<HeroSlide>("/hero", payload);
    },
    onSuccess: () => {
      toast.success(editing ? "اسلاید به‌روزرسانی شد" : "اسلاید ایجاد شد");
      onOpenChange(false);
      onSaved();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "ذخیره اسلاید ناموفق بود"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto text-start sm:max-w-xl"
        dir="rtl"
      >
        <DialogHeader className="text-start sm:text-start">
          <DialogTitle>
            {editing ? "ویرایش اسلاید" : "افزودن اسلاید"}
          </DialogTitle>
          <DialogDescription className="leading-6">
            تصویر و محتوای اسلاید را وارد کنید. فقط اسلایدهای فعال در وب‌سایت
            عمومی نمایش داده می‌شوند.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>تصویر اسلاید</Label>
            <HeroSlideUploader
              imageKey={form.imageKey}
              imageUrl={form.imageUrl}
              disabled={saveMut.isPending}
              onChange={({ imageKey, imageUrl }) =>
                setForm((p) => ({ ...p, imageKey, imageUrl }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hero-title">عنوان</Label>
            <Input
              id="hero-title"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="مثال: تبلیغات ویدیویی حرفه‌ای برای برندهای متمایز"
              disabled={saveMut.isPending}
              maxLength={160}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hero-desc">توضیحات</Label>
            <Textarea
              id="hero-desc"
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              placeholder="توضیح کوتاه و حرفه‌ای…"
              disabled={saveMut.isPending}
              maxLength={600}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hero-duration">مدت نمایش</Label>
              <Select
                value={form.durationSeconds}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, durationSeconds: v }))
                }
                disabled={saveMut.isPending}
              >
                <SelectTrigger id="hero-duration" dir="rtl" className="w-full">
                  <SelectValue placeholder="انتخاب مدت نمایش" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {HERO_DURATION_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={String(item.value)}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hero-order">ترتیب نمایش</Label>
              <Input
                id="hero-order"
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

          <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
            <Checkbox
              id="hero-published"
              checked={form.isPublished}
              onCheckedChange={(v) =>
                setForm((p) => ({ ...p, isPublished: v === true }))
              }
              disabled={saveMut.isPending}
            />
            <div className="space-y-1">
              <Label htmlFor="hero-published" className="text-sm font-medium">
                فعال در وب‌سایت عمومی
              </Label>
              <p className="text-xs leading-5 text-muted-foreground">
                در صورت غیرفعال بودن، اسلاید فقط در پنل مدیریت دیده می‌شود.
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
            disabled={saveMut.isPending || !form.imageKey}
            onClick={() => saveMut.mutate()}
            className="gap-2"
          >
            {saveMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {editing ? "ذخیره تغییرات" : "ایجاد اسلاید"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
