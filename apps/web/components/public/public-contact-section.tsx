"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { PublicContactInfo } from "@/lib/contact";
import { ContactForm } from "@/components/public/contact-form";
import { ContactInfoPanel } from "@/components/public/contact-info-panel";
import { PublicSection } from "@/components/public/public-section";

export function PublicContactSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["public-contact-info"],
    queryFn: () => apiGet<PublicContactInfo>("/public/contact-info"),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  return (
    <PublicSection
      id="contact"
      eyebrow="تماس"
      title="تماس با ما"
      description="برای مشاوره پروژه، دریافت پیشنهاد همکاری یا گفتگو درباره تولید محتوای حرفه‌ای، فرم را ارسال کنید یا از راه‌های ارتباطی مستقیم استفاده کنید."
    >
      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-8">
        <ContactForm subjects={data?.subjects} />
        <ContactInfoPanel info={data} isLoading={isLoading} />
      </div>
    </PublicSection>
  );
}
