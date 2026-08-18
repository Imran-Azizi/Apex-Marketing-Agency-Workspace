"use client";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VideoPlayer } from "@/components/media/video-player";
import { portfolioAdminStreamUrl } from "@/lib/media";
import { formatDate } from "@/lib/utils";
import type { PortfolioAdminItem } from "./types";

export function PortfolioPreview({
  item,
  open,
  onOpenChange,
}: {
  item: PortfolioAdminItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto text-start sm:max-w-3xl"
        dir="rtl"
      >
        <DialogHeader className="text-start">
          <DialogTitle className="pe-8">{item?.title}</DialogTitle>
          <DialogDescription className="leading-6">
            {item?.description || "پیش‌نمایش ویدیوی نمونه‌کار"}
          </DialogDescription>
        </DialogHeader>
        {item ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={item.status === "PUBLISHED" ? "success" : "secondary"}
              >
                {item.status === "PUBLISHED" ? "فعال" : "غیرفعال"}
              </Badge>
              {item.categories.map((category) => (
                <Badge key={category.id} variant="outline">
                  {category.name}
                </Badge>
              ))}
            </div>
            {item.video || item.storageKey ? (
              <VideoPlayer
                src={portfolioAdminStreamUrl(item.id)}
                poster={item.thumbnailUrl || undefined}
                title={item.title}
              />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-xl border bg-muted/40 text-sm text-muted-foreground">
                ویدیویی برای این نمونه‌کار ثبت نشده است
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {item.project?.title ? `پروژه: ${item.project.title}` : "آپلود مستقیم"}
              {item.publishedAt ? ` · انتشار ${formatDate(item.publishedAt)}` : ""}
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
