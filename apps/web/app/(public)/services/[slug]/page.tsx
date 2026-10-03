import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceDetails } from "@/components/public/service-details";
import {
  fetchPublicServiceDetail,
  servicePath,
  serviceTitle,
} from "@/lib/services";
import { pageMetadata, SITE_NAME_SHORT } from "@/lib/seo";
import { stripHtml } from "@/lib/rich-text";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const service = await fetchPublicServiceDetail(slug);
    if (!service) {
      return pageMetadata({
        title: `خدمت یافت نشد | ${SITE_NAME_SHORT}`,
        description: "این خدمت در وب‌سایت شرکت تبلیغاتی اپیکس منتشر نشده است.",
        path: servicePath(slug),
        index: false,
      });
    }
    const title = serviceTitle(service);
    const description =
      stripHtml(service.description).slice(0, 160) ||
      `جزئیات خدمت ${title} در شرکت تبلیغاتی اپیکس.`;
    return pageMetadata({
      title: `${title} | خدمات ${SITE_NAME_SHORT}`,
      description,
      path: servicePath(service.slug),
      image: service.imageUrl || undefined,
      imageAlt: title,
    });
  } catch {
    return pageMetadata({
      title: `خدمات | ${SITE_NAME_SHORT}`,
      description: "خدمات تولید محتوای ویدیویی شرکت تبلیغاتی اپیکس.",
      path: "/#services",
      index: false,
    });
  }
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const service = await fetchPublicServiceDetail(slug);
  if (!service) notFound();
  return <ServiceDetails service={service} />;
}
