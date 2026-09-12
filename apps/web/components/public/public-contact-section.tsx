"use client";

import dynamic from "next/dynamic";
import type { PublicContactInfo } from "@/lib/contact";
import { ContactInfoPanel } from "@/components/public/contact-info-panel";
import { PublicSection } from "@/components/public/public-section";
import { Skeleton } from "@/components/ui/skeleton";

const ContactForm = dynamic(
  () =>
    import("@/components/public/contact-form").then((m) => m.ContactForm),
  {
    loading: () => (
      <div className="rounded-3xl border border-border/70 bg-card/90 p-5 sm:p-7">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
        <Skeleton className="mt-4 h-36 rounded-xl" />
        <Skeleton className="mt-6 h-12 w-48 rounded-xl" />
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
      eyebrow="تماس"
      title="تماس با ما"
      description={description || undefined}
    >
      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-8">
        <ContactForm />
        <ContactInfoPanel info={initialContact ?? undefined} />
      </div>
    </PublicSection>
  );
}
