"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicHero } from "@/components/public/public-hero";
import { CompanyIntroSection } from "@/components/public/company-intro-section";

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
const PublicCustomersSection = dynamic(
  () =>
    import("@/components/public/public-customers-section").then(
      (m) => m.PublicCustomersSection,
    ),
  { loading: () => <Skeleton className="mx-auto h-64 max-w-7xl rounded-2xl" /> },
);
const PublicContactSection = dynamic(
  () =>
    import("@/components/public/public-contact-section").then(
      (m) => m.PublicContactSection,
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
      <CompanyIntroSection />

      <PublicServicesSection />
      <PublicPortfolioSection />
      <PublicCustomersSection />
      <PublicContactSection />
    </div>
  );
}
