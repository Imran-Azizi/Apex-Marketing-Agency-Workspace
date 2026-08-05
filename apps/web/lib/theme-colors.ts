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
  "hsl(174 72% 32%)",
  "hsl(199 89% 42%)",
  "hsl(38 92% 48%)",
  "hsl(152 60% 38%)",
  "hsl(0 72% 51%)",
  "hsl(262 52% 52%)",
  "hsl(215 16% 47%)",
  "hsl(330 70% 48%)",
];

export function getChartPalette(): string[] {
  return [1, 2, 3, 4, 5, 6, 7, 8].map((n, i) =>
    readCssVar(`--chart-${n}`, CHART_FALLBACKS[i]),
  );
}

export function getChartGridColor(): string {
  return readCssVar("--chart-grid", "hsl(214 20% 88%)");
}

export function getChartAxisColor(): string {
  return readCssVar("--chart-axis", "hsl(215 12% 42%)");
}

export function getBrandColor(): string {
  return readCssVar("--brand", "hsl(174 72% 32%)");
}
