"use client";

import { Button } from "@/components/ui/button";
import { CoverImage } from "@/components/media/cover-image";
import { scrollToSection } from "@/components/public/use-active-section";
import {
  HERO_BUTTON_EXTERNAL,
  HERO_IMAGE_QUALITY_LAZY,
  HERO_IMAGE_QUALITY_LCP,
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
  /** Pre-resolved, preloaded display URL from the slideshow gate. */
  imageSrc,
  /** Parent confirmed this image finished loading. */
  imageReady = false,
  transitionMs = 700,
  layer = "active",
}: {
  slide: HeroSlide;
  active?: boolean;
  priority?: boolean;
  animate?: boolean;
  compact?: boolean;
  imageSrc?: string | null;
  imageReady?: boolean;
  transitionMs?: number;
  layer?: "active" | "outgoing" | "idle";
}) {
  const fallbackSrc = heroImageSrc(slide);
  const src = imageSrc !== undefined ? imageSrc : fallbackSrc;
  const alt = slide.altText || slide.title;
  const gated = imageSrc !== undefined;
  const painted =
    gated
      ? imageReady && (layer === "active" || layer === "outgoing")
      : active;
  const visible = gated ? imageReady && layer === "active" : active;
  const showButton = !compact && visible && heroSlideHasButton(slide);

  const zClass =
    layer === "active" ? "z-[2]" : layer === "outgoing" ? "z-[1]" : "z-0";

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden motion-reduce:transition-none",
        zClass,
        !painted && "pointer-events-none",
      )}
      style={{
        opacity: visible ? 1 : 0,
        transition: animate
          ? `opacity ${transitionMs}ms cubic-bezier(0.22, 1, 0.36, 1)`
          : undefined,
      }}
      aria-hidden={!visible}
    >
      {/* Visual — only painted when parent has confirmed load (gated mode). */}
      <div className="absolute inset-0 overflow-hidden">
        {gated ? (
          imageReady && src ? (
            // eslint-disable-next-line @next/next/no-img-element -- exact preloaded URL; avoids Next loader mismatch
            <img
              src={src}
              alt={visible ? alt : ""}
              className={cn(
                "hero-slide-visual absolute inset-0 h-full w-full",
                animate && visible && "hero-slide-visual-active",
              )}
              draggable={false}
              decoding="async"
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "low"}
            />
          ) : null
        ) : src ? (
          <CoverImage
            src={src}
            alt={visible ? alt : ""}
            sizes={HERO_IMAGE_SIZES}
            priority={priority}
            fadeIn={false}
            quality={priority ? HERO_IMAGE_QUALITY_LCP : HERO_IMAGE_QUALITY_LAZY}
            className={cn(
              "hero-slide-visual",
              animate && visible && "hero-slide-visual-active",
            )}
            fallback={null}
          />
        ) : null}
      </div>

      {painted ? (
        <>
          {/* Desktop RTL wash */}
          <div
            className="pointer-events-none absolute inset-0 hidden lg:block"
            style={{
              background:
                "linear-gradient(to left, hsl(220 22% 5% / 0.8) 0%, hsl(220 22% 5% / 0.5) 24%, hsl(220 22% 5% / 0.18) 44%, transparent 68%)",
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[4.5rem] bg-gradient-to-b from-black/55 via-black/18 to-transparent sm:h-20 lg:h-32"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 lg:hidden"
            style={{
              background:
                "radial-gradient(ellipse 90% 72% at 50% 46%, hsl(220 22% 4% / 0.62) 0%, hsl(220 22% 4% / 0.32) 45%, hsl(220 22% 4% / 0.1) 70%, transparent 100%)",
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-44 bg-gradient-to-t from-black/50 to-transparent lg:block"
            aria-hidden
          />

          <div
            className={cn(
              "z-[1]",
              compact
                ? "relative mx-auto flex h-full w-full max-w-7xl items-end px-4 py-8 text-start sm:px-6"
                : [
                    "hero-mobile-copy absolute",
                    "lg:relative lg:inset-auto lg:mx-auto lg:flex lg:h-full lg:w-full lg:max-w-7xl lg:items-center lg:px-8 lg:pb-28 lg:pt-[calc(var(--public-header-height,4.25rem)+0.75rem)] lg:text-start",
                    "xl:pb-32 xl:pt-[calc(var(--public-header-height,4.25rem)+1rem)]",
                  ].join(" "),
            )}
          >
            <div
              className={cn(
                "relative min-w-0",
                compact
                  ? "max-w-lg text-start"
                  : [
                      "mx-auto w-[min(92%,21.5rem)] text-center",
                      "min-[360px]:w-[min(92%,22.75rem)]",
                      "min-[375px]:w-[min(92%,23.75rem)]",
                      "min-[414px]:w-[min(92%,25.5rem)]",
                      "sm:w-[min(88%,28rem)]",
                      "md:w-[min(80%,32rem)]",
                      "lg:mx-0 lg:ms-0 lg:me-auto lg:w-full lg:max-w-[36rem] lg:pr-0 lg:text-start",
                      "xl:max-w-[40rem] 2xl:max-w-[42rem]",
                    ].join(" "),
              )}
            >
              <div
                className={cn(
                  "pointer-events-none absolute -z-10 rounded-3xl bg-[radial-gradient(ellipse_at_center,rgb(0_0_0_/_0.55)_0%,rgb(0_0_0_/_0.2)_52%,transparent_78%)]",
                  compact
                    ? "-inset-x-4 -inset-y-4"
                    : "-inset-x-3 -inset-y-3 sm:-inset-x-5 sm:-inset-y-5 lg:-inset-x-8 lg:-inset-y-8",
                )}
                aria-hidden
              />
              <div
                className={cn(
                  "hero-slide-copy",
                  animate && visible && "hero-slide-copy-active",
                )}
              >
                {compact ? (
                  <p className="hero-slide-copy-title text-balance text-2xl font-bold tracking-tight sm:text-3xl">
                    {slide.title}
                  </p>
                ) : (
                  <h1
                    id={visible ? "hero-heading" : undefined}
                    className="hero-slide-copy-title line-clamp-3 text-balance font-extrabold tracking-tight sm:line-clamp-3 lg:line-clamp-none"
                  >
                    {slide.title}
                  </h1>
                )}
                {slide.description ? (
                  <p
                    className={cn(
                      "hero-slide-copy-body text-pretty font-medium",
                      compact
                        ? "mt-2.5"
                        : "mt-2.5 line-clamp-3 min-[375px]:mt-3 sm:mt-3.5 sm:line-clamp-3 lg:mt-5 lg:line-clamp-4 lg:max-w-xl",
                    )}
                  >
                    {slide.description}
                  </p>
                ) : null}
                {heroSlideHasButton(slide) ? (
                  <div
                    className={cn(
                      "hero-slide-copy-cta mt-3.5 flex justify-center sm:mt-5 lg:mt-8 lg:justify-start",
                      showButton ? "pointer-events-auto" : "pointer-events-none",
                    )}
                  >
                    <Button
                      type="button"
                      variant="brand"
                      size="lg"
                      tabIndex={showButton ? 0 : -1}
                      className="h-11 max-w-full rounded-xl px-5 text-sm font-semibold shadow-lg shadow-black/35 min-[375px]:h-12 min-[375px]:min-w-[10.25rem] min-[375px]:px-6 sm:min-w-[11rem] sm:px-7 sm:text-base lg:min-w-[12rem] lg:px-8"
                      onClick={() => handleHeroButtonClick(slide)}
                    >
                      {slide.buttonText}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
