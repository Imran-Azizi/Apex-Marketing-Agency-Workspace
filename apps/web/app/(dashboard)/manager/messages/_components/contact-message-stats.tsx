import { Inbox, Mail, MailOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContactMessageStats } from "@/lib/contact";
import { formatCount } from "./types";

const CARDS = [
  {
    key: "total" as const,
    label: "کل پیام‌ها",
    icon: Inbox,
    accent: "text-brand bg-brand/10 border-brand/25",
  },
  {
    key: "unreadCount" as const,
    label: "خوانده‌نشده",
    icon: Mail,
    accent: "text-amber-700 bg-warning/15 border-warning/25 dark:text-amber-300",
  },
  {
    key: "readCount" as const,
    label: "خوانده‌شده",
    icon: MailOpen,
    accent: "text-success bg-success/10 border-success/20",
  },
] as const;

export function ContactMessageStats({
  stats,
  loading,
}: {
  stats: ContactMessageStats;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.25rem] rounded-2xl" />
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
            className={cn(
              "group flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3",
              "shadow-sm transition-all duration-200",
              "hover:-translate-y-px hover:border-brand/25 hover:shadow-md",
            )}
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
                className="mt-0.5 text-[1.55rem] font-semibold leading-none tracking-tight tabular-nums text-foreground"
              >
                {formatCount(value)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
