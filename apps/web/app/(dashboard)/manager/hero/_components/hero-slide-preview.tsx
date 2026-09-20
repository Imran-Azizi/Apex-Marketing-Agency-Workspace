"use client";

import { HeroSlideView } from "@/components/public/hero-slide";
import {
  HERO_STAGE_CLASSNAME,
  heroDurationLabel,
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl overflow-hidden p-0 text-start sm:rounded-2xl"
        dir="rtl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>پیش‌نمایش اسلاید</DialogTitle>
          <DialogDescription>
            نمای تقریبی اسلاید در وب‌سایت عمومی
          </DialogDescription>
        </DialogHeader>
        {slide ? (
          <div
            className={cn(
              HERO_STAGE_CLASSNAME,
              "!h-[min(70svh,28rem)] !min-h-[18rem] !max-h-[32rem]",
            )}
          >
            <HeroSlideView
              slide={slide}
              active
              priority
              animate={false}
              compact
            />
            <p className="absolute end-3 top-3 z-[2] rounded-full border border-border/70 bg-background/85 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm">
              مدت نمایش: {heroDurationLabel(slide.durationSeconds)}
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
