import type { PublicService } from "@/lib/services";
import { PublicSection } from "@/components/public/public-section";
import { PublicServicesList } from "@/components/public/public-services-list";

export function PublicServicesSection({
  previewLimit = 3,
  initialServices,
  description,
}: {
  previewLimit?: number;
  initialServices?: PublicService[] | null;
  description?: string | null;
}) {
  return (
    <PublicSection
      id="services"
      eyebrow="خدمات"
      title="خدمات ما"
      description={description || undefined}
      tone="muted"
      className="[content-visibility:auto] [contain-intrinsic-size:auto_720px]"
    >
      <PublicServicesList
        initialServices={initialServices}
        previewLimit={previewLimit}
      />
    </PublicSection>
  );
}
