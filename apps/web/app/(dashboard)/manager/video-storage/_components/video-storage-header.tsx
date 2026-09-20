"use client";

import { Plus, Images } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";

export function VideoStorageHeader({
  canUpload,
  onUpload,
}: {
  canUpload?: boolean;
  onUpload?: () => void;
}) {
  return (
    <PageHeader
      title="مدیریت ویدیوها"
      subtitle="ذخیره‌سازی امن ویدیوهای شرکت، بررسی، ارسال به نمونه‌کارها و آماده‌سازی برای انتشار عمومی"
      className="mb-0 sm:mb-0"
      actions={
        <div className="flex flex-wrap items-center justify-start gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-9 gap-1.5 rounded-xl px-3.5"
          >
            <Link href="/manager/portfolio">
              <Images className="h-3.5 w-3.5" />
              نمونه‌کارها
            </Link>
          </Button>
          {canUpload ? (
            <Button
              variant="brand"
              size="sm"
              className="h-9 gap-1.5 rounded-xl px-3.5 shadow-sm shadow-brand/20"
              onClick={onUpload}
            >
              <Plus className="h-3.5 w-3.5" />
              آپلود ویدیو
            </Button>
          ) : null}
        </div>
      }
    />
  );
}
