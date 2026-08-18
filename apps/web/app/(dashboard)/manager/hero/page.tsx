"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPatch, ensureCsrf } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { useMeQuery } from "@/lib/permissions";
import type { HeroSlide, HeroSlideListResponse } from "@/lib/hero";
import { ErrorState } from "@/components/loading/error-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HeroSlidesHeader } from "./_components/hero-slides-header";
import { HeroSlidesStats } from "./_components/hero-slides-stats";
import { HeroSlidesToolbar } from "./_components/hero-slides-toolbar";
import { HeroSlidesSkeleton } from "./_components/hero-slides-skeleton";
import { HeroSlidesEmptyState } from "./_components/hero-slides-empty-state";
import { HeroSlideList } from "./_components/hero-slide-list";
import { HeroSlideForm } from "./_components/hero-slide-form";
import { HeroSlidePreview } from "./_components/hero-slide-preview";
import type { HeroStatusFilter } from "./_components/types";

export default function HeroSlidesManagerPage() {
  const qc = useQueryClient();
  const { data: me } = useMeQuery();
  const canCreate = hasPermission(me?.permissions, "hero.create", me?.role);
  const canEdit = hasPermission(me?.permissions, "hero.edit", me?.role);
  const canDelete = hasPermission(me?.permissions, "hero.delete", me?.role);

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<HeroStatusFilter>("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HeroSlide | null>(null);
  const [preview, setPreview] = useState<HeroSlide | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HeroSlide | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQ(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const listQ = useQuery({
    queryKey: ["hero-admin", q, status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status !== "ALL") params.set("status", status);
      params.set("pageSize", "100");
      return apiGet<HeroSlideListResponse>(`/hero?${params.toString()}`);
    },
  });

  const items = listQ.data?.items || [];
  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [items],
  );
  const hasQuery = Boolean(q) || status !== "ALL";
  const reorderEnabled = !hasQuery;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["hero-admin"] });
    qc.invalidateQueries({ queryKey: ["public-hero"] });
  };

  const publishMut = useMutation({
    mutationFn: async ({
      id,
      isPublished,
    }: {
      id: string;
      isPublished: boolean;
    }) => {
      await ensureCsrf();
      return apiPatch(`/hero/${id}/publish`, { isPublished });
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.isPublished ? "اسلاید فعال شد" : "اسلاید غیرفعال شد");
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "تغییر وضعیت ناموفق بود"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await ensureCsrf();
      return apiDelete(`/hero/${id}`);
    },
    onSuccess: () => {
      toast.success("اسلاید حذف شد");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "حذف اسلاید ناموفق بود"),
  });

  const reorderMut = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await ensureCsrf();
      return apiPatch("/hero/reorder", { orderedIds });
    },
    onSuccess: () => {
      toast.success("ترتیب نمایش به‌روزرسانی شد");
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "تغییر ترتیب ناموفق بود"),
  });

  function applyOrder(nextIds: string[]) {
    reorderMut.mutate(nextIds);
  }

  function move(id: string, direction: -1 | 1) {
    const ids = sorted.map((s) => s.id);
    const idx = ids.indexOf(id);
    const next = idx + direction;
    if (idx < 0 || next < 0 || next >= ids.length) return;
    const copy = [...ids];
    const [item] = copy.splice(idx, 1);
    copy.splice(next, 0, item);
    applyOrder(copy);
  }

  function reorder(fromId: string, toId: string) {
    const ids = sorted.map((s) => s.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0 || from === to) return;
    const copy = [...ids];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    applyOrder(copy);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6" dir="rtl">
      <HeroSlidesHeader canCreate={canCreate} onCreate={openCreate} />

      <HeroSlidesStats
        stats={{
          total:
            (listQ.data?.published ?? 0) + (listQ.data?.unpublished ?? 0),
          published: listQ.data?.published ?? 0,
          unpublished: listQ.data?.unpublished ?? 0,
        }}
        loading={listQ.isLoading}
      />

      <HeroSlidesToolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        status={status}
        onStatusChange={setStatus}
      />

      {hasQuery ? null : sorted.length > 1 && canEdit ? (
        <p className="text-xs text-muted-foreground">
          برای تغییر ترتیب، اسلاید را بکشید و رها کنید یا از دکمه‌های بالا/پایین
          استفاده کنید.
        </p>
      ) : null}

      {listQ.isLoading ? <HeroSlidesSkeleton /> : null}

      {listQ.isError ? (
        <ErrorState
          title="بارگذاری اسلایدها ناموفق بود"
          description="لطفاً دوباره تلاش کنید."
          onRetry={() => listQ.refetch()}
        />
      ) : null}

      {!listQ.isLoading && !listQ.isError && sorted.length === 0 ? (
        <HeroSlidesEmptyState
          hasQuery={hasQuery}
          canCreate={canCreate}
          onCreate={openCreate}
        />
      ) : null}

      {sorted.length > 0 ? (
        <div
          className={
            listQ.isFetching && !listQ.isLoading
              ? "opacity-70 transition-opacity"
              : ""
          }
        >
          <HeroSlideList
            items={sorted}
            canEdit={canEdit}
            canDelete={canDelete}
            reorderEnabled={reorderEnabled && !reorderMut.isPending}
            pendingId={
              publishMut.isPending ? publishMut.variables?.id ?? null : null
            }
            onPreview={setPreview}
            onEdit={(item) => {
              setEditing(item);
              setFormOpen(true);
            }}
            onTogglePublish={(item) =>
              publishMut.mutate({
                id: item.id,
                isPublished: !item.isPublished,
              })
            }
            onDelete={setDeleteTarget}
            onMove={move}
            onReorder={reorder}
          />
        </div>
      ) : null}

      <HeroSlideForm
        open={formOpen}
        onOpenChange={setFormOpen}
        slide={editing}
        onSaved={invalidate}
      />

      <HeroSlidePreview
        slide={preview}
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && !deleteMut.isPending && setDeleteTarget(null)}
      >
        <DialogContent className="text-start sm:max-w-md" dir="rtl">
          <DialogHeader className="text-start">
            <DialogTitle>حذف اسلاید</DialogTitle>
            <DialogDescription className="leading-6">
              اسلاید «{deleteTarget?.title}» و تصویر مرتبط آن حذف می‌شود و از
              وب‌سایت عمومی برداشته خواهد شد. این عمل به‌سادگی قابل بازگشت نیست.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="outline"
              disabled={deleteMut.isPending}
              onClick={() => setDeleteTarget(null)}
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              disabled={deleteMut.isPending || !deleteTarget}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              {deleteMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              حذف اسلاید
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
