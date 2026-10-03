"use client";

import type { ReactNode } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { LandingMediaUploader } from "@/components/landing/landing-media-uploader";
import { cn } from "@/lib/utils";
import type { LandingImageGuide } from "@/lib/landing-image-guide";

type MediaChange = { key: string | null; url: string | null };

export function ResponsiveImageFields({
  desktopSrc,
  desktopKey,
  mobileSrc,
  mobileKey,
  onDesktopChange,
  onMobileChange,
  guide,
  compact = false,
  className,
}: {
  desktopSrc: string | null;
  desktopKey: string | null;
  mobileSrc: string | null;
  mobileKey: string | null;
  onDesktopChange: (next: MediaChange) => void;
  onMobileChange: (next: MediaChange) => void;
  /** Accurate recommended sizes for this image slot. */
  guide?: LandingImageGuide | null;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2.5", className)} dir="rtl">
      <ImageSlot
        compact={compact}
        icon={<Monitor className="h-3.5 w-3.5" />}
        title="دسکتاپ"
        subtitle={compact ? undefined : "صفحات بزرگ، از ۱۰۲۴ پیکسل به بالا"}
        hint="آپلود تصویر دسکتاپ"
        src={desktopSrc}
        storageKey={desktopKey}
        onChange={onDesktopChange}
        imageGuide={guide?.desktop}
      />

      <ImageSlot
        compact={compact}
        icon={<Smartphone className="h-3.5 w-3.5" />}
        title="موبایل و تبلت"
        subtitle={
          compact
            ? "کمتر از ۱۰۲۴ پیکسل — در صورت خالی، تصویر دسکتاپ"
            : "صفحات کوچک، کمتر از ۱۰۲۴ پیکسل"
        }
        hint="آپلود تصویر موبایل"
        src={mobileSrc}
        storageKey={mobileKey}
        onChange={onMobileChange}
        imageGuide={guide?.mobile}
      />
    </div>
  );
}

function ImageSlot({
  icon,
  title,
  subtitle,
  hint,
  src,
  storageKey,
  onChange,
  imageGuide,
  compact,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  hint: string;
  src: string | null;
  storageKey: string | null;
  onChange: (next: MediaChange) => void;
  imageGuide?: LandingImageGuide["desktop"] | null;
  compact?: boolean;
}) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-border/60 bg-card/60">
      <div className="flex items-start gap-2 border-b border-border/40 px-2.5 py-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-semibold text-foreground",
              compact ? "text-[11px]" : "text-xs",
            )}
          >
            {title}
          </p>
          {subtitle ? (
            <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      <div className="w-full p-2.5">
        <LandingMediaUploader
          kind="image"
          hint={hint}
          src={src}
          storageKey={storageKey}
          onChange={onChange}
          imageGuide={imageGuide}
          compact={compact}
        />
      </div>
    </div>
  );
}
