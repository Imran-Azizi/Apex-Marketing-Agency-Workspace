import { Film, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PortfolioEmptyState({
  hasQuery,
  canCreate,
  onCreate,
}: {
  hasQuery?: boolean;
  canCreate?: boolean;
  onCreate?: () => void;
}) {
  return (
    <div
      dir="rtl"
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/60 px-6 py-20 text-center"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/25 bg-brand/10">
        <Film className="h-7 w-7 text-brand" aria-hidden />
      </div>
      {hasQuery ? (
        <>
          <h3 className="text-lg font-semibold text-foreground">
            نتیجه‌ای یافت نشد
          </h3>
          <p className="mt-1 max-w-sm text-sm leading-7 text-muted-foreground">
            عبارت جستجو یا فیلتر را تغییر دهید.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-lg font-semibold text-foreground">
            هنوز نمونه‌کاری ایجاد نشده است
          </h3>
          <p className="mt-1 max-w-md text-sm leading-7 text-muted-foreground">
            ویدیوی نمونه‌کار را اینجا آپلود کنید یا از پروژه‌های تکمیل‌شده به
            نمونه‌کارها ارسال کنید.
          </p>
          {canCreate ? (
            <Button variant="brand" className="mt-6 gap-2 rounded-xl" onClick={onCreate}>
              <Plus className="h-4 w-4" />
              افزودن نمونه‌کار
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
