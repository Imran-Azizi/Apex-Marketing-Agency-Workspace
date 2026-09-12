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

export const revalidate = PUBLIC_REVALIDATE_SECONDS;

export async function generateMetadata(): Promise<Metadata> {
  const copy = await fetchPublicJson<PublicSiteCopy>(
    "/public/site-copy",
    PUBLIC_REVALIDATE_SECONDS,
    ["public-site-copy"],
  );
  const description = copy?.company?.trim() || undefined;
  return {
    title: {
      default: COMPANY_INTRO_TITLE,
      template: `%s — ${COMPANY_INTRO_TITLE}`,
    },
    description,
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
    <div className="public-dot-pattern flex min-h-screen flex-col">
      <PublicHeader />
      <main className="relative flex-1 overflow-x-hidden">{children}</main>
      <Suspense fallback={null}>
        <PublicChrome />
      </Suspense>
    </div>
  );
}
