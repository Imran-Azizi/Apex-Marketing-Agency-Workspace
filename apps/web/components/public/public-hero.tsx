"use client";

import { HeroSlideshow } from "@/components/public/hero-slideshow";
import { Button } from "@/components/ui/button";
import { scrollToSection } from "@/components/public/use-active-section";
import { HERO_STAGE_CLASSNAME, type HeroSlide } from "@/lib/hero";
import { cn } from "@/lib/utils";

function EmptyHero() {
  return (
    <section
      id="home"
      className="relative isolate scroll-mt-[4.25rem] overflow-hidden bg-background text-foreground"
      aria-labelledby="hero-heading"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="hero-orb absolute -top-28 end-[-12%] h-[26rem] w-[26rem] rounded-full bg-brand/[0.14] blur-3xl dark:bg-brand/[0.12]" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand/[0.06] via-transparent to-transparent" />
      </div>
      <div
        className={cn(
          HERO_STAGE_CLASSNAME,
          "relative mx-auto flex max-w-none items-center border-0 bg-transparent",
        )}
      >
        <div className="relative mx-auto flex h-full w-full max-w-7xl items-center px-4 pt-[var(--public-header-height,4.25rem)] sm:px-6 lg:px-8">
          <div className="max-w-2xl py-10 sm:py-14">
            <p
              className="hero-enter mb-3 text-sm font-medium tracking-wide text-brand"
              style={{ ["--hero-delay" as string]: "40ms" }}
            >
              آژانس هوشمند بازاریابی اپیکس
            </p>
            <h1
              id="hero-heading"
              className="hero-enter text-balance text-[1.75rem] font-extrabold leading-[1.25] tracking-tight sm:text-4xl lg:text-[3.25rem] lg:leading-[1.12]"
              style={{ ["--hero-delay" as string]: "120ms" }}
            >
              برند شما شایسته{" "}
              <span className="text-brand">محتوایی اثرگذار</span> است
            </h1>
            <p
              className="hero-enter mt-4 max-w-lg text-pretty text-sm leading-7 text-muted-foreground sm:mt-5 sm:text-base sm:leading-8"
              style={{ ["--hero-delay" as string]: "200ms" }}
            >
              از استراتژی تا تولید و انتشار؛ اپیکس پیام برندتان را واضح، جذاب و
              ماندگار به مخاطب می‌رساند — با تیمی که نتیجه را اولویت می‌دهد.
            </p>
            <div
              className="hero-enter mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row"
              style={{ ["--hero-delay" as string]: "280ms" }}
            >
              <Button
                variant="brand"
                size="lg"
                className="public-lift h-11 rounded-xl shadow-md shadow-brand/20 sm:h-12"
                onClick={() => scrollToSection("contact")}
              >
                شروع همکاری
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="public-lift h-11 rounded-xl sm:h-12"
                onClick={() => scrollToSection("portfolio")}
              >
                مشاهده نمونه‌کارها
              </Button>
            </div>
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
