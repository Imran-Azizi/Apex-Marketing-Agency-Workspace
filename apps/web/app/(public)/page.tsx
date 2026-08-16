"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicHero } from "@/components/public/public-hero";

const PublicServicesSection = dynamic(
  () =>
    import("@/components/public/public-services-section").then(
      (m) => m.PublicServicesSection,
    ),
  { loading: () => <Skeleton className="mx-auto h-64 max-w-7xl rounded-2xl" /> },
);
const PublicPortfolioSection = dynamic(
  () =>
    import("@/components/public/public-portfolio-section").then(
      (m) => m.PublicPortfolioSection,
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
      <PublicHero whatsappUrl={cta?.url} />

      <PublicServicesSection />
      <PublicPortfolioSection />
      <PublicNarratorsSection />

      <section className="border-t border-border/50 bg-transparent">
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
                <Button
                  variant="brand"
                  size="lg"
                  className="h-11 gap-2 rounded-xl"
                  asChild
                >
                  <a href={cta.url} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" />
                    شروع گفتگو
                  </a>
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="lg"
                className="h-11 rounded-xl"
                asChild
              >
                <Link href="/portal/login">پورتال مشتری</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
