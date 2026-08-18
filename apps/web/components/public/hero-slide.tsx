"use client";

import { heroImageSrc, type HeroSlide } from "@/lib/hero";
import { cn } from "@/lib/utils";

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

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden transition-opacity duration-700 ease-out motion-reduce:transition-none",
        active ? "z-[1] opacity-100" : "z-0 opacity-0",
        !active && "pointer-events-none",
      )}
      aria-hidden={!active}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={active ? alt : ""}
          width={1920}
          height={1080}
          decoding="async"
          fetchPriority={priority ? "high" : "low"}
          loading={priority ? "eager" : "lazy"}
          className={cn(
            "hero-slide-visual absolute inset-0 h-full w-full object-cover object-center",
            animate && active && "hero-slide-visual-active",
          )}
          sizes="100vw"
        />
      ) : (
        <div className="absolute inset-0 bg-muted" />
      )}

      <div
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={{
          background:
            "linear-gradient(to left, hsl(220 22% 6% / 0.66) 0%, hsl(220 22% 6% / 0.32) 36%, hsl(220 22% 6% / 0.1) 58%, transparent 80%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 lg:hidden"
        style={{
          background:
            "linear-gradient(to top, hsl(220 22% 6% / 0.7) 0%, hsl(220 22% 6% / 0.3) 28%, hsl(220 22% 6% / 0.08) 50%, transparent 72%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/50 to-transparent sm:h-36"
        aria-hidden
      />

      <div
        className={cn(
          "relative z-[1] mx-auto flex h-full max-w-7xl items-end px-4 sm:px-6 lg:items-center lg:px-8",
          compact ? "py-8" : "py-16 pb-24 sm:py-20 sm:pb-24 lg:py-0 lg:pb-28",
        )}
      >
        <div className={cn("relative max-w-xl lg:max-w-[36rem]", compact && "max-w-lg")}>
          <div
            className="pointer-events-none absolute -inset-x-5 -inset-y-6 -z-10 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,rgb(0_0_0_/_0.42)_0%,rgb(0_0_0_/_0.16)_46%,transparent_74%)] sm:-inset-x-8 sm:-inset-y-8"
            aria-hidden
          />
          <div
            key={active ? slide.id : undefined}
            className={cn(
              "hero-slide-copy",
              animate && active && "hero-slide-copy-active",
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
                    className="hero-slide-copy-title text-balance text-[1.75rem] font-bold leading-[1.3] tracking-tight sm:text-4xl lg:text-[2.85rem] lg:leading-[1.2]"
                  >
                    {slide.title}
                  </h1>
                )}
                {slide.description ? (
                  <p
                    className={cn(
                      "hero-slide-copy-body mt-4 max-w-lg text-pretty leading-8",
                      compact ? "text-sm" : "text-sm sm:text-base sm:leading-8",
                    )}
                  >
                    {slide.description}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
