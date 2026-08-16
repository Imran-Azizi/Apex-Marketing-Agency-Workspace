/**
 * Theme-aware color helpers for non-Tailwind surfaces (Recharts, canvas, etc.).
 * Reads live CSS variables so charts track light/dark mode automatically.
 */

function readCssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value ? `hsl(${value})` : fallback;
}

const CHART_FALLBACKS = [
  "hsl(46 65% 52%)",
  "hsl(217 19% 40%)",
  "hsl(215 28% 17%)",
  "hsl(152 60% 38%)",
  "hsl(0 72% 51%)",
  "hsl(38 92% 48%)",
  "hsl(218 11% 55%)",
  "hsl(45 55% 38%)",
];

export function getChartPalette(): string[] {
  return [1, 2, 3, 4, 5, 6, 7, 8].map((n, i) =>
    readCssVar(`--chart-${n}`, CHART_FALLBACKS[i]),
  );
}

export function getChartGridColor(): string {
  return readCssVar("--chart-grid", "hsl(220 13% 88%)");
}

export function getChartAxisColor(): string {
  return readCssVar("--chart-axis", "hsl(217 14% 40%)");
}

export function getBrandColor(): string {
  return readCssVar("--brand", "hsl(46 65% 52%)");
}
