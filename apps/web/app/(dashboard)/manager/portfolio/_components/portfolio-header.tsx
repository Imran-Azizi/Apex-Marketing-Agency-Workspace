import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";

export function PortfolioHeader({
  canCreate,
  onCreate,
}: {
  canCreate?: boolean;
  onCreate?: () => void;
}) {
  return (
    <PageHeader
      title="نمونه‌کارها"
      subtitle="مدیریت و سازمان‌دهی ویدیوهای نمونه‌کار و دسته‌بندی‌های وب‌سایت عمومی"
      className="mb-0 sm:mb-0"
      actions={
        <div className="flex flex-wrap items-center justify-start gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-9 gap-1.5 rounded-xl px-3.5"
          >
            <Link href="/#portfolio" target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              مشاهده عمومی
            </Link>
          </Button>
          {canCreate ? (
            <Button
              variant="brand"
              size="sm"
              className="h-9 gap-1.5 rounded-xl px-3.5 shadow-sm shadow-brand/20"
              onClick={onCreate}
            >
              <Plus className="h-3.5 w-3.5" />
              افزودن نمونه‌کار
            </Button>
          ) : null}
        </div>
      }
    />
  );
}
