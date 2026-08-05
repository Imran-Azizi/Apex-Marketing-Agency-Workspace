"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, MessageCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { scrollToSection } from "@/components/public/use-active-section";
import { Skeleton } from "@/components/ui/skeleton";

const PublicServicesSection = dynamic(
  () =>
    import("@/components/public/public-services-section").then(
      (m) => m.PublicServicesSection,
    ),
  { loading: () => <Skeleton className="mx-auto h-64 max-w-7xl rounded-2xl" /> },
);
const PublicStylesSection = dynamic(
  () =>
    import("@/components/public/public-styles-section").then(
      (m) => m.PublicStylesSection,
    ),
  { loading: () => <Skeleton className="mx-auto h-64 max-w-7xl rounded-2xl" /> },
);
const PublicNarratorsSection = dynamic(
  () =>
    import("@/components/public/public-narrators-section").then(
      (m) => m.PublicNarratorsSection,
    ),
  { loading: () => <Skeleton className="mx-auto h-64 max-w-7xl rounded-2xl" /> },
);

interface WhatsappCta {
  number: string;
  message: string;
  url: string;
}

export default function HomePage() {
  const { data: cta } = useQuery({
    queryKey: ["whatsapp-cta", "home"],
    queryFn: () =>
      apiGet<WhatsappCta>(
        `/public/whatsapp-cta?message=${encodeURIComponent("سلام، می‌خواهم درباره خدمات اپیکس اطلاعات بگیرم.")}`,
      ),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="overflow-x-hidden">
      {/* Hero — one composition, brand-first */}
      <section
        id="home"
        className="relative isolate min-h-[min(92vh,52rem)] scroll-mt-20 overflow-hidden"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--brand)/0.18),transparent_55%),radial-gradient(ellipse_at_bottom_left,hsl(var(--brand)/0.08),transparent_45%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,transparent,hsl(var(--background)))]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -start-24 top-24 -z-10 h-72 w-72 rounded-full bg-brand/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -end-16 bottom-20 -z-10 h-64 w-64 rounded-full bg-brand/5 blur-3xl"
        />

        <div className="mx-auto flex min-h-[min(92vh,52rem)] max-w-7xl flex-col justify-center px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center animate-public-fade">
            <p className="mb-5 text-sm font-semibold tracking-wide text-brand sm:text-base">
              اپیکس
            </p>
            <h1 className="text-balance text-4xl font-bold leading-[1.2] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              تولید محتوای حرفه‌ای با{" "}
              <span className="text-brand">اپیکس</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-8 text-muted-foreground sm:text-lg sm:leading-9">
              از ایده تا تحویل نهایی — ویدیو، صدا و سناریو با کیفیت سازمانی و
              فرآیند شفاف برای کسب‌وکارهای افغانستان.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              {cta?.url ? (
                <Button
                  variant="brand"
                  size="lg"
                  className="h-12 min-w-[12rem] gap-2 rounded-xl px-6 text-base shadow-lg shadow-brand/20 transition-transform hover:scale-[1.02]"
                  asChild
                >
                  <a href={cta.url} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-5 w-5" />
                    تماس در واتساپ
                  </a>
                </Button>
              ) : (
                <Button
                  variant="brand"
                  size="lg"
                  className="h-12 min-w-[12rem] gap-2 rounded-xl px-6 text-base"
                  disabled
                >
                  <MessageCircle className="h-5 w-5" />
                  تماس در واتساپ
                </Button>
              )}
              <Button
                variant="outline"
                size="lg"
                className="h-12 min-w-[12rem] gap-2 rounded-xl border-border/80 bg-background/60 px-6 text-base backdrop-blur-sm transition-colors hover:bg-accent"
                onClick={() => scrollToSection("services")}
              >
                مشاهده خدمات
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mx-auto mt-16 w-full max-w-4xl animate-public-fade-delay">
            <div className="relative overflow-hidden rounded-[1.75rem] border border-border/60 bg-card/40 shadow-2xl shadow-brand/5 backdrop-blur-sm">
              <div className="aspect-[16/9] bg-gradient-to-br from-brand/25 via-muted/40 to-background p-6 sm:p-10">
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg shadow-brand/30">
                    <Play className="h-7 w-7 fill-current ps-0.5" />
                  </span>
                  <p className="text-sm font-medium text-foreground sm:text-base">
                    ویدیو، صدا و محتوا — یک مسیر شفاف تا تحویل
                  </p>
                  <p className="max-w-md text-xs text-muted-foreground sm:text-sm">
                    پورتال مشتری، پیگیری پیشرفت و تحویل نسخه نهایی در یک سیستم
                    یکپارچه
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PublicServicesSection />
      <PublicStylesSection />
      <PublicNarratorsSection />

      {/* Closing CTA */}
      <section className="border-t border-border/50 bg-background">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="relative overflow-hidden rounded-3xl border border-brand/20 bg-gradient-to-l from-brand/15 via-brand/5 to-transparent px-6 py-12 text-center sm:px-12 sm:py-14">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              آماده شروع پروژه بعدی‌تان هستید؟
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              با تیم اپیکس در واتساپ گفتگو کنید یا از پورتال مشتری وارد شوید.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {cta?.url ? (
                <Button variant="brand" size="lg" className="h-11 rounded-xl gap-2" asChild>
                  <a href={cta.url} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" />
                    شروع گفتگو
                  </a>
                </Button>
              ) : null}
              <Button variant="outline" size="lg" className="h-11 rounded-xl" asChild>
                <Link href="/portal/login">پورتال مشتری</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
