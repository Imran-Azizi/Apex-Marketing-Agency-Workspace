/** Recommended export sizes for landing-page image slots (1× design viewport). */

export type LandingImageDevice = "desktop" | "mobile";

export type LandingImageSizeSpec = {
  width: number;
  height: number;
  /** Design viewport this asset is authored against (CSS px). */
  viewportWidth: number;
  /** Short English label shown in the uploader. */
  label: string;
  device: LandingImageDevice;
};

export type LandingImageGuide = {
  desktop: LandingImageSizeSpec;
  mobile: LandingImageSizeSpec;
  /** Optional note shown once above both uploaders. */
  note?: string;
};

export const LANDING_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const LANDING_IMAGE_FORMATS_LABEL = "JPG, PNG, WebP, GIF";

const DESKTOP_VIEWPORT_W = 1440;
const DESKTOP_VIEWPORT_H = 900;
const MOBILE_VIEWPORT_W = 375;
const MOBILE_VIEWPORT_H = 812;
/** Content column for default section width (`max-w-5xl` = 64rem). */
const CONTENT_WIDTH_DEFAULT = 1024;
const CONTENT_WIDTH_WIDE = 1280;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function roundSize(n: number) {
  return Math.max(1, Math.round(n));
}

/** Parse CSS lengths used in landing settings (`70vh`, `600px`, bare numbers). */
export function parseCssLengthToPx(
  value: string | null | undefined,
  axis: "width" | "height",
  viewport = {
    width: DESKTOP_VIEWPORT_W,
    height: DESKTOP_VIEWPORT_H,
  },
): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const vh = raw.match(/^([\d.]+)\s*vh$/i);
  if (vh) {
    return roundSize((Number(vh[1]) / 100) * viewport.height);
  }
  const vw = raw.match(/^([\d.]+)\s*vw$/i);
  if (vw) {
    return roundSize((Number(vw[1]) / 100) * viewport.width);
  }
  const px = raw.match(/^([\d.]+)\s*px$/i);
  if (px) return roundSize(Number(px[1]));
  if (/^[\d.]+$/.test(raw)) return roundSize(Number(raw));
  void axis;
  return null;
}

export function simplifyAspectRatio(
  width: number,
  height: number,
): { w: number; h: number; label: string } {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const g = gcd(w, h);
  let rw = w / g;
  let rh = h / g;
  // Keep labels readable for near-standard ratios.
  if (rw > 32 || rh > 32) {
    const r = w / h;
    if (Math.abs(r - 16 / 9) < 0.04) return { w: 16, h: 9, label: "16:9" };
    if (Math.abs(r - 4 / 3) < 0.04) return { w: 4, h: 3, label: "4:3" };
    if (Math.abs(r - 3 / 2) < 0.04) return { w: 3, h: 2, label: "3:2" };
    if (Math.abs(r - 1) < 0.04) return { w: 1, h: 1, label: "1:1" };
    if (Math.abs(r - 9 / 16) < 0.04) return { w: 9, h: 16, label: "9:16" };
    rw = Math.round(r * 10);
    rh = 10;
    const g2 = gcd(rw, rh);
    rw /= g2;
    rh /= g2;
  }
  return { w: rw, h: rh, label: `${rw}:${rh}` };
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function formatImageDimensions(width: number, height: number): string {
  return `${roundSize(width)} × ${roundSize(height)} px`;
}

export function aspectRatioCss(spec: Pick<LandingImageSizeSpec, "width" | "height">) {
  return `${spec.width} / ${spec.height}`;
}

export type ImageGuideMatch = {
  ok: boolean;
  uploadedWidth: number;
  uploadedHeight: number;
  recommendedWidth: number;
  recommendedHeight: number;
  aspectDelta: number;
  message: string;
};

/** Soft check — never blocks upload; returns a helpful warning when mismatched. */
export function evaluateImageGuideMatch(
  uploadedWidth: number,
  uploadedHeight: number,
  recommended: Pick<LandingImageSizeSpec, "width" | "height">,
): ImageGuideMatch {
  const recRatio = recommended.width / recommended.height;
  const upRatio = uploadedWidth / uploadedHeight;
  const aspectDelta = Math.abs(upRatio - recRatio) / recRatio;
  const tooSmall =
    uploadedWidth < recommended.width * 0.7 ||
    uploadedHeight < recommended.height * 0.7;

  let ok = aspectDelta <= 0.12 && !tooSmall;
  let message = "";
  if (aspectDelta > 0.12) {
    message =
      "This image does not match the recommended aspect ratio. Consider uploading an image with the recommended dimensions.";
  } else if (tooSmall) {
    message =
      "This image is smaller than recommended and may look soft on large screens. Consider a higher-resolution file.";
  }

  return {
    ok,
    uploadedWidth,
    uploadedHeight,
    recommendedWidth: recommended.width,
    recommendedHeight: recommended.height,
    aspectDelta,
    message,
  };
}

export function readImageNaturalSize(
  file: File,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(size.width > 0 && size.height > 0 ? size : null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function spec(
  device: LandingImageDevice,
  width: number,
  height: number,
  label: string,
  viewportWidth?: number,
): LandingImageSizeSpec {
  return {
    device,
    width: roundSize(width),
    height: roundSize(height),
    viewportWidth: viewportWidth ?? roundSize(width),
    label,
  };
}

/** Hero full-bleed background — sized to device preview viewports. */
export function heroImageGuide(hero?: {
  minHeight?: string | null;
  mobileMinHeight?: string | null;
}): LandingImageGuide {
  const desktopH =
    parseCssLengthToPx(hero?.minHeight || "70vh", "height", {
      width: DESKTOP_VIEWPORT_W,
      height: DESKTOP_VIEWPORT_H,
    }) || Math.round(DESKTOP_VIEWPORT_H * 0.7);
  const mobileH =
    parseCssLengthToPx(hero?.mobileMinHeight || "55vh", "height", {
      width: MOBILE_VIEWPORT_W,
      height: MOBILE_VIEWPORT_H,
    }) || Math.round(MOBILE_VIEWPORT_H * 0.55);

  return {
    desktop: spec(
      "desktop",
      DESKTOP_VIEWPORT_W,
      clamp(desktopH, 400, 1400),
      "Desktop (≥1024px)",
      DESKTOP_VIEWPORT_W,
    ),
    mobile: spec(
      "mobile",
      MOBILE_VIEWPORT_W,
      clamp(mobileH, 320, 1200),
      "Mobile & Tablet (<1024px)",
      MOBILE_VIEWPORT_W,
    ),
    note: "Full-bleed hero. Desktop asset ≥1024px viewport; mobile asset covers mobile (375) and tablet (768).",
  };
}

/** Section background cover (full viewport width). */
export function sectionBackgroundImageGuide(settings?: {
  minHeight?: string | null;
}): LandingImageGuide {
  const desktopH =
    parseCssLengthToPx(settings?.minHeight || "", "height", {
      width: DESKTOP_VIEWPORT_W,
      height: DESKTOP_VIEWPORT_H,
    }) || 600;
  const mobileH =
    parseCssLengthToPx(settings?.minHeight || "", "height", {
      width: MOBILE_VIEWPORT_W,
      height: MOBILE_VIEWPORT_H,
    }) || Math.round(Math.min(desktopH * 0.8, 520));

  return {
    desktop: spec(
      "desktop",
      DESKTOP_VIEWPORT_W,
      clamp(desktopH, 320, 1200),
      "Desktop (≥1024px)",
      DESKTOP_VIEWPORT_W,
    ),
    mobile: spec(
      "mobile",
      MOBILE_VIEWPORT_W,
      clamp(mobileH, 280, 1000),
      "Mobile & Tablet (<1024px)",
      MOBILE_VIEWPORT_W,
    ),
    note: "Section background — full CSS viewport width. Also prepare for tablet at 768px (same mobile asset).",
  };
}

/** Standalone image element (default 16:9 content column). */
export function contentImageGuide(options?: {
  height?: number | null;
  sectionWidth?: "default" | "wide" | "full";
}): LandingImageGuide {
  const contentW =
    options?.sectionWidth === "full"
      ? DESKTOP_VIEWPORT_W
      : options?.sectionWidth === "wide"
        ? CONTENT_WIDTH_WIDE
        : CONTENT_WIDTH_DEFAULT;
  const fixedH = options?.height && options.height > 0 ? options.height : null;
  const desktopH = fixedH ?? roundSize((contentW * 9) / 16);
  const mobileH = fixedH
    ? roundSize(fixedH * (MOBILE_VIEWPORT_W / contentW))
    : roundSize((MOBILE_VIEWPORT_W * 9) / 16);

  return {
    desktop: spec(
      "desktop",
      contentW,
      desktopH,
      "Desktop (≥1024px)",
      DESKTOP_VIEWPORT_W,
    ),
    mobile: spec(
      "mobile",
      MOBILE_VIEWPORT_W,
      mobileH,
      "Mobile & Tablet (<1024px)",
      MOBILE_VIEWPORT_W,
    ),
    note: fixedH
      ? "Sized to the element height you set in the editor."
      : "Default 16:9 content image at standard viewports (375 / 768 / 1440).",
  };
}

/** Gallery tile — 4:3 cells based on column count. */
export function galleryImageGuide(options?: {
  columns?: number | null;
  sectionWidth?: "default" | "wide" | "full";
}): LandingImageGuide {
  const cols = clamp(options?.columns || 3, 1, 4);
  const contentW =
    options?.sectionWidth === "full"
      ? DESKTOP_VIEWPORT_W
      : options?.sectionWidth === "wide"
        ? CONTENT_WIDTH_WIDE
        : CONTENT_WIDTH_DEFAULT;
  const gap = 12;
  const desktopCell = Math.floor((contentW - gap * (cols - 1)) / cols);
  const desktopH = roundSize((desktopCell * 3) / 4);
  const mobileW = MOBILE_VIEWPORT_W;
  const mobileH = roundSize((mobileW * 3) / 4);

  return {
    desktop: spec(
      "desktop",
      desktopCell,
      desktopH,
      "Desktop (≥1024px)",
      DESKTOP_VIEWPORT_W,
    ),
    mobile: spec(
      "mobile",
      mobileW,
      mobileH,
      "Mobile & Tablet (<1024px)",
      MOBILE_VIEWPORT_W,
    ),
    note: `Gallery tile at ${cols} column${cols === 1 ? "" : "s"} (4:3) — sized from the real grid cell.`,
  };
}

/** Slider / before-after / video poster — 16:9 stage. */
export function widescreenImageGuide(options?: {
  sectionWidth?: "default" | "wide" | "full";
  label?: string;
}): LandingImageGuide {
  const contentW =
    options?.sectionWidth === "full"
      ? DESKTOP_VIEWPORT_W
      : options?.sectionWidth === "wide"
        ? CONTENT_WIDTH_WIDE
        : CONTENT_WIDTH_DEFAULT;
  return {
    desktop: spec(
      "desktop",
      contentW,
      roundSize((contentW * 9) / 16),
      "Desktop (≥1024px)",
      DESKTOP_VIEWPORT_W,
    ),
    mobile: spec(
      "mobile",
      MOBILE_VIEWPORT_W,
      roundSize((MOBILE_VIEWPORT_W * 9) / 16),
      "Mobile & Tablet (<1024px)",
      MOBILE_VIEWPORT_W,
    ),
    note: options?.label || "16:9 stage matching the on-page media frame.",
  };
}

/** Team avatar — rendered at 128×128; recommend 2× for sharpness. */
export function teamAvatarImageGuide(): LandingImageGuide {
  return {
    desktop: spec("desktop", 256, 256, "Desktop (≥1024px)", DESKTOP_VIEWPORT_W),
    mobile: spec(
      "mobile",
      256,
      256,
      "Mobile & Tablet (<1024px)",
      MOBILE_VIEWPORT_W,
    ),
    note: "Circular avatar shown at 128×128. Upload a square image (256×256 or larger).",
  };
}
