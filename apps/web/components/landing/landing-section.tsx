"use client";

import type { ReactNode } from "react";
import { ResponsiveCoverImage } from "@/components/landing/responsive-cover-image";
import { cn } from "@/lib/utils";
import {
  normalizeSectionSettings,
  type LandingSection,
} from "@/lib/landing-content";
import { LandingElements } from "@/components/landing/landing-elements";
import {
  sectionBackgroundStyle,
  sectionVisibilityClass,
} from "@/lib/landing-styles";

const WIDTH_CLASS = {
  default: "max-w-5xl",
  wide: "max-w-7xl",
  full: "max-w-none",
} as const;

/** Main-axis alignment inside flex-col (vertical). Cross-axis stays stretch so children keep full width in RTL. */
const VERTICAL_ALIGN_CLASS = {
  top: "justify-start",
  center: "justify-center",
  bottom: "justify-end",
} as const;

export function LandingSectionView({
  section,
  selected = false,
  onSelect,
  children,
}: {
  section: LandingSection;
  selected?: boolean;
  onSelect?: () => void;
  children?: ReactNode;
}) {
  if (section.hidden) return null;
  const settings = normalizeSectionSettings(section.settings);
  const width = WIDTH_CLASS[settings.width] || WIDTH_CLASS.default;
  const hasColumns = Array.isArray(section.columns);
  const colCount =
    section.columns?.length || (section.type === "columns-3" ? 3 : 2);
  const vis = sectionVisibilityClass(settings);
  const hasBackgroundImage = Boolean(
    settings.backgroundImageSrc || settings.mobileBackgroundImageSrc,
  );

  return (
    <section
      className={cn(
        "relative w-full max-w-full overflow-hidden",
        vis,
        selected && "ring-2 ring-brand ring-offset-2 ring-offset-background",
        onSelect && "cursor-pointer",
      )}
      style={sectionBackgroundStyle(settings)}
      onClick={onSelect}
    >
      {hasBackgroundImage ? (
        <div className="pointer-events-none absolute inset-0">
          <ResponsiveCoverImage
            desktopSrc={settings.backgroundImageSrc}
            mobileSrc={settings.mobileBackgroundImageSrc}
            alt=""
            desktopSizes="100vw"
            mobileSizes="100vw"
            className="object-cover"
          />
        </div>
      ) : null}
      {settings.backgroundOverlay && hasBackgroundImage ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundColor: settings.overlayColor || "#000000",
            opacity: settings.overlayOpacity ?? 0.4,
          }}
        />
      ) : null}
      <div
        className={cn(
          "relative mx-auto flex w-full min-w-0 flex-col items-stretch px-4 sm:px-6",
          width,
          VERTICAL_ALIGN_CLASS[settings.verticalAlign || "top"],
        )}
        style={{
          paddingTop: `clamp(2rem, ${Math.max(settings.paddingY * 0.55, 20)}px, ${settings.paddingY}px)`,
          paddingBottom: `clamp(2rem, ${Math.max(settings.paddingY * 0.55, 20)}px, ${settings.paddingY}px)`,
          paddingLeft: `clamp(1rem, ${Math.max(settings.paddingX * 0.65, 16)}px, ${settings.paddingX}px)`,
          paddingRight: `clamp(1rem, ${Math.max(settings.paddingX * 0.65, 16)}px, ${settings.paddingX}px)`,
          textAlign: settings.align,
          gap: settings.gap ? `${settings.gap}px` : undefined,
          minHeight: settings.minHeight || undefined,
        }}
      >
        {children ? (
          children
        ) : hasColumns ? (
          <div
            className={cn(
              "grid w-full gap-6",
              colCount >= 3 ? "md:grid-cols-3" : "md:grid-cols-2",
            )}
            style={{ gap: settings.gap ? `${settings.gap}px` : undefined }}
          >
            {(section.columns || []).map((col, i) => (
              <div key={i} className="min-w-0">
                <LandingElements elements={col} />
              </div>
            ))}
          </div>
        ) : (
          <LandingElements elements={section.elements || []} />
        )}
      </div>
    </section>
  );
}
