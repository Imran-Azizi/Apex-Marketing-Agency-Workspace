"use client";

import { HeroSlideView } from "@/components/public/hero-slide";
import {
  HERO_STAGE_CLASSNAME,
  heroDesktopImageSrc,
  heroDurationLabel,
  heroMobileImageSrc,
  type HeroSlide,
} from "@/lib/hero";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function HeroSlidePreview({
  slide,
  open,
  onOpenChange,
}: {
  slide: HeroSlide | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const desktopSrc = slide ? heroDesktopImageSrc(slide) : null;
  const mobileSrc = slide ? heroMobileImageSrc(slide) : null;
  const hasDedicatedMobile = Boolean(
    slide?.mobileImageKey || slide?.mobileImageUrl,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl overflow-hidden p-0 text-start sm:rounded-2xl"
        dir="rtl"
      >
        <DialogHeader className="border-b border-border/70 px-4 py-3 text-start sm:px-5">
          <DialogTitle className="text-base sm:text-lg">
            پیش‌نمایش اسلاید
          </DialogTitle>
          <DialogDescription className="text-xs leading-6 sm:text-sm">
            نمای تقریبی دسکتاپ (۱۶:۹) و موبایل (۳:۴). مدت نمایش:{" "}
            {slide ? heroDurationLabel(slide.durationSeconds) : "—"}
            {!hasDedicatedMobile ? (
              <span className="mt-1 block text-destructive">
                تصویر موبایل اختصاصی بارگذاری نشده؛ فعلاً تصویر دسکتاپ روی گوشی
                استفاده می‌شود.
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        {slide ? (
          <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-5 sm:p-5">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                دسکتاپ / تبلت
              </p>
              <div
                className={cn(
                  HERO_STAGE_CLASSNAME,
                  "!h-[min(52svh,22rem)] !min-h-[14rem] !max-h-[26rem] overflow-hidden rounded-2xl border border-border/70",
                )}
              >
                <HeroSlideView
                  slide={slide}
                  active
                  priority
                  animate={false}
                  compact
                  imageSrc={desktopSrc}
                  imageReady={Boolean(desktopSrc)}
                />
              </div>
            </div>

            <div className="mx-auto w-full max-w-[14rem] space-y-2 sm:mx-0">
              <p className="text-xs font-medium text-muted-foreground">
                موبایل
              </p>
              <div className="relative aspect-[3/4] overflow-hidden rounded-[1.35rem] border border-border/70 bg-muted shadow-sm">
                <HeroSlideView
                  slide={slide}
                  active
                  priority
                  animate={false}
                  compact
                  imageSrc={mobileSrc}
                  imageReady={Boolean(mobileSrc)}
                />
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
