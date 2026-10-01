"use client";

import { LandingMediaUploader } from "@/components/landing/landing-media-uploader";
import { cn } from "@/lib/utils";

type MediaChange = { key: string | null; url: string | null };

export function ResponsiveImageFields({
  desktopSrc,
  desktopKey,
  mobileSrc,
  mobileKey,
  onDesktopChange,
  onMobileChange,
  compact = false,
  className,
}: {
  desktopSrc: string | null;
  desktopKey: string | null;
  mobileSrc: string | null;
  mobileKey: string | null;
  onDesktopChange: (next: MediaChange) => void;
  onMobileChange: (next: MediaChange) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-2">
        <div className="space-y-0.5">
          <p
            className={cn(
              "font-semibold text-foreground",
              compact ? "text-[10px]" : "text-[11px]",
            )}
          >
            تصویر صفحه بزرگ (Desktop / Large Screen)
          </p>
          {!compact ? (
            <p className="text-[10px] leading-5 text-muted-foreground">
              در صفحات بزرگ (عرض ۱۰۲۴ پیکسل و بیشتر) نمایش داده می‌شود.
            </p>
          ) : null}
        </div>
        <LandingMediaUploader
          kind="image"
          hint="آپلود تصویر صفحه بزرگ"
          src={desktopSrc}
          storageKey={desktopKey}
          onChange={onDesktopChange}
        />
      </div>

      <div className="space-y-2 border-t border-border/50 pt-3">
        <div className="space-y-0.5">
          <p
            className={cn(
              "font-semibold text-foreground",
              compact ? "text-[10px]" : "text-[11px]",
            )}
          >
            تصویر صفحه کوچک (Mobile / Small Screen)
          </p>
          {!compact ? (
            <p className="text-[10px] leading-5 text-muted-foreground">
              در موبایل و صفحات کوچک (کمتر از ۱۰۲۴ پیکسل) نمایش داده می‌شود. اگر
              خالی باشد، تصویر صفحه بزرگ استفاده می‌شود.
            </p>
          ) : (
            <p className="text-[9px] leading-4 text-muted-foreground">
              موبایل (&lt;۱۰۲۴px) — در صورت خالی بودن، تصویر بزرگ استفاده می‌شود
            </p>
          )}
        </div>
        <LandingMediaUploader
          kind="image"
          hint="آپلود تصویر صفحه کوچک"
          src={mobileSrc}
          storageKey={mobileKey}
          onChange={onMobileChange}
        />
      </div>
    </div>
  );
}
