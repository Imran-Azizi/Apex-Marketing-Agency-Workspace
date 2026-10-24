"use client";

import { useEffect, useState } from "react";
import { Download, FileWarning, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  downloadBlob,
  downloadStoredFile,
  fetchAuthenticatedFileBlob,
} from "@/lib/upload";
import { Button } from "@/components/ui/button";
import type { KnowledgeAttachment } from "../../knowledge/_components/types";

export function PolicyPdfEmbed({
  attachment,
}: {
  attachment: KnowledgeAttachment;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fileBlob, setFileBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function load() {
      setLoading(true);
      setError(false);
      setBlobUrl(null);
      setFileBlob(null);

      if (!attachment.storageKey) {
        setError(true);
        setLoading(false);
        return;
      }

      const blob = await fetchAuthenticatedFileBlob(
        attachment.storageKey,
        attachment.mimeType || "application/pdf",
      );

      if (cancelled) return;

      if (!blob) {
        setError(true);
        setLoading(false);
        return;
      }

      objectUrl = URL.createObjectURL(blob);
      setFileBlob(blob);
      setBlobUrl(objectUrl);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.storageKey, attachment.mimeType]);

  const onDownload = async () => {
    setDownloading(true);
    try {
      if (fileBlob) {
        downloadBlob(fileBlob, attachment.fileName || "document.pdf");
        return;
      }
      if (!attachment.storageKey) {
        throw new Error("فایل قابل دانلود نیست");
      }
      await downloadStoredFile(attachment.storageKey, attachment.fileName);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "دانلود ناموفق بود");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <figure className="space-y-3">
      <div className="overflow-hidden rounded-sm border border-border/60 bg-muted/30">
        {loading ? (
          <div className="flex h-[min(82vh,920px)] flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">در حال آماده‌سازی سند…</p>
          </div>
        ) : error || !blobUrl ? (
          <div className="flex h-[min(50vh,480px)] flex-col items-center justify-center gap-4 px-6 text-center">
            <FileWarning className="h-10 w-10 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">پیش‌نمایش در دسترس نیست</p>
              <p className="text-xs text-muted-foreground">
                فایل را دانلود کنید تا بتوانید آن را بخوانید.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onDownload()}
              disabled={downloading || !attachment.storageKey}
            >
              <Download className="ml-1.5 h-3.5 w-3.5" />
              {downloading ? "در حال دانلود…" : "دانلود PDF"}
            </Button>
          </div>
        ) : (
          <iframe
            key={blobUrl}
            src={`${blobUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
            title={attachment.fileName}
            className="h-[min(82vh,920px)] w-full bg-background"
          />
        )}
      </div>
      <figcaption className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="truncate">{attachment.fileName}</span>
        <button
          type="button"
          onClick={() => void onDownload()}
          disabled={downloading || (!fileBlob && !attachment.storageKey)}
          className="inline-flex items-center gap-1.5 hover:text-foreground disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          {downloading ? "…" : "دانلود"}
        </button>
      </figcaption>
    </figure>
  );
}
