"use client";

import { PublicContactSection } from "@/components/public/public-contact-section";
import { LandingHeroView } from "@/components/landing/landing-hero";
import { LandingSectionView } from "@/components/landing/landing-section";
import type { LandingContent } from "@/lib/landing-content";
import type { PublicContactInfo } from "@/lib/contact";
import { cn } from "@/lib/utils";

export function LandingPageRenderer({
  content,
  contact,
  showForm = true,
  className,
}: {
  content: LandingContent;
  contact?: PublicContactInfo | null;
  showForm?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("w-full max-w-full overflow-x-hidden", className)} dir="rtl">
      <LandingHeroView hero={content.hero} />
      {(content.sections || []).map((section) => (
        <LandingSectionView key={section.id} section={section} />
      ))}
      {showForm ? <PublicContactSection initialContact={contact ?? undefined} /> : null}
    </div>
  );
}
