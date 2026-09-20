"use client";

import { useEffect, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Trash2, Send } from "lucide-react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { hasPermission, isFullAccessRole } from "@/lib/rbac";
import { useMeQuery } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ErrorState } from "@/components/loading/error-state";
import { VideoStorageHeader } from "./_components/video-storage-header";
import { VideoStorageStatsBar } from "./_components/video-storage-stats";
import { VideoStorageToolbar } from "./_components/video-storage-toolbar";
import { VideoStorageGrid } from "./_components/video-storage-grid";
import { VideoStorageEmptyState } from "./_components/video-storage-empty";
import { VideoStorageSkeleton } from "./_components/video-storage-skeleton";
import { VideoUploadDialog } from "./_components/video-upload-dialog";
import { VideoEditDialog } from "./_components/video-edit-dialog";
import { VideoPreviewDialog } from "./_components/video-preview-dialog";
import type {
  PortfolioFilter,
  PublishedFilter,
  VideoStorageItem,
  VideoStorageListPayload,
  VideoStorageStats,
  VideoUploaderOption,
} from "./_components/types";

const PAGE_SIZE = 12;

export default function VideoStoragePage() {
  const qc = useQueryClient();
  const { data: me } = useMeQuery();
  const isManager = isFullAccessRole(me?.role);
  const canUpload = hasPermission(
    me?.permissions,
    "video_storage.upload",
    me?.role,
  );
  const canEdit = hasPermission(
    me?.permissions,
    "video_storage.edit",
    me?.role,
  );
  const canDelete = hasPermission(
    me?.permissions,
    "video_storage.delete",
    me?.role,
  );
  const canSendPortfolio = hasPermission(
    me?.permissions,
    "video_storage.send_portfolio",
    me?.role,
  );

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [portfolio, setPortfolio] = useState<PortfolioFilter>("ALL");
  const [published, setPublished] = useState<PublishedFilter>("ALL");
  const [uploaderId, setUploaderId] = useState("ALL");
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preview, setPreview] = useState<VideoStorageItem | null>(null);
  const [editItem, setEditItem] = useState<VideoStorageItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<VideoStorageItem | null>(null);
  const [sendItem, setSendItem] = useState<VideoStorageItem | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const statsQ = useQuery({
    queryKey: ["video-storage-stats"],
    queryFn: () => apiGet<VideoStorageStats>("/video-storage/stats"),
    staleTime: 30_000,
  });

  const uploadersQ = useQuery({
    queryKey: ["video-storage-uploaders"],
    queryFn: () => apiGet<VideoUploaderOption[]>("/video-storage/uploaders"),
    enabled: isManager,
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: ["video-storage", q, portfolio, published, uploaderId, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (portfolio !== "ALL") params.set("portfolio", portfolio);
      if (published !== "ALL") params.set("published", published);
      if (isManager && uploaderId !== "ALL") params.set("uploaderId", uploaderId);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      return apiGet<VideoStorageListPayload>(
        `/video-storage?${params.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });

  const items = listQ.data?.items || [];
  const total = listQ.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters =
    Boolean(q) ||
    portfolio !== "ALL" ||
    published !== "ALL" ||
    uploaderId !== "ALL";

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["video-storage"] });
    qc.invalidateQueries({ queryKey: ["video-storage-stats"] });
    qc.invalidateQueries({ queryKey: ["video-storage-uploaders"] });
    qc.invalidateQueries({ queryKey: ["portfolio-admin"] });
    qc.invalidateQueries({ queryKey: ["portfolio-admin-stats"] });
  }

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/video-storage/${id}`),
    onSuccess: () => {
      toast.success("ویدیو حذف شد");
      invalidateAll();
      setDeleteItem(null);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "حذف ناموفق بود"),
  });

  const sendMut = useMutation({
    mutationFn: (id: string) =>
      apiPost<VideoStorageItem>(`/video-storage/${id}/send-to-portfolio`, {}),
    onSuccess: () => {
      toast.success("ویدیو به نمونه‌کارها ارسال شد");
      invalidateAll();
      setSendItem(null);
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "ارسال به نمونه‌کارها ناموفق بود",
      ),
  });

  return (
    <div className="space-y-6 text-start" dir="rtl">
      <VideoStorageHeader
        canUpload={canUpload}
        onUpload={() => setUploadOpen(true)}
      />

      <VideoStorageStatsBar
        stats={statsQ.data}
        loading={statsQ.isLoading}
      />

      <VideoStorageToolbar
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        portfolio={portfolio}
        onPortfolioChange={(v) => {
          setPortfolio(v);
          setPage(1);
        }}
        published={published}
        onPublishedChange={(v) => {
          setPublished(v);
          setPage(1);
        }}
        uploaderId={uploaderId}
        onUploaderChange={(v) => {
          setUploaderId(v);
          setPage(1);
        }}
        uploaders={uploadersQ.data || []}
        showUploaderFilter={isManager}
      />

      {listQ.isError ? (
        <ErrorState
          title="بارگذاری ویدیوها ناموفق بود"
          onRetry={() => listQ.refetch()}
        />
      ) : listQ.isLoading ? (
        <VideoStorageSkeleton />
      ) : items.length === 0 ? (
        <VideoStorageEmptyState
          hasFilters={hasFilters}
          canUpload={canUpload}
          onUpload={() => setUploadOpen(true)}
          onClearFilters={() => {
            setSearchInput("");
            setQ("");
            setPortfolio("ALL");
            setPublished("ALL");
            setUploaderId("ALL");
            setPage(1);
          }}
        />
      ) : (
        <>
          <VideoStorageGrid
            items={items}
            showOwner={isManager}
            canEdit={canEdit}
            canDelete={canDelete}
            canSendPortfolio={canSendPortfolio}
            sendPendingId={sendMut.isPending ? sendMut.variables : null}
            onPreview={setPreview}
            onEdit={setEditItem}
            onDelete={setDeleteItem}
            onSendPortfolio={setSendItem}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {total} ویدیو · صفحه {page} از {pageCount}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={page <= 1 || listQ.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronRight className="h-4 w-4" />
                قبلی
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={page >= pageCount || listQ.isFetching}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                بعدی
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {listQ.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : null}
            </div>
          </div>
        </>
      )}

      <VideoUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onCreated={() => invalidateAll()}
      />

      <VideoEditDialog
        item={editItem}
        open={Boolean(editItem)}
        onOpenChange={(open) => {
          if (!open) setEditItem(null);
        }}
        canSetReviewStatus={isManager}
        onUpdated={() => invalidateAll()}
      />

      <VideoPreviewDialog
        item={preview}
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        showOwner={isManager}
      />

      <Dialog
        open={Boolean(deleteItem)}
        onOpenChange={(open) => {
          if (!open) setDeleteItem(null);
        }}
      >
        <DialogContent className="text-start sm:max-w-md" dir="rtl">
          <DialogHeader className="text-start">
            <DialogTitle>حذف ویدیو</DialogTitle>
            <DialogDescription>
              آیا مطمئن هستید که می‌خواهید این ویدیو را حذف کنید؟ این عملیات قابل
              بازگشت نیست.
              {deleteItem?.inPortfolio
                ? " در صورت وجود، از نمونه‌کارها و وبسایت عمومی نیز حذف خواهد شد."
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="destructive"
              className="rounded-xl gap-1.5"
              disabled={deleteMut.isPending}
              onClick={() => deleteItem && deleteMut.mutate(deleteItem.id)}
            >
              {deleteMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              حذف
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={deleteMut.isPending}
              onClick={() => setDeleteItem(null)}
            >
              انصراف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(sendItem)}
        onOpenChange={(open) => {
          if (!open) setSendItem(null);
        }}
      >
        <DialogContent className="text-start sm:max-w-md" dir="rtl">
          <DialogHeader className="text-start">
            <DialogTitle>ارسال به نمونه‌کارها</DialogTitle>
            <DialogDescription>
              آیا می‌خواهید این ویدیو را به نمونه‌کارها ارسال کنید؟ پس از ارسال
              می‌توانید آن را از صفحه نمونه‌کارها در وبسایت عمومی منتشر کنید.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="brand"
              className="rounded-xl gap-1.5"
              disabled={sendMut.isPending}
              onClick={() => sendItem && sendMut.mutate(sendItem.id)}
            >
              {sendMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              تأیید ارسال
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={sendMut.isPending}
              onClick={() => setSendItem(null)}
            >
              انصراف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
