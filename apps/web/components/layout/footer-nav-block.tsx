"use client";

import type { MouseEvent, ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import {
  PUBLIC_NAV_ITEMS,
  type PublicSectionId,
} from "@/components/public/use-active-section";
import { usePublicSectionNav } from "@/components/public/use-public-nav";
import { COMPANY_INTRO_TITLE } from "@/lib/company";
import { serviceTitle, type PublicService } from "@/lib/services";
import { cn } from "@/lib/utils";

const linkClass = cn(
  "inline-flex max-w-full rounded-sm text-[13px] leading-6 text-muted-foreground",
  "transition-colors duration-200 hover:text-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "sm:text-sm sm:leading-7",
);

function FooterHeading({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 sm:mb-4">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-brand sm:text-xs">
        {children}
      </p>
      <span className="mt-2 block h-px w-8 bg-brand/70" aria-hidden />
    </div>
  );
}

function SectionAnchor({
  sectionId,
  href,
  className,
  children,
  goToSection,
  ...props
}: {
  sectionId: PublicSectionId;
  href: string;
  className?: string;
  children: ReactNode;
  goToSection: (id: PublicSectionId, event?: MouseEvent) => void;
} & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "onClick" | "children"
>) {
  return (
    <a
      href={href}
      onClick={(event) => goToSection(sectionId, event)}
      className={cn(className)}
      {...props}
    >
      {children}
    </a>
  );
}

export function FooterNavBlock({
  publishedServices,
  hasMoreServices,
  aboutText,
}: {
  publishedServices: PublicService[];
  hasMoreServices: boolean;
  aboutText: string;
}) {
  const { goToSection } = usePublicSectionNav();

  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:gap-x-8 sm:gap-y-10 md:grid-cols-12 md:gap-x-8 lg:gap-x-10">
      <div className="col-span-2 text-center sm:text-start md:col-span-12 lg:col-span-5 lg:pe-6 xl:col-span-5">
        <SectionAnchor
          sectionId="home"
          href="/#home"
          goToSection={goToSection}
          className="inline-flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${COMPANY_INTRO_TITLE} — بازگشت به خانه`}
        >
          <Logo size="sm" wordmarkClassName="text-foreground" />
        </SectionAnchor>
        <p className="mt-3.5 text-[0.95rem] font-semibold tracking-tight text-foreground sm:mt-4 sm:text-base">
          {COMPANY_INTRO_TITLE}
        </p>
        {aboutText ? (
          <p className="mx-auto mt-2.5 max-w-md whitespace-pre-wrap text-pretty text-[13px] leading-7 text-muted-foreground line-clamp-3 sm:mx-0 sm:mt-3 sm:max-w-md sm:text-sm sm:leading-8 sm:line-clamp-4 lg:line-clamp-none">
            {aboutText}
          </p>
        ) : null}
      </div>

      <nav
        aria-label="پیوندهای سریع"
        className="col-span-1 min-w-0 md:col-span-5 lg:col-span-3"
      >
        <FooterHeading>پیوندهای سریع</FooterHeading>
        <ul className="space-y-2 sm:space-y-2.5">
          {PUBLIC_NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <SectionAnchor
                sectionId={item.id}
                href={`/#${item.id}`}
                goToSection={goToSection}
                className={linkClass}
              >
                {item.label}
              </SectionAnchor>
            </li>
          ))}
        </ul>
      </nav>

      <nav
        aria-label="خدمات"
        className="col-span-1 min-w-0 md:col-span-7 lg:col-span-4"
      >
        <FooterHeading>خدمات</FooterHeading>
        {publishedServices.length > 0 ? (
          <>
            <ul className="space-y-2 sm:space-y-2.5">
              {publishedServices.map((service) => (
                <li key={service.id}>
                  <SectionAnchor
                    sectionId="services"
                    href="/#services"
                    goToSection={goToSection}
                    className={cn(
                      linkClass,
                      "text-balance break-words hyphens-auto",
                    )}
                    title={serviceTitle(service)}
                  >
                    {serviceTitle(service)}
                  </SectionAnchor>
                </li>
              ))}
            </ul>
            {hasMoreServices ? (
              <SectionAnchor
                sectionId="services"
                href="/#services"
                goToSection={goToSection}
                className={cn(
                  linkClass,
                  "mt-3 inline-flex font-medium text-foreground/80 hover:text-brand sm:mt-4",
                )}
              >
                مشاهده همه خدمات
              </SectionAnchor>
            ) : null}
          </>
        ) : (
          <SectionAnchor
            sectionId="services"
            href="/#services"
            goToSection={goToSection}
            className={linkClass}
          >
            خدمات ما
          </SectionAnchor>
        )}
      </nav>
    </div>
  );
}
