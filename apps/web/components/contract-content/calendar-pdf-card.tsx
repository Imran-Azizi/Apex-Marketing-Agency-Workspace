"use client";

import { useEffect, useState } from "react";
import { Download, Eye, FileText, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { SharedPdf } from "@/lib/contract-workspace";
import { downloadFile } from "@/lib/content-calendar-pdf";
import { formatCount } from "@/lib/contract-project";
import { api, ApiError } from "@/lib/api";
import { resolveClientAuthPanel } from "@/lib/auth-panel";
import { formatFileSize } from "@/lib/upload";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

async function fetchPortalCalendarPdf(
  contractId: string,
  calendarId: string,
): Promise<Blob> {
  const panel = resolveClientAuthPanel();
  const response = await api.get<Blob>(
    `/portal/contracts/${encodeURIComponent(contractId)}/calendars/${encodeURIComponent(calendarId)}/pdf`,
    {
      responseType: "blob",
      params: panel ? { panel } : undefined,
    },
  );
  const blob = response.data;
  const contentType = String(response.headers?.["content-type"] || "");
  if (
    contentType.includes("application/json") ||
    (blob.type && blob.type.includes("application/json"))
  ) {
    const text = await blob.text();
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string; code?: string } };
      throw new ApiError(
        parsed.error?.message || "دریافت فایل PDF ناموفق بود",
        400,
        parsed.error?.code || "FILE_FETCH_FAILED",
      );
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError("دریافت فایل PDF ناموفق بود", 400, "FILE_FETCH_FAILED");
    }
  }
  return blob.type === "application/pdf"
    ? blob
    : new Blob([blob], { type: "application/pdf" });
}

export function CalendarPdfCard({
  contractId,
  calendarId,
  title,
  rowCount,
  sharedAt,
  pdf,
  onEdit,
}: {
  contractId: string;
  calendarId: string;
  title: string;
  rowCount: number;
  sharedAt?: string | null;
  pdf: SharedPdf;
  onEdit?: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<"preview" | "download" | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const openPreview = async () => {
    setPreviewOpen(true);
    if (previewUrl) return;
    setLoading("preview");
    try {
      const blob = await fetchPortalCalendarPdf(contractId, calendarId);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (error) {
      setPreviewOpen(false);
      toast.error(error instanceof Error ? error.message : "نمایش PDF ناموفق بود");
    } finally {
      setLoading(null);
    }
  };

  const download = async () => {
    setLoading("download");
    try {
      downloadFile(await fetchPortalCalendarPdf(contractId, calendarId), pdf.name);
    } catch {
      if (pdf.url) {
        window.open(pdf.url, "_blank", "noopener");
      } else {
        toast.error("دانلود PDF ناموفق بود");
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
          <FileText className="h-6 w-6" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="break-words font-semibold leading-snug">{title}</p>
          <p className="text-xs text-muted-foreground">
            PDF · {formatCount(rowCount)} محتوا
            {pdf.sizeBytes ? ` · ${formatFileSize(pdf.sizeBytes)}` : ""}
            {sharedAt ? ` · ارسال‌شده در ${formatDate(sharedAt)}` : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {onEdit ? (
          <Button variant="outline" className="flex-1 rounded-xl sm:flex-none" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            ویرایش
          </Button>
        ) : null}
        <Button variant="outline" className="flex-1 rounded-xl sm:flex-none" onClick={() => void openPreview()}>
          {loading === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
          مشاهده
        </Button>
        <Button
          variant="brand"
          className="flex-1 rounded-xl sm:flex-none"
          disabled={loading === "download"}
          onClick={() => void download()}
        >
          {loading === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          دانلود PDF
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent dir="rtl" className="flex h-[90vh] flex-col gap-3 text-start sm:max-w-4xl">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle className="line-clamp-1 pe-6">{title}</DialogTitle>
            <DialogDescription>
              اگر پیش‌نمایش روی دستگاه شما نمایش داده نشد، فایل را دانلود کنید.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-muted/30">
            {previewUrl ? (
              <iframe src={previewUrl} title={title} className="h-full w-full" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="brand" className="rounded-xl" onClick={() => void download()}>
              <Download className="h-4 w-4" />
              دانلود PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
