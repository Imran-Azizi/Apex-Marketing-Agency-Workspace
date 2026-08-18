import { CheckCircle2, Images, Layers, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { PortfolioStats } from "./types";

const CARDS = [
  {
    key: "total" as const,
    label: "کل ویدیوها",
    hint: "همه نمونه‌کارهای ثبت‌شده",
    icon: Images,
    accent: "text-brand bg-brand/10 border-brand/25",
  },
  {
    key: "published" as const,
    label: "ویدیوهای فعال",
    hint: "منتشرشده در وب‌سایت عمومی",
    icon: CheckCircle2,
    accent: "text-success bg-success/10 border-success/20",
  },
  {
    key: "categories" as const,
    label: "کتگوری‌ها",
    hint: "دسته‌های فعال",
    icon: Layers,
    accent: "text-foreground bg-muted/60 border-border/80",
  },
  {
    key: "mixed" as const,
    label: "ویدیوهای مختلط",
    hint: "انتخاب‌شده برای کتگوری مختلط",
    icon: Sparkles,
    accent: "text-brand bg-brand/8 border-brand/20",
  },
] as const;

export function PortfolioStats({
  stats,
  loading,
}: {
  stats: PortfolioStats;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" dir="rtl">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.75rem] rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" dir="rtl">
      {CARDS.map((card) => {
        const Icon = card.icon;
        const value = stats[card.key];
        return (
          <div
            key={card.key}
            className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm transition-all duration-200 hover:border-brand/25 hover:shadow-md"
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                card.accent,
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 text-start">
              <p className="text-[11px] font-medium text-muted-foreground">
                {card.label}
              </p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums leading-none tracking-tight text-foreground">
                {value}
              </p>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {card.hint}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
