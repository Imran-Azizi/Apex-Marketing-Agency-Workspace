"use client";

import type { ReactNode } from "react";
import { CoverImage } from "@/components/media/cover-image";
import { cn } from "@/lib/utils";
import type { LandingSection } from "@/lib/landing-content";
import { LandingElements } from "@/components/landing/landing-elements";

const WIDTH_CLASS = {
  default: "max-w-5xl",
  wide: "max-w-7xl",
  full: "max-w-none",
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
  const settings = section.settings;
  const width = WIDTH_CLASS[settings.width] || WIDTH_CLASS.default;
  const hasColumns = Array.isArray(section.columns);
  const colCount = section.columns?.length || (section.type === "columns-3" ? 3 : 2);

  return (
    <section
      className={cn(
        "relative w-full max-w-full overflow-hidden",
        selected && "ring-2 ring-brand ring-offset-2 ring-offset-background",
        onSelect && "cursor-pointer",
      )}
      style={{
        backgroundColor: settings.backgroundColor || undefined,
        marginTop: settings.marginY ? `${settings.marginY}px` : undefined,
        marginBottom: settings.marginY ? `${settings.marginY}px` : undefined,
        minHeight: settings.minHeight || undefined,
        borderRadius: settings.borderRadius ? `${settings.borderRadius}px` : undefined,
      }}
      onClick={onSelect}
    >
      {settings.backgroundImageSrc ? (
        <div className="pointer-events-none absolute inset-0">
          <CoverImage
            src={settings.backgroundImageSrc}
            alt=""
            sizes="100vw"
            className="object-cover opacity-30"
          />
        </div>
      ) : null}
      <div
        className={cn("relative mx-auto w-full px-4 sm:px-6", width)}
        style={{
          paddingTop: `${settings.paddingY}px`,
          paddingBottom: `${settings.paddingY}px`,
          paddingLeft: `${settings.paddingX}px`,
          paddingRight: `${settings.paddingX}px`,
          textAlign: settings.align,
        }}
      >
        {children ? (
          children
        ) : hasColumns ? (
          <div
            className={cn(
              "grid gap-6 md:grid-cols-2",
              colCount >= 3 && "lg:grid-cols-3",
            )}
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
