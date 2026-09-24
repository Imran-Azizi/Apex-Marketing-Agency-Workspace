import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { LandingPageRenderer } from "@/components/landing/landing-page-renderer";
import { JsonLd } from "@/components/seo/json-ld";
import { fetchPublicJson, PUBLIC_REVALIDATE_SECONDS } from "@/lib/public-api";
import {
  RESERVED_LANDING_SLUGS,
  type PublicLandingPage,
} from "@/lib/landing-pages";
import type { PublicContactInfo } from "@/lib/contact";
import { pageMetadata, SITE_NAME_SHORT, truncateMeta } from "@/lib/seo";
import { landingGraph } from "@/lib/structured-data";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

function isReserved(slug: string) {
  return RESERVED_LANDING_SLUGS.has(slug) || slug.startsWith("_");
}

async function fetchPublicLandingPage(slug: string) {
  return fetchPublicJson<PublicLandingPage>(
    `/public/landing-pages/${encodeURIComponent(slug)}`,
    PUBLIC_REVALIDATE_SECONDS,
    ["public-landing-pages"],
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (isReserved(slug)) {
    return pageMetadata({
      title: `صفحه یافت نشد | ${SITE_NAME_SHORT}`,
      description: "این نشانی در وب‌سایت شرکت تبلیغاتی اپیکس وجود ندارد.",
      path: `/${slug}`,
      index: false,
    });
  }
  try {
    const page = await fetchPublicLandingPage(slug);
    if (!page) {
      return pageMetadata({
        title: `صفحه یافت نشد | ${SITE_NAME_SHORT}`,
        description: "این صفحه منتشر نشده یا نشانی آن نادرست است.",
        path: `/${slug}`,
        index: false,
      });
    }
    const description = truncateMeta(
      page.description ||
        page.content?.hero?.description ||
        `${page.title} — صفحه اختصاصی ${SITE_NAME_SHORT}`,
    );
    const ogImage = page.content?.hero?.backgroundImageSrc || undefined;
    return pageMetadata({
      title: `${page.title} | ${SITE_NAME_SHORT}`,
      description,
      path: `/${page.slug}`,
      image: ogImage,
      imageAlt: page.content?.hero?.heading || page.title,
    });
  } catch {
    return pageMetadata({
      title: `صفحه یافت نشد | ${SITE_NAME_SHORT}`,
      description: "این صفحه در حال حاضر در دسترس نیست.",
      path: `/${slug}`,
      index: false,
    });
  }
}

export default async function PublicLandingPage({ params }: Props) {
  const { slug } = await params;
  if (isReserved(slug)) notFound();
  const [page, contact] = await Promise.all([
    fetchPublicLandingPage(slug),
    fetchPublicJson<PublicContactInfo>(
      "/public/contact-info",
      PUBLIC_REVALIDATE_SECONDS,
      ["public-contact"],
    ),
  ]);
  if (!page) notFound();
  return (
    <>
      <JsonLd data={landingGraph(page)} />
      <nav
        aria-label="مسیر صفحه"
        className="mx-auto flex max-w-6xl flex-wrap items-center gap-1.5 px-4 pt-6 text-sm text-muted-foreground sm:px-6 lg:px-8"
      >
        <Link
          href="/"
          className="rounded-md transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          خانه
        </Link>
        <ChevronLeft className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
        <span className="line-clamp-1 text-foreground">{page.title}</span>
      </nav>
      <LandingPageRenderer content={page.content} contact={contact} showForm />
    </>
  );
}
