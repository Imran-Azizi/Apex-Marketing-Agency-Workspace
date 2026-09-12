"use client";

import { HeroSlideshow } from "@/components/public/hero-slideshow";
import { Button } from "@/components/ui/button";
import { scrollToSection } from "@/components/public/use-active-section";
import { type HeroSlide } from "@/lib/hero";

function EmptyHero() {
  return (
    <section
      id="home"
      className="relative isolate scroll-mt-20 overflow-hidden bg-background text-foreground"
      aria-labelledby="hero-heading"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="hero-orb absolute -top-28 end-[-12%] h-[26rem] w-[26rem] rounded-full bg-brand/[0.14] blur-3xl dark:bg-brand/[0.12]" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand/[0.06] via-transparent to-transparent" />
      </div>
      <div className="relative mx-auto flex min-h-[28rem] max-w-7xl items-center px-4 py-20 sm:px-6 lg:min-h-[32rem] lg:px-8">
        <div className="max-w-2xl">
          <h1
            id="hero-heading"
            className="text-balance text-3xl font-bold leading-[1.25] tracking-tight sm:text-4xl lg:text-[2.75rem]"
          >
            آژانس هوشمند بازاریابی{" "}
            <span className="text-brand">اپیکس</span>
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-8 text-muted-foreground sm:text-base">
            محتوای هیرو به‌زودی از پنل مدیریت منتشر می‌شود.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              variant="brand"
              size="lg"
              className="h-12 rounded-xl"
              onClick={() => scrollToSection("contact")}
            >
              تماس با ما
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 rounded-xl"
              onClick={() => scrollToSection("portfolio")}
            >
              مشاهده آثار
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PublicHero({
  initialSlides,
}: {
  initialSlides?: HeroSlide[] | null;
}) {
  const slides = initialSlides || [];
  if (!slides.length) return <EmptyHero />;
  return <HeroSlideshow slides={slides} />;
}
