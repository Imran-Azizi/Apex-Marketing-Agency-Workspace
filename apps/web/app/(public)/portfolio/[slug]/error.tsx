"use client";

import Link from "next/link";
import { ErrorState } from "@/components/loading/error-state";

export default function PortfolioWorkError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div dir="rtl" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <ErrorState
        title="بارگذاری نمونه‌کار ممکن نشد"
        description="اتصال را بررسی کنید و دوباره تلاش کنید."
        onRetry={reset}
        action={
          <Link
            href="/#portfolio"
            className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
          >
            بازگشت به نمونه های کاری
          </Link>
        }
      />
    </div>
  );
}
