import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortfolioDetails } from "@/components/public/portfolio/portfolio-details";
import { JsonLd } from "@/components/seo/json-ld";
import {
  fetchPublicPortfolioDetail,
  portfolioMetaDescription,
  portfolioWorkPath,
} from "@/lib/portfolio";
import { pageMetadata, SITE_NAME_SHORT } from "@/lib/seo";
import { portfolioGraph } from "@/lib/structured-data";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const item = await fetchPublicPortfolioDetail(slug);
    if (!item) {
      return pageMetadata({
        title: `نمونه‌کار یافت نشد | ${SITE_NAME_SHORT}`,
        description: "این نمونه‌کار در وب‌سایت شرکت تبلیغاتی اپیکس منتشر نشده است.",
        path: portfolioWorkPath(slug),
        index: false,
      });
    }
    const description = portfolioMetaDescription(item);
    return pageMetadata({
      title: `${item.title} | نمونه کارهای ${SITE_NAME_SHORT}`,
      description,
      path: portfolioWorkPath(item.slug),
      image: item.thumbnailUrl,
      imageAlt: item.title,
      ogType: "video.other",
    });
  } catch {
    return pageMetadata({
      title: `نمونه های کاری | ${SITE_NAME_SHORT}`,
      description: "نمونه ویدیوهای تبلیغاتی منتشرشده توسط شرکت تبلیغاتی اپیکس.",
      path: "/",
      index: false,
    });
  }
}

export default async function PortfolioWorkPage({ params }: Props) {
  const { slug } = await params;
  const item = await fetchPublicPortfolioDetail(slug);
  if (!item) notFound();
  return (
    <>
      <JsonLd data={portfolioGraph(item)} />
      <PortfolioDetails item={item} />
    </>
  );
}
