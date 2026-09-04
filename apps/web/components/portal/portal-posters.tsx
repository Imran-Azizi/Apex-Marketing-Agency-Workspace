"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mediaStreamUrl } from "@/lib/media";
import { POSTER_STATUS_LABELS, type PosterItem } from "@/lib/poster";
import { downloadMediaFile, formatFileSize } from "@/lib/upload";
import { formatDate } from "@/lib/utils";
import { Download, Eye, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

function PortalPosterCard({ item }: { item: PosterItem }) {
  const [downloading, setDownloading] = useState(false);
  const [viewer, setViewer] = useState(false);
  const statusLabel =
    item.statusLabel ||
    POSTER_STATUS_LABELS[
      item.status as keyof typeof POSTER_STATUS_LABELS
    ] ||
    "ارسال شده به مشتری";

  return (
    <>
      <article className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3.5 py-2.5">
          <h3 className="text-sm font-semibold tracking-tight">پوستر پروژه</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="brand" className="h-5 px-1.5 text-[10px]">
              {statusLabel}
            </Badge>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              نسخه {item.version}
            </Badge>
          </div>
        </div>
        <div className="bg-muted/30 p-3">
          <button
            type="button"
            onClick={() => setViewer(true)}
            className="block w-full overflow-hidden rounded-xl bg-neutral-950 ring-1 ring-black/5"
            aria-label="مشاهده پوستر"
          >
            <img
              src={mediaStreamUrl(item.fileId)}
              alt={item.name}
              className="aspect-video w-full object-contain"
            />
          </button>
        </div>
        <div className="space-y-3 px-3.5 pb-3.5">
          <p className="line-clamp-2 text-sm font-semibold" title={item.name}>
            {item.name}
          </p>
          <dl className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
              <dt className="text-[10px] text-muted-foreground">حجم</dt>
              <dd className="mt-0.5 font-medium">
                {item.sizeBytes != null ? formatFileSize(item.sizeBytes) : "—"}
              </dd>
            </div>
            <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
              <dt className="text-[10px] text-muted-foreground">تاریخ ارسال</dt>
              <dd className="mt-0.5 font-medium">
                {item.deliveredAt
                  ? formatDate(item.deliveredAt)
                  : item.createdAt
                    ? formatDate(item.createdAt)
                    : "—"}
              </dd>
            </div>
          </dl>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="sm"
              variant="brand"
              className="h-9 flex-1 gap-1.5 rounded-lg text-xs"
              onClick={() => setViewer(true)}
            >
              <Eye className="h-3.5 w-3.5" />
              مشاهده
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 flex-1 gap-1.5 rounded-lg text-xs"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  await downloadMediaFile(item.fileId, item.name);
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "دانلود ناموفق بود",
                  );
                } finally {
                  setDownloading(false);
                }
              }}
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              دانلود
            </Button>
          </div>
        </div>
      </article>

      <Dialog open={viewer} onOpenChange={setViewer}>
        <DialogContent dir="rtl" className="max-w-3xl gap-3 p-4 text-start">
          <DialogHeader className="space-y-1 text-start sm:text-start">
            <DialogTitle className="line-clamp-2 text-base">
              {item.name}
            </DialogTitle>
          </DialogHeader>
          <img
            src={mediaStreamUrl(item.fileId)}
            alt={item.name}
            className="w-full rounded-xl object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PortalPosters({
  posters,
  projectTitle,
}: {
  posters: PosterItem[];
  projectTitle?: string;
}) {
  if (!posters.length) {
    return (
      <div
        dir="rtl"
        className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-muted/15 px-4 py-10 text-center"
      >
        <ImageIcon className="h-7 w-7 text-muted-foreground/40" />
        <p className="text-sm font-medium">هنوز پوستری ارسال نشده است</p>
        <p className="max-w-sm text-xs leading-6 text-muted-foreground">
          وقتی مدیر پروژه پوستر تأییدشده را برایتان ارسال کند، اینجا نمایش داده
          می‌شود.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <header className="space-y-1 text-start">
        <h2 className="text-base font-semibold tracking-tight">پوستر پروژه</h2>
        <p className="text-xs leading-6 text-muted-foreground">
          پوسترهای تأیید و ارسال‌شده
          {projectTitle ? (
            <>
              {" "}
              —{" "}
              <span className="font-medium text-foreground">{projectTitle}</span>
            </>
          ) : null}
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {posters.map((item) => (
          <PortalPosterCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
