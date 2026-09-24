"use client";

import Link from "next/link";
import { CoverImage } from "@/components/media/cover-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LandingHero } from "@/lib/landing-content";

export function LandingHeroView({
  hero,
  selected = false,
  onSelect,
}: {
  hero: LandingHero;
  selected?: boolean;
  onSelect?: () => void;
}) {
  if (!hero.enabled && !onSelect) return null;

  const align =
    hero.textAlign === "left"
      ? "items-start text-start"
      : hero.textAlign === "right"
        ? "items-end text-end"
        : "items-center text-center";

  const inner = (
    <section
      className={cn(
        "relative isolate w-full max-w-full overflow-hidden",
        !hero.enabled && "opacity-60",
        selected && "ring-2 ring-brand ring-offset-2 ring-offset-background",
        onSelect && "cursor-pointer",
      )}
      style={{ minHeight: hero.minHeight || "70vh" }}
      onClick={onSelect}
    >
      <div className="absolute inset-0">
        {hero.backgroundVideoSrc ? (
          <video
            className="h-full w-full object-cover"
            src={hero.backgroundVideoSrc}
            poster={hero.backgroundVideoPosterSrc || hero.backgroundImageSrc || undefined}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : hero.backgroundImageSrc ? (
          <CoverImage
            src={hero.backgroundImageSrc}
            alt=""
            sizes="100vw"
            priority
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-brand/40" />
        )}
      </div>
      {hero.overlay ? (
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: hero.overlayOpacity ?? 0.45 }}
        />
      ) : null}
      <div
        className={cn(
          "relative z-10 mx-auto flex w-full max-w-5xl flex-col justify-center gap-4 px-4 py-16 sm:px-6 sm:py-24",
          align,
        )}
        style={{ minHeight: "inherit" }}
      >
        <style>{`@media (max-width: 767px) { .landing-hero-mobile { min-height: ${hero.mobileMinHeight || "55vh"} !important; } }`}</style>
        {hero.heading ? (
          <h1 className="max-w-4xl text-balance break-words text-3xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
            {hero.heading}
          </h1>
        ) : (
          <p className="text-lg text-white/70">عنوان بنر را وارد کنید</p>
        )}
        {hero.description ? (
          <p className="max-w-2xl whitespace-pre-wrap break-words text-pretty text-sm leading-7 text-white/85 sm:text-lg sm:leading-8">
            {hero.description}
          </p>
        ) : null}
        {hero.ctaText ? (
          <div>
            <Button asChild variant="brand" className="rounded-full px-6">
              <Link
                href={hero.ctaUrl || "#contact"}
                target={hero.ctaOpenInNewTab ? "_blank" : undefined}
                rel={hero.ctaOpenInNewTab ? "noopener noreferrer" : undefined}
              >
                {hero.ctaText}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );

  return <div className="landing-hero-mobile w-full max-w-full overflow-hidden">{inner}</div>;
}
