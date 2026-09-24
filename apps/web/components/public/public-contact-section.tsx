"use client";

import dynamic from "next/dynamic";
import type { PublicContactInfo } from "@/lib/contact";
import { ContactInfoPanel } from "@/components/public/contact-info-panel";
import { PublicReveal } from "@/components/public/public-reveal";
import { PublicSection } from "@/components/public/public-section";
import { Skeleton } from "@/components/ui/skeleton";

const ContactForm = dynamic(
  () =>
    import("@/components/public/contact-form").then((m) => m.ContactForm),
  {
    loading: () => (
      <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm sm:p-7 lg:p-8">
        <Skeleton className="h-7 w-40" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
        <Skeleton className="mt-5 h-36 rounded-xl" />
        <Skeleton className="mt-6 h-12 w-full rounded-xl sm:w-48" />
      </div>
    ),
  },
);

export function PublicContactSection({
  initialContact,
  description,
}: {
  initialContact?: PublicContactInfo | null;
  description?: string | null;
}) {
  return (
    <PublicSection
      id="contact"
      title="تماس با ما"
      description={description || undefined}
      contentClassName="pb-16 sm:pb-24 lg:pb-28"
    >
      <div className="grid items-start gap-5 overflow-visible md:gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-8">
        <PublicReveal delay={80} className="min-w-0 overflow-visible">
          <ContactForm />
        </PublicReveal>
        <PublicReveal delay={160} className="min-w-0 overflow-visible">
          <ContactInfoPanel info={initialContact ?? undefined} />
        </PublicReveal>
      </div>
    </PublicSection>
  );
}
