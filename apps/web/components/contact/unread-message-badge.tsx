"use client";

import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";

export function UnreadMessageBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "absolute -top-0.5 -left-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground",
        className,
      )}
      aria-label={`${count} پیام خوانده‌نشده`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function MessageIcon({ className }: { className?: string }) {
  return <Mail className={cn("h-4 w-4", className)} aria-hidden />;
}
