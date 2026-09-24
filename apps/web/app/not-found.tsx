import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SITE_NAME } from "@/lib/seo";

const LINKS = [
  { href: "/", label: "صفحه اصلی" },
  { href: "/#services", label: "خدمات" },
  { href: "/#portfolio", label: "نمونه های کاری" },
  { href: "/#contact", label: "تماس با ما" },
] as const;

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-16 text-center">
      <title>{`صفحه یافت نشد | ${SITE_NAME}`}</title>
      <meta name="robots" content="noindex, nofollow" />
      <p className="text-sm font-semibold tracking-wide text-brand">404</p>
      <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        صفحه یافت نشد
      </h1>
      <p className="max-w-md text-pretty text-sm leading-7 text-muted-foreground sm:text-base">
        نشانی واردشده در {SITE_NAME} وجود ندارد یا دیگر منتشر نیست.
      </p>
      <nav aria-label="صفحات پیشنهادی" className="flex flex-wrap items-center justify-center gap-2">
        {LINKS.map((link) => (
          <Button key={link.href} asChild variant={link.href === "/" ? "brand" : "outline"} className="rounded-full">
            <Link href={link.href}>{link.label}</Link>
          </Button>
        ))}
      </nav>
    </div>
  );
}
