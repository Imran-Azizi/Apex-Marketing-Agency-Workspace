import dynamic from "next/dynamic";
import { PublicHero } from "@/components/public/public-hero";
import { CompanyIntroSection } from "@/components/public/company-intro-section";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPublicJson } from "@/lib/public-api";
import type { HeroSlide } from "@/lib/hero";
import type { PublicService } from "@/lib/services";
import type { ShowcaseCustomer } from "@/lib/customers";
import type { PublicContactInfo } from "@/lib/contact";
import {
  MIXED_SLUG,
  type PublicPortfolioList,
  type PublicPortfolioTabs,
} from "@/lib/portfolio";

export const revalidate = 60;

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

export default async function HomePage() {
  const [hero, services, customers, contact, portfolioTabs, portfolioList] =
    await Promise.all([
      fetchPublicJson<HeroSlide[]>("/public/hero", 30),
      fetchPublicJson<PublicService[]>("/public/services", 60),
      fetchPublicJson<ShowcaseCustomer[]>("/public/customers", 30),
      fetchPublicJson<PublicContactInfo>("/public/contact-info", 30),
      fetchPublicJson<PublicPortfolioTabs>("/public/portfolio/categories", 30),
      fetchPublicJson<PublicPortfolioList>(
        `/public/portfolio?category=${encodeURIComponent(MIXED_SLUG)}`,
        30,
      ),
    ]);

  return (
    <div className="overflow-x-hidden">
      <PublicHero initialSlides={hero ?? undefined} />
      <CompanyIntroSection />
      <PublicServicesSection initialServices={services} />
      <PublicPortfolioSection
        initialTabs={portfolioTabs}
        initialList={portfolioList}
      />
      <PublicCustomersSection initialCustomers={customers} />
      <PublicContactSection initialContact={contact} />
    </div>
  );
}
