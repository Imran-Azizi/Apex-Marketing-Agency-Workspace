import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";

export function CustomersHeader({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <PageHeader
      title="مشتریان ما"
      subtitle="تصویر، نام و معرفی مشتریان را برای نمایش در وب‌سایت عمومی مدیریت کنید"
      className="mb-0 sm:mb-0"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-9 gap-1.5 rounded-xl px-3.5"
          >
            <Link href="/#customers" target="_blank" rel="noreferrer">
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
              ایجاد مشتری
            </Button>
          ) : null}
        </div>
      }
    />
  );
}
