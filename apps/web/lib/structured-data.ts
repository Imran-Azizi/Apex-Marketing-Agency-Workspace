import { COMPANY_STORY_PARAGRAPHS } from "@/lib/company";
import type { PublicContactInfo } from "@/lib/contact";
import type { PublicPortfolioDetail } from "@/lib/portfolio";
import { portfolioMetaDescription, portfolioWorkPath } from "@/lib/portfolio";
import {
  absoluteUrl,
  DEFAULT_DESCRIPTION,
  getSiteUrl,
  SITE_LANGUAGE,
  SITE_NAME,
  SITE_NAME_SHORT,
} from "@/lib/seo";

const ORG_ID = () => `${getSiteUrl()}/#organization`;
const WEBSITE_ID = () => `${getSiteUrl()}/#website`;

function contactPoints(contact: PublicContactInfo | null | undefined) {
  const points: Array<Record<string, string | string[]>> = [];
  const phone = contact?.phone?.value?.trim();
  const email = contact?.email?.value?.trim();
  if (phone) {
    points.push({
      "@type": "ContactPoint",
      telephone: phone,
      contactType: "customer service",
      availableLanguage: ["fa", "Dari"],
      areaServed: "AF",
    });
  }
  if (email) {
    points.push({
      "@type": "ContactPoint",
      email,
      contactType: "customer service",
      availableLanguage: ["fa", "Dari"],
    });
  }
  return points;
}

export function organizationNode(contact?: PublicContactInfo | null) {
  const points = contactPoints(contact);
  return {
    "@type": ["Organization", "ProfessionalService"],
    "@id": ORG_ID(),
    name: SITE_NAME,
    alternateName: [SITE_NAME_SHORT, "APEX", "اپیکس اسمارت مارکتینگ"],
    url: absoluteUrl("/"),
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/brand/apex-logo.png"),
    },
    image: absoluteUrl("/opengraph-image"),
    description: DEFAULT_DESCRIPTION,
    foundingDate: "2010",
    foundingLocation: {
      "@type": "Place",
      name: "کابل",
      address: {
        "@type": "PostalAddress",
        addressLocality: "کابل",
        addressCountry: "AF",
      },
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: "کابل",
      addressCountry: "AF",
    },
    areaServed: [{ "@type": "Country", "name": "افغانستان" }],
    knowsAbout: [
      "ویدیو تبلیغاتی",
      "موشن گرافیک",
      "انیمیشن تبلیغاتی",
      "برندینگ",
      "هویت بصری",
      "تبلیغات تلویزیونی",
      "تولید محتوا",
    ],
    ...(points.length ? { contactPoint: points } : {}),
  };
}

export function websiteNode() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID(),
    url: absoluteUrl("/"),
    name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    inLanguage: SITE_LANGUAGE,
    publisher: { "@id": ORG_ID() },
  };
}

export function homeGraph(
  contact?: PublicContactInfo | null,
  description = DEFAULT_DESCRIPTION,
) {
  const org = organizationNode(contact);
  org.description = description;
  const site = websiteNode();
  site.description = description;
  return {
    "@context": "https://schema.org",
    "@graph": [
      org,
      site,
      {
        "@type": "WebPage",
        "@id": `${absoluteUrl("/")}#webpage`,
        url: absoluteUrl("/"),
        name: SITE_NAME,
        description,
        inLanguage: SITE_LANGUAGE,
        isPartOf: { "@id": WEBSITE_ID() },
        about: { "@id": ORG_ID() },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: absoluteUrl("/opengraph-image"),
        },
      },
    ],
  };
}

export function breadcrumbList(
  items: Array<{ name: string; path?: string }>,
) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.path ? { item: absoluteUrl(item.path) } : {}),
    })),
  };
}

export function portfolioGraph(item: PublicPortfolioDetail) {
  const path = portfolioWorkPath(item.slug);
  const url = absoluteUrl(path);
  const description = portfolioMetaDescription(item);
  const graph: Array<Record<string, unknown>> = [
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: item.title,
      description,
      inLanguage: SITE_LANGUAGE,
      isPartOf: { "@id": WEBSITE_ID() },
      breadcrumb: { "@id": `${url}#breadcrumb` },
    },
    {
      ...breadcrumbList([
        { name: "خانه", path: "/" },
        { name: "نمونه های کاری", path: "/#portfolio" },
        { name: item.title },
      ]),
      "@id": `${url}#breadcrumb`,
    },
  ];

  const thumbnail = item.thumbnailUrl?.trim();
  const uploadDate = item.publishedAt?.trim();
  if (thumbnail && uploadDate) {
    graph.push({
      "@type": "VideoObject",
      name: item.title,
      description,
      thumbnailUrl: absoluteUrl(thumbnail),
      uploadDate,
      embedUrl: url,
      contentUrl: `${
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1"
      }/public/portfolio/${encodeURIComponent(item.id)}/stream`,
      publisher: { "@id": ORG_ID() },
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

export function landingGraph(page: {
  title: string;
  slug: string;
  description?: string | null;
}) {
  const path = `/${page.slug}`;
  const url = absoluteUrl(path);
  const description =
    page.description?.trim() ||
    `صفحه ${page.title} از ${SITE_NAME}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: page.title,
        description,
        inLanguage: SITE_LANGUAGE,
        isPartOf: { "@id": WEBSITE_ID() },
        about: { "@id": ORG_ID() },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        ...breadcrumbList([
          { name: "خانه", path: "/" },
          { name: page.title },
        ]),
        "@id": `${url}#breadcrumb`,
      },
    ],
  };
}

/** Story text is the source for founding place; kept for callers that need a blurb. */
export const ORGANIZATION_STORY = COMPANY_STORY_PARAGRAPHS[0];
