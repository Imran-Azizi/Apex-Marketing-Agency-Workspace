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
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4" dir="rtl">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.25rem] rounded-2xl sm:h-[4.75rem]" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4" dir="rtl">
      {CARDS.map((card) => {
        const Icon = card.icon;
        const value = stats[card.key];
        return (
          <div
            key={card.key}
            className="group flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card px-3 py-2.5 shadow-sm transition-all duration-200 hover:border-brand/25 hover:shadow-md sm:gap-3 sm:px-4 sm:py-3"
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border sm:h-10 sm:w-10",
                card.accent,
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 text-start">
              <p className="truncate text-[11px] font-medium text-muted-foreground">
                {card.label}
              </p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums leading-none tracking-tight text-foreground sm:text-2xl">
                {value}
              </p>
              <p className="mt-1 hidden truncate text-[11px] text-muted-foreground sm:block">
                {card.hint}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
