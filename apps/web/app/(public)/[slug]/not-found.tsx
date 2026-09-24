import Link from "next/link";
import { LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPageNotFound() {
  return (
    <div
      dir="rtl"
      className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center"
    >
      <meta name="robots" content="noindex, follow" />
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/25 bg-brand/10">
        <LayoutTemplate className="h-7 w-7 text-brand" aria-hidden />
      </div>
      <h1 className="text-xl font-bold text-foreground sm:text-2xl">
        این صفحه در دسترس نیست
      </h1>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        ممکن است صفحه هنوز منتشر نشده باشد یا پیوند آن اشتباه باشد.
      </p>
      <Button variant="brand" className="mt-6 rounded-full" asChild>
        <Link href="/">بازگشت به صفحه اصلی</Link>
      </Button>
    </div>
  );
}
