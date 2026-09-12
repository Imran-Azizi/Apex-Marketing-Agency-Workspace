"use client";

import { Button } from "@/components/ui/button";
import { CoverImage } from "@/components/media/cover-image";
import { scrollToSection } from "@/components/public/use-active-section";
import {
  HERO_BUTTON_EXTERNAL,
  HERO_IMAGE_SIZES,
  heroImageSrc,
  heroSlideHasButton,
  type HeroSlide,
} from "@/lib/hero";
import { cn } from "@/lib/utils";

function handleHeroButtonClick(slide: HeroSlide) {
  if (!heroSlideHasButton(slide)) return;
  const destination = String(slide.buttonDestination || "");
  if (destination === HERO_BUTTON_EXTERNAL) {
    const url = String(slide.buttonUrl || "").trim();
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  scrollToSection(destination);
}

export function HeroSlideView({
  slide,
  active = true,
  priority = false,
  animate = true,
  compact = false,
}: {
  slide: HeroSlide;
  active?: boolean;
  priority?: boolean;
  animate?: boolean;
  compact?: boolean;
}) {
  const src = heroImageSrc(slide);
  const alt = slide.altText || slide.title;
  const showButton = !compact && active && heroSlideHasButton(slide);

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden transition-opacity duration-700 ease-out motion-reduce:transition-none",
        active ? "z-[1] opacity-100" : "z-0 opacity-0",
        !active && "pointer-events-none",
      )}
      aria-hidden={!active}
    >
      <div className="absolute inset-0 overflow-hidden bg-[hsl(220_22%_8%)]">
        {src ? (
          <CoverImage
            src={src}
            alt={active ? alt : ""}
            sizes={HERO_IMAGE_SIZES}
            priority={priority}
            quality={85}
            className={cn(
              // Fill the 16:9 stage edge-to-edge (no pillarboxing).
              "hero-slide-visual object-cover object-center",
              animate && active && !priority && "hero-slide-visual-active",
            )}
            fallback={<div className="absolute inset-0 bg-muted" />}
          />
        ) : (
          <div className="absolute inset-0 bg-muted" />
        )}
      </div>

      <div
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={{
          background:
            "linear-gradient(to left, hsl(220 22% 6% / 0.7) 0%, hsl(220 22% 6% / 0.38) 34%, hsl(220 22% 6% / 0.12) 56%, transparent 78%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 lg:hidden"
        style={{
          background:
            "linear-gradient(to top, hsl(220 22% 6% / 0.78) 0%, hsl(220 22% 6% / 0.4) 30%, hsl(220 22% 6% / 0.12) 52%, transparent 72%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent sm:h-32 lg:h-36"
        aria-hidden
      />

      <div
        className={cn(
          "relative z-[1] mx-auto flex h-full w-full max-w-7xl items-end px-4 sm:px-6 lg:items-center lg:px-8",
          compact
            ? "py-8"
            : "pb-[4.25rem] pt-12 sm:pb-20 sm:pt-16 lg:items-center lg:py-0 lg:pb-24",
        )}
      >
        <div
          className={cn(
            "relative min-w-0 max-w-xl lg:max-w-[38rem]",
            compact && "max-w-lg",
          )}
        >
          <div
            className="pointer-events-none absolute -inset-x-4 -inset-y-4 -z-10 rounded-[1.75rem] bg-[radial-gradient(ellipse_at_center,rgb(0_0_0_/_0.48)_0%,rgb(0_0_0_/_0.18)_46%,transparent_74%)] sm:-inset-x-8 sm:-inset-y-8 sm:rounded-[2rem]"
            aria-hidden
          />
          <div
            key={active ? slide.id : undefined}
            className={cn(
              "hero-slide-copy",
              animate && active && !priority && "hero-slide-copy-active",
            )}
          >
            {active ? (
              <>
                {compact ? (
                  <p className="hero-slide-copy-title text-balance text-2xl font-bold leading-snug tracking-tight sm:text-3xl">
                    {slide.title}
                  </p>
                ) : (
                  <h1
                    id="hero-heading"
                    className="hero-slide-copy-title text-balance text-[1.5rem] font-extrabold leading-[1.3] tracking-tight sm:text-[2.25rem] sm:leading-[1.22] lg:text-[3rem] lg:leading-[1.15]"
                  >
                    {slide.title}
                  </h1>
                )}
                {slide.description ? (
                  <p
                    className={cn(
                      "hero-slide-copy-body mt-3 max-w-lg text-pretty sm:mt-4",
                      compact
                        ? "text-sm leading-7"
                        : "line-clamp-3 text-[0.9375rem] font-medium leading-7 sm:line-clamp-4 sm:text-[1.0625rem] sm:leading-8 lg:line-clamp-none",
                    )}
                  >
                    {slide.description}
                  </p>
                ) : null}
                {showButton ? (
                  <div className="hero-slide-copy-cta mt-5 sm:mt-6">
                    <Button
                      type="button"
                      variant="brand"
                      size="lg"
                      className="h-11 rounded-xl px-6 text-sm font-semibold shadow-lg shadow-black/25 sm:h-12 sm:px-7 sm:text-base"
                      onClick={() => handleHeroButtonClick(slide)}
                    >
                      {slide.buttonText}
                    </Button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
