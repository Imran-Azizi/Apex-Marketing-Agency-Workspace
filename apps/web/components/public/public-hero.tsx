"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { HeroSlide } from "@/lib/hero";
import { HeroSlideshow } from "@/components/public/hero-slideshow";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { scrollToSection } from "@/components/public/use-active-section";

export function PublicHero(_props: { whatsappUrl?: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public-hero"],
    queryFn: () => apiGet<HeroSlide[]>("/public/hero"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const slides = data || [];

  if (isLoading) {
    return (
      <section
        id="home"
        className="relative isolate scroll-mt-20 overflow-hidden bg-background"
        aria-labelledby="hero-heading"
      >
        <div className="relative min-h-[32rem] sm:min-h-[38rem] lg:min-h-[min(88vh,46rem)]">
          <Skeleton className="absolute inset-0 rounded-none" />
          <div className="relative z-[1] mx-auto flex h-full min-h-[32rem] max-w-7xl items-end px-4 py-16 sm:px-6 lg:items-center lg:px-8">
            <div className="w-full max-w-xl space-y-4">
              <Skeleton className="h-10 w-4/5" />
              <Skeleton className="h-10 w-3/5" />
              <Skeleton className="h-16 w-full max-w-md" />
              <div className="flex gap-3 pt-2">
                <Skeleton className="h-12 w-40 rounded-xl" />
                <Skeleton className="h-12 w-40 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
        <span id="hero-heading" className="sr-only">
          در حال بارگذاری
        </span>
      </section>
    );
  }

  if (isError) {
    return (
      <section
        id="home"
        className="relative isolate scroll-mt-20 bg-background px-4 py-24 text-center"
        aria-labelledby="hero-heading"
      >
        <h1 id="hero-heading" className="text-2xl font-bold">
          بارگذاری هیرو ناموفق بود
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          لطفاً دوباره تلاش کنید.
        </p>
        <Button variant="brand" className="mt-6" onClick={() => refetch()}>
          تلاش مجدد
        </Button>
      </section>
    );
  }

  if (!slides.length) {
    return (
      <section
        id="home"
        className="relative isolate scroll-mt-20 overflow-hidden bg-background text-foreground"
        aria-labelledby="hero-heading"
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="hero-orb absolute -top-28 end-[-12%] h-[26rem] w-[26rem] rounded-full bg-brand/[0.14] blur-3xl dark:bg-brand/[0.12]" />
          <div className="absolute inset-0 bg-gradient-to-b from-brand/[0.06] via-transparent to-transparent" />
        </div>
        <div className="relative mx-auto flex min-h-[28rem] max-w-7xl items-center px-4 py-20 sm:px-6 lg:min-h-[32rem] lg:px-8">
          <div className="max-w-2xl">
            <h1
              id="hero-heading"
              className="text-balance text-3xl font-bold leading-[1.25] tracking-tight sm:text-4xl lg:text-[2.75rem]"
            >
              آژانس هوشمند بازاریابی{" "}
              <span className="text-brand">اپیکس</span>
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-8 text-muted-foreground sm:text-base">
              محتوای هیرو به‌زودی از پنل مدیریت منتشر می‌شود.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                variant="brand"
                size="lg"
                className="h-12 rounded-xl"
                onClick={() => scrollToSection("contact")}
              >
                تماس با ما
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 rounded-xl"
                onClick={() => scrollToSection("portfolio")}
              >
                مشاهده آثار
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return <HeroSlideshow slides={slides} />;
}
