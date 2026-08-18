"use client";

import { HeroSlideView } from "@/components/public/hero-slide";
import { heroDurationLabel, type HeroSlide } from "@/lib/hero";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
          <div className="relative aspect-[16/9] min-h-[18rem] w-full overflow-hidden bg-background">
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
