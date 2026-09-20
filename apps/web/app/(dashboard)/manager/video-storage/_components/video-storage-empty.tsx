"use client";

import { Film, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function VideoStorageEmptyState({
  hasFilters,
  canUpload,
  onUpload,
  onClearFilters,
}: {
  hasFilters?: boolean;
  canUpload?: boolean;
  onUpload?: () => void;
  onClearFilters?: () => void;
}) {
  return (
    <div
      dir="rtl"
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-16 text-center"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Film className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold">
        {hasFilters ? "نتیجه‌ای یافت نشد" : "هنوز ویدیویی آپلود نشده است"}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {hasFilters
          ? "فیلترها یا عبارت جستجو را تغییر دهید."
          : "ویدیوهای شرکت را اینجا ذخیره کنید و پس از بررسی به نمونه‌کارها بفرستید."}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {hasFilters && onClearFilters ? (
          <Button variant="outline" className="rounded-xl" onClick={onClearFilters}>
            پاک کردن فیلترها
          </Button>
        ) : null}
        {!hasFilters && canUpload && onUpload ? (
          <Button variant="brand" className="rounded-xl gap-1.5" onClick={onUpload}>
            <Upload className="h-4 w-4" />
            آپلود اولین ویدیو
          </Button>
        ) : null}
      </div>
    </div>
  );
}
