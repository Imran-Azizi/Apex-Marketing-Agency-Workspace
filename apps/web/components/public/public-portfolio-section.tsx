import type {
  PublicPortfolioList,
  PublicPortfolioTabs,
} from "@/lib/portfolio";
import { PublicSection } from "@/components/public/public-section";
import { PublicPortfolioListView } from "@/components/public/public-portfolio-list";

export function PublicPortfolioSection({
  initialTabs,
  initialList,
  description,
}: {
  initialTabs?: PublicPortfolioTabs | null;
  initialList?: PublicPortfolioList | null;
  description?: string | null;
}) {
  return (
    <PublicSection
      id="portfolio"
      title="نمونه های کاری"
      description={description || undefined}
      className="[content-visibility:auto] [contain-intrinsic-size:auto_800px]"
    >
      <PublicPortfolioListView
        initialTabs={initialTabs}
        initialList={initialList}
      />
    </PublicSection>
  );
}
