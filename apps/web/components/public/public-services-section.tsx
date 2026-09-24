import {
  PUBLIC_SERVICES_PREVIEW_LIMIT,
  type PublicService,
} from "@/lib/services";
import { PublicSection } from "@/components/public/public-section";
import { PublicServicesList } from "@/components/public/public-services-list";

export function PublicServicesSection({
  previewLimit = PUBLIC_SERVICES_PREVIEW_LIMIT,
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
      title="خدمات ما"
      description={description || undefined}
      className="[content-visibility:auto] [contain-intrinsic-size:auto_720px]"
    >
      <PublicServicesList
        initialServices={initialServices}
        previewLimit={previewLimit}
      />
    </PublicSection>
  );
}
