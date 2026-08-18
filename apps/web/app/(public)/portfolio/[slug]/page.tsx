import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortfolioDetails } from "@/components/public/portfolio/portfolio-details";
import {
  fetchPublicPortfolioDetail,
  portfolioWorkPath,
} from "@/lib/portfolio";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const item = await fetchPublicPortfolioDetail(slug);
    if (!item) {
      return { title: "نمونه‌کار یافت نشد — اپیکس" };
    }
    const description =
      item.description ||
      `نمونه‌کار ${item.title} در بخش نمونه های کاری اپیکس`;
    return {
      title: `${item.title} — نمونه های کاری`,
      description,
      alternates: { canonical: portfolioWorkPath(item.slug) },
      openGraph: {
        title: item.title,
        description,
        type: "video.other",
        images: item.thumbnailUrl ? [{ url: item.thumbnailUrl }] : undefined,
      },
    };
  } catch {
    return { title: "نمونه های کاری — اپیکس" };
  }
}

export default async function PortfolioWorkPage({ params }: Props) {
  const { slug } = await params;
  const item = await fetchPublicPortfolioDetail(slug);
  if (!item) notFound();
  return <PortfolioDetails item={item} />;
}
