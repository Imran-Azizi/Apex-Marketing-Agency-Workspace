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
      title="پیام‌های تماس"
      subtitle="مدیریت و پیگیری پیام‌های ارسال‌شده توسط مشتریان از وب‌سایت عمومی"
      className="mb-0 sm:mb-0"
      actions={
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm",
            unreadCount > 0
              ? "border-brand/25 bg-brand/10 text-brand"
              : "border-border/80 bg-muted/50 text-muted-foreground",
          )}
          aria-live="polite"
        >
          <Mail className="h-3.5 w-3.5" aria-hidden />
          <span className="tabular-nums">
            {unreadCount > 0
              ? `${formatCount(unreadCount)} پیام خوانده‌نشده`
              : "بدون پیام خوانده‌نشده"}
          </span>
        </span>
      }
    />
  );
}
