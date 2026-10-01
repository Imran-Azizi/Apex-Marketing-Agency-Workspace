import type { CSSProperties } from "react";
import type {
  LandingElementStyles,
  LandingSectionSettings,
} from "@/lib/landing-content";

export function elementVisibilityClass(styles: LandingElementStyles): string {
  const classes: string[] = [];
  if (styles.hiddenOnMobile) classes.push("max-md:hidden");
  if (styles.hiddenOnTablet) classes.push("md:max-lg:hidden");
  if (styles.hiddenOnDesktop) classes.push("lg:hidden");
  return classes.join(" ");
}

/** Apply stored styles with automatic responsive constraints. */
export function elementBoxStyle(styles: LandingElementStyles): CSSProperties {
  const background = styles.backgroundGradient || styles.backgroundColor || undefined;
  return {
    fontSize: styles.fontSize ? `${styles.fontSize}px` : undefined,
    fontWeight: styles.fontWeight || undefined,
    fontFamily: styles.fontFamily || undefined,
    color: styles.color || undefined,
    textAlign: styles.align,
    lineHeight: styles.lineHeight || undefined,
    letterSpacing: styles.letterSpacing
      ? `${styles.letterSpacing}px`
      : undefined,
    marginTop: styles.marginTop ? `${styles.marginTop}px` : undefined,
    marginBottom: styles.marginBottom ? `${styles.marginBottom}px` : undefined,
    padding: styles.padding ? `${styles.padding}px` : undefined,
    width: styles.width || "100%",
    maxWidth: "100%",
    minWidth: 0,
    minHeight: styles.minHeight || undefined,
    height: "auto",
    boxSizing: "border-box",
    opacity: styles.opacity != null && styles.opacity < 1 ? styles.opacity : undefined,
    background,
    borderColor: styles.borderColor || undefined,
    borderWidth: styles.borderWidth || undefined,
    borderStyle: styles.borderWidth ? "solid" : undefined,
    borderRadius: styles.borderRadius ? `${styles.borderRadius}px` : undefined,
    boxShadow: styles.boxShadow || undefined,
    gap: styles.gap ? `${styles.gap}px` : undefined,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  };
}

export function sectionVisibilityClass(settings: LandingSectionSettings): string {
  const classes: string[] = [];
  if (settings.hiddenOnMobile) classes.push("max-md:hidden");
  if (settings.hiddenOnTablet) classes.push("md:max-lg:hidden");
  if (settings.hiddenOnDesktop) classes.push("lg:hidden");
  return classes.join(" ");
}

export function sectionBackgroundStyle(
  settings: LandingSectionSettings,
): CSSProperties {
  const style: CSSProperties = {
    backgroundColor: settings.backgroundColor || undefined,
    minHeight: settings.minHeight || undefined,
    borderRadius: settings.borderRadius
      ? `${settings.borderRadius}px`
      : undefined,
    marginTop: settings.marginY ? `${settings.marginY}px` : undefined,
    marginBottom: settings.marginY ? `${settings.marginY}px` : undefined,
  };
  if (settings.backgroundGradient) {
    style.background = settings.backgroundGradient;
  }
  return style;
}
