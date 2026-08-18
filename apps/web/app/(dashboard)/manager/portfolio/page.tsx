"use client";

import { useEffect, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPatch } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { useMeQuery } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { PortfolioHeader } from "./_components/portfolio-header";
import { PortfolioStats } from "./_components/portfolio-stats";
import { PortfolioToolbar } from "./_components/portfolio-toolbar";
import { PortfolioGrid } from "./_components/portfolio-grid";
import { PortfolioPreview } from "./_components/portfolio-preview";
import { PortfolioEmptyState } from "./_components/portfolio-empty-state";
import { PortfolioSkeleton } from "./_components/portfolio-skeleton";
import { PortfolioVideoForm } from "./_components/portfolio-video-form";
import { MixedPortfolioManager } from "./_components/mixed-portfolio-manager";
import { CategoryManager } from "./_components/category-manager";
import type {
  PortfolioAdminCategory,
  PortfolioAdminItem,
  PortfolioListPayload,
  PortfolioMixedFilter,
  PortfolioStats as PortfolioStatsType,
  PortfolioStatusFilter,
} from "./_components/types";

const PAGE_SIZE = 12;

export default function PortfolioAdminPage() {
  const qc = useQueryClient();
  const { data: me } = useMeQuery();
  const canPublish = hasPermission(me?.permissions, "portfolio.publish", me?.role);
  const canEdit = hasPermission(me?.permissions, "portfolio.edit", me?.role);
  const canDelete = hasPermission(me?.permissions, "portfolio.delete", me?.role);

  const [tab, setTab] = useState("videos");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<PortfolioStatusFilter>("ALL");
  const [categoryId, setCategoryId] = useState("ALL");
  const [mixed, setMixed] = useState<PortfolioMixedFilter>("ALL");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<PortfolioAdminItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<PortfolioAdminItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<PortfolioAdminItem | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const categoriesQ = useQuery({
    queryKey: ["portfolio-categories"],
    queryFn: () => apiGet<PortfolioAdminCategory[]>("/portfolio/categories"),
  });

  const statsQ = useQuery({
    queryKey: ["portfolio-admin-stats"],
    queryFn: () => apiGet<PortfolioStatsType>("/portfolio/stats"),
  });

  const listQ = useQuery({
    queryKey: ["portfolio-admin", q, status, categoryId, mixed, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status !== "ALL") params.set("status", status);
      if (categoryId !== "ALL") params.set("categoryId", categoryId);
      if (mixed === "IN") params.set("mixed", "true");
      if (mixed === "OUT") params.set("mixed", "false");
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      return apiGet<PortfolioListPayload>(`/portfolio?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  const items = listQ.data?.items || [];
  const total = listQ.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasQuery =
    Boolean(q) || status !== "ALL" || categoryId !== "ALL" || mixed !== "ALL";
  const categories = categoriesQ.data || [];

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["portfolio-admin"] });
    qc.invalidateQueries({ queryKey: ["portfolio-admin-stats"] });
    qc.invalidateQueries({ queryKey: ["portfolio-categories"] });
    qc.invalidateQueries({ queryKey: ["portfolio-mixed"] });
    qc.invalidateQueries({ queryKey: ["public-portfolio"] });
    qc.invalidateQueries({ queryKey: ["public-portfolio-tabs"] });
  }

  const updateMut = useMutation({
    mutationFn: (payload: {
      id: string;
      status?: "PUBLISHED" | "UNPUBLISHED";
    }) => apiPatch(`/portfolio/${payload.id}`, { status: payload.status }),
    onSuccess: () => {
      toast.success("وضعیت نمونه‌کار به‌روزرسانی شد");
      invalidateAll();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "به‌روزرسانی ناموفق بود"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/portfolio/${id}`),
    onSuccess: () => {
      toast.success("نمونه‌کار حذف شد");
      invalidateAll();
      setDeleteItem(null);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "حذف ناموفق بود"),
  });

  return (
    <div className="space-y-6 text-start" dir="rtl">
      <PortfolioHeader
        canCreate={canPublish}
        onCreate={() => {
          setEditItem(null);
          setFormOpen(true);
        }}
      />

      <PortfolioStats
        stats={
          statsQ.data || { total: 0, published: 0, categories: 0, mixed: 0 }
        }
        loading={statsQ.isLoading}
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList
          variant="line"
          className="w-full justify-start overflow-x-auto"
          dir="rtl"
        >
          <TabsTrigger variant="line" value="videos">
            ویدیوها
          </TabsTrigger>
          <TabsTrigger variant="line" value="mixed">
            مدیریت مختلط
          </TabsTrigger>
          <TabsTrigger variant="line" value="categories">
            مدیریت کتگوری ها
          </TabsTrigger>
        </TabsList>

        <TabsContent value="videos" className="space-y-5">
          <PortfolioToolbar
            search={searchInput}
            onSearchChange={setSearchInput}
            status={status}
            onStatusChange={(next) => {
              setStatus(next);
              setPage(1);
            }}
            categoryId={categoryId}
            onCategoryChange={(next) => {
              setCategoryId(next);
              setPage(1);
            }}
            mixed={mixed}
            onMixedChange={(next) => {
              setMixed(next);
              setPage(1);
            }}
            categories={categories}
          />

          {listQ.isLoading ? <PortfolioSkeleton /> : null}

          {listQ.isError ? (
            <ErrorState
              title="دریافت نمونه‌کارها با مشکل مواجه شد"
              onRetry={() => void listQ.refetch()}
            />
          ) : null}

          {!listQ.isLoading && !listQ.isError && items.length === 0 ? (
            <PortfolioEmptyState
              hasQuery={hasQuery}
              canCreate={canPublish}
              onCreate={() => {
                setEditItem(null);
                setFormOpen(true);
              }}
            />
          ) : null}

          {items.length > 0 ? (
            <div
              className={
                listQ.isFetching && !listQ.isLoading
                  ? "space-y-5 opacity-70 transition-opacity"
                  : "space-y-5"
              }
            >
              <PortfolioGrid
                items={items}
                canEdit={canEdit}
                canDelete={canDelete}
                publishPendingId={
                  updateMut.isPending ? updateMut.variables?.id ?? null : null
                }
                onPreview={setPreview}
                onEdit={(item) => {
                  setEditItem(item);
                  setFormOpen(true);
                }}
                onTogglePublish={(item) =>
                  updateMut.mutate({
                    id: item.id,
                    status:
                      item.status === "PUBLISHED" ? "UNPUBLISHED" : "PUBLISHED",
                  })
                }
                onDelete={setDeleteItem}
              />
              {total > PAGE_SIZE ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-3 py-2 text-sm" dir="rtl">
                  <p className="text-start text-muted-foreground">
                    {total} مورد · صفحه {page} از {pageCount}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-label="صفحه قبل"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page >= pageCount}
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                      aria-label="صفحه بعد"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="mixed">
          <MixedPortfolioManager categories={categories} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="categories">
          <CategoryManager categories={categories} canEdit={canEdit} />
        </TabsContent>
      </Tabs>

      <PortfolioPreview
        item={preview}
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      />

      <PortfolioVideoForm
        open={formOpen}
        item={editItem}
        categories={categories.filter((category) => category.isActive)}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditItem(null);
        }}
        onSaved={invalidateAll}
      />

      <Dialog
        open={!!deleteItem}
        onOpenChange={(o) => !o && !deleteMut.isPending && setDeleteItem(null)}
      >
        <DialogContent className="text-start sm:max-w-md" dir="rtl">
          <DialogHeader className="text-start">
            <DialogTitle>حذف نمونه‌کار</DialogTitle>
            <DialogDescription className="leading-6">
              «{deleteItem?.title}» از وب‌سایت عمومی حذف می‌شود. فایل‌های پروژه
              اصلی باقی می‌مانند.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="outline"
              disabled={deleteMut.isPending}
              onClick={() => setDeleteItem(null)}
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              disabled={deleteMut.isPending}
              onClick={() => deleteItem && deleteMut.mutate(deleteItem.id)}
            >
              {deleteMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              حذف نمونه‌کار
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
