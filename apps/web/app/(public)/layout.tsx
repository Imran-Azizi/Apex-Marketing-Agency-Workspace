import { Suspense } from "react";
import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { WhatsAppFloatingButton } from "@/components/public/whatsapp-floating-button";
import {
  fetchPublicJson,
  PUBLIC_REVALIDATE_SECONDS,
} from "@/lib/public-api";
import type { PublicService } from "@/lib/services";
import type { PublicContactInfo } from "@/lib/contact";
import { COMPANY_INTRO_TITLE } from "@/lib/company";
import type { PublicSiteCopy } from "@/lib/public-copy";
import {
  homeDescription,
  homeTitle,
  INDEX_ROBOTS,
  SITE_LOCALE,
  SITE_NAME,
} from "@/lib/seo";

/** Must be a numeric literal — Next.js cannot analyze imported segment config. */
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const copy = await fetchPublicJson<PublicSiteCopy>(
    "/public/site-copy",
    PUBLIC_REVALIDATE_SECONDS,
    ["public-site-copy"],
  );
  const description = homeDescription(copy?.company);
  const title = homeTitle();
  return {
    title: {
      default: title,
      template: `%s | ${COMPANY_INTRO_TITLE}`,
    },
    description,
    robots: INDEX_ROBOTS,
    openGraph: {
      type: "website",
      locale: SITE_LOCALE,
      siteName: SITE_NAME,
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

async function PublicChrome() {
  const [services, contact, copy] = await Promise.all([
    fetchPublicJson<PublicService[]>("/public/services", PUBLIC_REVALIDATE_SECONDS, [
      "public-services",
    ]),
    fetchPublicJson<PublicContactInfo>(
      "/public/contact-info",
      PUBLIC_REVALIDATE_SECONDS,
      ["public-contact"],
    ),
    fetchPublicJson<PublicSiteCopy>(
      "/public/site-copy",
      PUBLIC_REVALIDATE_SECONDS,
      ["public-site-copy"],
    ),
  ]);

  return (
    <>
      <PublicFooter
        initialServices={services}
        initialContact={contact}
        companyDescription={copy?.company}
      />
      <WhatsAppFloatingButton href={contact?.whatsapp?.href} />
    </>
  );
}

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="public-dot-pattern flex min-h-screen flex-col overflow-x-clip">
      <PublicHeader />
      <main className="relative min-h-min w-full flex-1 animate-public-page-enter">
        {children}
      </main>
      <Suspense fallback={null}>
        <PublicChrome />
      </Suspense>
    </div>
  );
}
