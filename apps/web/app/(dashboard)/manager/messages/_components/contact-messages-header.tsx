import { Mail } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";
import { formatCount } from "./types";

export function ContactMessagesHeader({
  unreadCount,
}: {
  unreadCount: number;
}) {
  return (
    <PageHeader
      inline
      title="پیام‌های تماس"
      subtitle="مدیریت و پیگیری پیام‌های ارسال‌شده توسط مشتریان از وب‌سایت عمومی"
      subtitleClassName="hidden sm:block"
      className="mb-0 sm:mb-0"
      actions={
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold shadow-sm sm:gap-2 sm:px-3 sm:text-xs",
            unreadCount > 0
              ? "border-brand/25 bg-brand/10 text-brand"
              : "border-border/80 bg-muted/50 text-muted-foreground",
          )}
          aria-live="polite"
        >
          <Mail className="h-3.5 w-3.5" aria-hidden />
          <span className="tabular-nums whitespace-nowrap">
            {unreadCount > 0
              ? `${formatCount(unreadCount)} پیام خوانده‌نشده`
              : "بدون پیام خوانده‌نشده"}
          </span>
        </span>
      }
    />
  );
}
