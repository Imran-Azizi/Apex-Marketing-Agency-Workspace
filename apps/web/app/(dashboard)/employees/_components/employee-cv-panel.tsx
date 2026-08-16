"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPatch, ApiError } from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import {
  authenticatedRawFileUrl,
  downloadStoredFile,
  fetchAuthenticatedFileBlobUrl,
  formatFileSize,
  uploadFileWithProgress,
} from "@/lib/upload";
import { UPLOAD_PURPOSE } from "@/lib/media-manager";
import { UploadProgress } from "@/components/loading/upload-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Employee } from "./types";

const CV_ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const CV_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const CV_EXT = /\.(pdf|doc|docx)$/i;
const MAX_CV_BYTES = 10 * 1024 * 1024;
const ZOOM_STEPS = [75, 100, 125, 150, 175, 200];

function isAllowedCv(file: File) {
  return CV_MIME.has(file.type) || CV_EXT.test(file.name);
}

function isPdfCv(mime?: string | null, fileName?: string | null) {
  const type = (mime || "").toLowerCase();
  const name = (fileName || "").toLowerCase();
  return type.includes("pdf") || name.endsWith(".pdf");
}

function cvTypeLabel(mime?: string | null, fileName?: string | null) {
  const name = (fileName || "").toLowerCase();
  const type = (mime || "").toLowerCase();
  if (type.includes("pdf") || name.endsWith(".pdf")) return "PDF";
  if (name.endsWith(".docx") || type.includes("wordprocessingml")) return "DOCX";
  if (name.endsWith(".doc") || type.includes("msword")) return "DOC";
  return "فایل";
}

type Props = {
  employee: Employee;
  currentUserId?: string | null;
};

export function EmployeeCvPanel({ employee, currentUserId }: Props) {
  const queryClient = useQueryClient();
  const cvRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [page, setPage] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cvUploading, setCvUploading] = useState(false);
  const [cvUploadPct, setCvUploadPct] = useState(0);
  const [cvUploadName, setCvUploadName] = useState("");
  const [cvDownloading, setCvDownloading] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const hasCv = Boolean(employee.cvStorageKey);
  const pdf = isPdfCv(employee.cvMimeType, employee.cvFileName);
  const typeLabel = cvTypeLabel(employee.cvMimeType, employee.cvFileName);

  const openUrl = useMemo(
    () =>
      employee.cvStorageKey
        ? authenticatedRawFileUrl(employee.cvStorageKey)
        : null,
    [employee.cvStorageKey],
  );

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function resolvePreview() {
      if (!employee.cvStorageKey) {
        setPreviewUrl(null);
        setPreviewError(false);
        setPreviewLoading(false);
        return;
      }

      setPreviewLoading(true);
      setPreviewError(false);

      const next = await fetchAuthenticatedFileBlobUrl(
        employee.cvStorageKey,
        employee.cvMimeType || (pdf ? "application/pdf" : null),
      );

      if (cancelled) {
        if (next?.startsWith("blob:")) URL.revokeObjectURL(next);
        return;
      }

      if (!next) {
        setPreviewUrl(null);
        setPreviewError(true);
        setPreviewLoading(false);
        return;
      }

      objectUrl = next;
      setPreviewUrl(next);
      setPreviewLoading(false);
    }

    void resolvePreview();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [employee.cvStorageKey, employee.cvMimeType, pdf]);

  useEffect(() => {
    setZoom(100);
    setPage(1);
  }, [employee.cvStorageKey]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const invalidateCaches = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["employee", employee.id] }),
      queryClient.invalidateQueries({ queryKey: ["employees"] }),
      currentUserId === employee.id
        ? queryClient.invalidateQueries({ queryKey: ["me"] })
        : Promise.resolve(),
    ]);
  };

  const saveCvMut = useMutation({
    mutationFn: (payload: {
      cvStorageKey: string | null;
      cvFileName?: string | null;
      cvMimeType?: string | null;
      cvSizeBytes?: number | null;
      cvUploadedAt?: string | null;
    }) => apiPatch<Employee>(`/employees/${employee.id}`, payload),
    onSuccess: async () => {
      await invalidateCaches();
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : "ذخیره رزومه ناموفق بود",
      );
    },
  });

  const busy = cvUploading || saveCvMut.isPending || cvDownloading;
  const viewHref = previewUrl || openUrl;

  const pdfSrc = useMemo(() => {
    if (!previewUrl || !pdf) return null;
    const base = previewUrl.split("#")[0];
    return `${base}#toolbar=0&navpanes=0&scrollbar=1&page=${page}&zoom=${zoom}`;
  }, [previewUrl, pdf, page, zoom]);

  const zoomIn = () => {
    const idx = ZOOM_STEPS.findIndex((step) => step > zoom);
    setZoom(idx === -1 ? ZOOM_STEPS[ZOOM_STEPS.length - 1] : ZOOM_STEPS[idx]);
  };

  const zoomOut = () => {
    const idx = [...ZOOM_STEPS].reverse().findIndex((step) => step < zoom);
    const ordered = [...ZOOM_STEPS].reverse();
    setZoom(idx === -1 ? ZOOM_STEPS[0] : ordered[idx]);
  };

  const toggleFullscreen = async () => {
    const el = viewerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      toast.error("ورود به حالت تمام‌صفحه ممکن نیست");
    }
  };

  const onPickCv = async (file: File | undefined) => {
    if (!file) return;
    if (!isAllowedCv(file)) {
      toast.error("فقط فایل‌های PDF، DOC یا DOCX مجاز هستند");
      return;
    }
    if (file.size > MAX_CV_BYTES) {
      toast.error("حجم رزومه نباید بیشتر از ۱۰ مگابایت باشد");
      return;
    }

    try {
      setCvUploading(true);
      setCvUploadPct(0);
      setCvUploadName(file.name);
      const uploaded = await uploadFileWithProgress(
        file,
        {
          purpose: UPLOAD_PURPOSE.EMPLOYEE_CV,
          userId: employee.id,
        },
        (percent) => setCvUploadPct(percent),
      );
      setCvUploadPct(100);
      await saveCvMut.mutateAsync({
        cvStorageKey: uploaded.key,
        cvFileName: uploaded.name || file.name,
        cvMimeType: uploaded.mimeType || file.type || null,
        cvSizeBytes: uploaded.sizeBytes || file.size,
        cvUploadedAt: new Date().toISOString(),
      });
      toast.success(
        employee.cvStorageKey
          ? "رزومه با موفقیت جایگزین شد"
          : "رزومه با موفقیت آپلود شد",
      );
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "آپلود رزومه ناموفق بود",
      );
    } finally {
      setCvUploading(false);
      setCvUploadPct(0);
      setCvUploadName("");
      if (cvRef.current) cvRef.current.value = "";
    }
  };

  const onDownloadCv = async () => {
    if (!employee.cvStorageKey) return;
    try {
      setCvDownloading(true);
      await downloadStoredFile(
        employee.cvStorageKey,
        employee.cvFileName || "resume.pdf",
      );
      toast.success("دانلود رزومه آغاز شد");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "دانلود رزومه ناموفق بود",
      );
    } finally {
      setCvDownloading(false);
    }
  };

  const onConfirmRemove = async () => {
    try {
      await saveCvMut.mutateAsync({
        cvStorageKey: null,
        cvFileName: null,
        cvMimeType: null,
        cvSizeBytes: null,
        cvUploadedAt: null,
      });
      setRemoveOpen(false);
      toast.success("رزومه حذف شد");
    } catch {
      /* toast handled in mutation */
    }
  };

  return (
    <>
      <Card className="overflow-hidden border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <CardContent className="p-0" dir="rtl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold sm:text-base">
                    رزومه / CV
                  </h2>
                  {hasCv ? (
                    <Badge variant="success" className="rounded-full px-2 py-0 text-[10px]">
                      ثبت‌شده
                    </Badge>
                  ) : null}
                </div>
                {hasCv ? (
                  <p
                    className="mt-0.5 truncate text-xs text-muted-foreground"
                    title={employee.cvFileName || undefined}
                  >
                    {employee.cvFileName || "فایل رزومه"}
                    <span className="mx-1.5 text-border">·</span>
                    {typeLabel}
                    {employee.cvSizeBytes != null ? (
                      <>
                        <span className="mx-1.5 text-border">·</span>
                        {formatFileSize(employee.cvSizeBytes)}
                      </>
                    ) : null}
                    {employee.cvUploadedAt ? (
                      <>
                        <span className="mx-1.5 text-border">·</span>
                        {formatDateTime(employee.cvUploadedAt)}
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    PDF، DOC یا DOCX · حداکثر ۱۰ مگابایت
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {hasCv ? (
                <>
                  {viewHref ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      asChild
                      disabled={busy}
                      className="h-8 rounded-full px-3"
                    >
                      <a href={viewHref} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                        مشاهده
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={onDownloadCv}
                    className="h-8 rounded-full px-3"
                  >
                    {cvDownloading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    دانلود
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => cvRef.current?.click()}
                    className="h-8 rounded-full px-3"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    جایگزینی
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    onClick={() => setRemoveOpen(true)}
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                    aria-label="حذف رزومه"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="brand"
                  size="sm"
                  disabled={busy}
                  onClick={() => cvRef.current?.click()}
                  className="h-8 rounded-full px-3"
                >
                  <Upload className="h-3.5 w-3.5" />
                  آپلود رزومه
                </Button>
              )}
            </div>
          </div>

          <input
            ref={cvRef}
            type="file"
            accept={CV_ACCEPT}
            className="hidden"
            onChange={(e) => onPickCv(e.target.files?.[0])}
          />

          {!hasCv ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
                <FileText className="h-5 w-5" />
              </span>
              <p className="text-sm text-muted-foreground">
                رزومه‌ای ثبت نشده است
              </p>
            </div>
          ) : (
            <div
              ref={viewerRef}
              className={cn(
                "bg-muted/20",
                isFullscreen && "bg-background",
              )}
            >
              {pdf ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 bg-background/80 px-3 py-1.5 backdrop-blur-sm">
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={!previewUrl || previewLoading || page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        aria-label="صفحه قبل"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                      <span className="min-w-14 text-center text-[11px] tabular-nums text-muted-foreground">
                        {page}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={!previewUrl || previewLoading}
                        onClick={() => setPage((p) => p + 1)}
                        aria-label="صفحه بعد"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={!previewUrl || previewLoading}
                        onClick={zoomOut}
                        aria-label="کوچک‌نمایی"
                      >
                        <ZoomOut className="h-3.5 w-3.5" />
                      </Button>
                      <span className="min-w-10 text-center text-[11px] tabular-nums text-muted-foreground">
                        {zoom}٪
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={!previewUrl || previewLoading}
                        onClick={zoomIn}
                        aria-label="بزرگ‌نمایی"
                      >
                        <ZoomIn className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={!previewUrl || previewLoading}
                        onClick={toggleFullscreen}
                        aria-label={
                          isFullscreen ? "خروج از تمام‌صفحه" : "تمام‌صفحه"
                        }
                      >
                        {isFullscreen ? (
                          <Minimize2 className="h-3.5 w-3.5" />
                        ) : (
                          <Maximize2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "relative",
                      isFullscreen
                        ? "h-[calc(100vh-2.75rem)]"
                        : "h-[min(68vh,36rem)]",
                    )}
                  >
                    {previewLoading ? (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          در حال بارگذاری...
                        </p>
                      </div>
                    ) : null}

                    {previewError || !pdfSrc ? (
                      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                        <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                        <p className="max-w-sm text-sm text-muted-foreground">
                          پیش‌نمایش در دسترس نیست. فایل را مشاهده یا دانلود کنید.
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {viewHref ? (
                            <Button variant="outline" size="sm" asChild>
                              <a
                                href={viewHref}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                مشاهده
                              </a>
                            </Button>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={onDownloadCv}
                            disabled={busy}
                          >
                            <Download className="h-3.5 w-3.5" />
                            دانلود
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <iframe
                        key={pdfSrc}
                        title={employee.cvFileName || "پیش‌نمایش رزومه"}
                        src={pdfSrc}
                        className="h-full w-full border-0 bg-muted/10"
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
                    <FileText className="h-6 w-6" />
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      پیش‌نمایش {typeLabel} در مرورگر پشتیبانی نمی‌شود
                    </p>
                    <p className="text-xs text-muted-foreground">
                      برای مشاهده، فایل را باز یا دانلود کنید.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {viewHref ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={viewHref} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                          مشاهده
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      variant="brand"
                      size="sm"
                      onClick={onDownloadCv}
                      disabled={busy}
                    >
                      <Download className="h-3.5 w-3.5" />
                      دانلود
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {cvUploading ? (
            <div className="border-t border-border/40 px-4 py-3 sm:px-5">
              <UploadProgress
                fileName={cvUploadName}
                progress={cvUploadPct}
                status="uploading"
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle>حذف رزومه</DialogTitle>
            <DialogDescription>
              آیا از حذف رزومه «{employee.cvFileName || "این کارمند"}» مطمئن
              هستید؟ این عمل قابل بازگشت نیست.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setRemoveOpen(false)}
              disabled={saveCvMut.isPending}
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirmRemove}
              disabled={saveCvMut.isPending}
              isLoading={saveCvMut.isPending}
              loadingText="در حال حذف..."
            >
              بله، حذف شود
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
