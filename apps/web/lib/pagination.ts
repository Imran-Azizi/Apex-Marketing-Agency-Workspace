/**
 * Build a compact page list for pagination UIs.
 * Examples:
 *   total=5  → [1, 2, 3, 4, 5]
 *   total=10 current=1 → [1, 2, 3, "ellipsis", 10]
 *   total=10 current=6 → [1, "ellipsis", 5, 6, 7, "ellipsis", 10]
 */
export type PageItem = number | "ellipsis";

export function buildPageItems(
  current: number,
  total: number,
  siblingCount = 1,
): PageItem[] {
  const safeTotal = Math.max(1, Math.floor(total) || 1);
  const safeCurrent = Math.min(Math.max(1, Math.floor(current) || 1), safeTotal);
  const siblings = Math.max(0, Math.floor(siblingCount) || 0);

  // Always show every page when the list stays short.
  if (safeTotal <= siblings * 2 + 5) {
    return Array.from({ length: safeTotal }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, safeTotal]);
  for (
    let page = safeCurrent - siblings;
    page <= safeCurrent + siblings;
    page += 1
  ) {
    if (page >= 1 && page <= safeTotal) pages.add(page);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const items: PageItem[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i]! - sorted[i - 1]! > 1) {
      items.push("ellipsis");
    }
    items.push(sorted[i]!);
  }
  return items;
}

export function pageRangeLabel(page: number, pageSize: number, total: number) {
  if (total <= 0) {
    return { from: 0, to: 0, total: 0 };
  }
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return { from, to, total };
}

export function formatLatnCount(value: number) {
  return value.toLocaleString("fa-AF", { numberingSystem: "latn" });
}
