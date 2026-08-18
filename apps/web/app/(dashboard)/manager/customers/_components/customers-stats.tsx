import { CheckCircle2, EyeOff, Handshake } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { CustomerStats } from "./types";

const CARDS = [
  {
    key: "total" as const,
    label: "کل مشتریان",
    hint: "همه موارد ثبت‌شده",
    icon: Handshake,
    accent: "text-brand bg-brand/10 border-brand/25",
  },
  {
    key: "published" as const,
    label: "فعال / منتشرشده",
    hint: "نمایش در وب‌سایت عمومی",
    icon: CheckCircle2,
    accent: "text-success bg-success/10 border-success/20",
  },
  {
    key: "unpublished" as const,
    label: "غیرفعال",
    hint: "مخفی از وب‌سایت عمومی",
    icon: EyeOff,
    accent: "text-muted-foreground bg-muted/60 border-border/80",
  },
] as const;

export function CustomersStats({
  stats,
  loading,
}: {
  stats: CustomerStats;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.75rem] rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
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
              <p
                className={cn(
                  "mt-0.5 font-semibold tabular-nums leading-none tracking-tight",
                  card.key === "total"
                    ? "text-[1.65rem] text-foreground"
                    : "text-2xl",
                  card.key === "published" && "text-success",
                )}
              >
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
