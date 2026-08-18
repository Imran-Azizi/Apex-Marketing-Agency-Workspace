import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ContactMessagesEmptyState({
  hasQuery,
  onClear,
}: {
  hasQuery?: boolean;
  onClear?: () => void;
}) {
  return (
    <div
      dir="rtl"
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/60 px-6 py-20 text-center shadow-sm"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/25 bg-brand/10">
        <Inbox className="h-7 w-7 text-brand" aria-hidden />
      </div>
      {hasQuery ? (
        <>
          <h3 className="text-lg font-semibold text-foreground">
            نتیجه‌ای یافت نشد
          </h3>
          <p className="mt-1 max-w-sm text-sm leading-7 text-muted-foreground">
            عبارت جستجو یا فیلتر را تغییر دهید تا پیام‌های بیشتری نمایش داده شود.
          </p>
          {onClear ? (
            <Button variant="outline" className="mt-6 rounded-xl" onClick={onClear}>
              حذف فیلترها
            </Button>
          ) : null}
        </>
      ) : (
        <>
          <h3 className="text-lg font-semibold text-foreground">
            هنوز پیامی دریافت نشده است
          </h3>
          <p className="mt-1 max-w-md text-sm leading-7 text-muted-foreground">
            پیام‌های ارسال‌شده از فرم تماس وب‌سایت عمومی در این قسمت نمایش داده می‌شوند.
          </p>
        </>
      )}
    </div>
  );
}
