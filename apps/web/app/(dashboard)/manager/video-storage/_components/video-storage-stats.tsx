"use client";

import type { VideoStorageStats } from "./types";

const CARDS: Array<{
  key: keyof VideoStorageStats;
  label: string;
  hint: string;
}> = [
  { key: "total", label: "کل ویدیوها", hint: "همه موارد قابل مشاهده" },
  { key: "inPortfolio", label: "در نمونه‌کارها", hint: "هنوز منتشر نشده" },
  { key: "published", label: "منتشر در وبسایت", hint: "قابل مشاهده عمومی" },
];

export function VideoStorageStatsBar({
  stats,
  loading,
}: {
  stats?: VideoStorageStats | null;
  loading?: boolean;
}) {
  return (
    <div dir="rtl" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {CARDS.map((card) => (
        <div
          key={card.key}
          className="rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm"
        >
          <p className="text-xs text-muted-foreground">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">
            {loading ? "…" : (stats?.[card.key] ?? 0)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{card.hint}</p>
        </div>
      ))}
    </div>
  );
}
