import Link from "next/link";
import { Film } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PortfolioWorkNotFound() {
  return (
    <div
      dir="rtl"
      className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/25 bg-brand/10">
        <Film className="h-7 w-7 text-brand" aria-hidden />
      </div>
      <h1 className="text-xl font-bold text-foreground sm:text-2xl">
        این نمونه‌کار در دسترس نیست
      </h1>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        ممکن است ویدیو حذف شده باشد یا پیوند آن اشتباه باشد.
      </p>
      <Button variant="brand" className="mt-6 rounded-full" asChild>
        <Link href="/#portfolio">بازگشت به نمونه های کاری</Link>
      </Button>
    </div>
  );
}
