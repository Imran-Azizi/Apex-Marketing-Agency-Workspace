import { Suspense } from "react";
import { PublicHero } from "@/components/public/public-hero";
import { CompanyIntroSection } from "@/components/public/company-intro-section";
import { PublicServicesSection } from "@/components/public/public-services-section";
import { PublicPortfolioSection } from "@/components/public/public-portfolio-section";
import { PublicCustomersSection } from "@/components/public/public-customers-section";
import { PublicContactSection } from "@/components/public/public-contact-section";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchPublicJson,
  PUBLIC_REVALIDATE_SECONDS,
} from "@/lib/public-api";
import { HERO_STAGE_CLASSNAME, type HeroSlide } from "@/lib/hero";
import type { PublicService } from "@/lib/services";
import type { ShowcaseCustomer } from "@/lib/customers";
import type { PublicContactInfo } from "@/lib/contact";
import {
  MIXED_SLUG,
  type PublicPortfolioList,
  type PublicPortfolioTabs,
} from "@/lib/portfolio";
import type { PublicSiteCopy } from "@/lib/public-copy";

export const revalidate = PUBLIC_REVALIDATE_SECONDS;

function fetchSiteCopy() {
  return fetchPublicJson<PublicSiteCopy>(
    "/public/site-copy",
    PUBLIC_REVALIDATE_SECONDS,
    ["public-site-copy"],
  );
}

function HeroFallback() {
  return (
    <section
      id="home"
      className="relative isolate scroll-mt-20 overflow-hidden bg-background"
      aria-labelledby="hero-heading"
    >
      <div className={HERO_STAGE_CLASSNAME}>
        <div className="absolute inset-0 bg-muted/40" />
      </div>
      <span id="hero-heading" className="sr-only">
        در حال بارگذاری
      </span>
    </section>
  );
}

function SectionCardsFallback({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-border/50">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <h2 className="mb-10 text-center text-2xl font-bold tracking-tight">
          {title}
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video rounded-2xl" />
          ))}
        </div>
      </div>
    </section>
  );
}

async function HeroBlock() {
  const hero = await fetchPublicJson<HeroSlide[]>(
    "/public/hero",
    PUBLIC_REVALIDATE_SECONDS,
    ["public-hero"],
  );
  return <PublicHero initialSlides={hero} />;
}

async function AboutBlock() {
  const copy = await fetchSiteCopy();
  return <CompanyIntroSection description={copy?.company} />;
}

async function ServicesBlock() {
  const [services, copy] = await Promise.all([
    fetchPublicJson<PublicService[]>(
      "/public/services",
      PUBLIC_REVALIDATE_SECONDS,
      ["public-services"],
    ),
    fetchSiteCopy(),
  ]);
  return (
    <PublicServicesSection
      initialServices={services}
      description={copy?.services}
    />
  );
}

async function PortfolioBlock() {
  const [portfolioTabs, portfolioList, copy] = await Promise.all([
    fetchPublicJson<PublicPortfolioTabs>("/public/portfolio/categories", PUBLIC_REVALIDATE_SECONDS, [
      "public-portfolio",
    ]),
    fetchPublicJson<PublicPortfolioList>(
      `/public/portfolio?category=${encodeURIComponent(MIXED_SLUG)}`,
      PUBLIC_REVALIDATE_SECONDS,
      ["public-portfolio"],
    ),
    fetchSiteCopy(),
  ]);
  return (
    <PublicPortfolioSection
      initialTabs={portfolioTabs}
      initialList={portfolioList}
      description={copy?.portfolio}
    />
  );
}

async function CustomersBlock() {
  const [customers, copy] = await Promise.all([
    fetchPublicJson<ShowcaseCustomer[]>(
      "/public/customers",
      PUBLIC_REVALIDATE_SECONDS,
      ["public-customers"],
    ),
    fetchSiteCopy(),
  ]);
  return (
    <PublicCustomersSection
      initialCustomers={customers}
      description={copy?.customers}
    />
  );
}

async function ContactBlock() {
  const [contact, copy] = await Promise.all([
    fetchPublicJson<PublicContactInfo>(
      "/public/contact-info",
      PUBLIC_REVALIDATE_SECONDS,
      ["public-contact"],
    ),
    fetchSiteCopy(),
  ]);
  return (
    <PublicContactSection
      initialContact={contact}
      description={copy?.contact}
    />
  );
}

export default function HomePage() {
  return (
    <div className="overflow-x-hidden">
      <Suspense fallback={<HeroFallback />}>
        <HeroBlock />
      </Suspense>
      <Suspense fallback={null}>
        <AboutBlock />
      </Suspense>
      <Suspense fallback={<SectionCardsFallback id="services" title="خدمات ما" />}>
        <ServicesBlock />
      </Suspense>
      <Suspense
        fallback={<SectionCardsFallback id="portfolio" title="نمونه های کاری" />}
      >
        <PortfolioBlock />
      </Suspense>
      <Suspense
        fallback={<SectionCardsFallback id="customers" title="مشتریان ما" />}
      >
        <CustomersBlock />
      </Suspense>
      <Suspense fallback={<SectionCardsFallback id="contact" title="تماس با ما" />}>
        <ContactBlock />
      </Suspense>
    </div>
  );
}
