"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPatch, ensureCsrf } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { useMeQuery } from "@/lib/permissions";
import type {
  ShowcaseCustomer,
  ShowcaseCustomerListResponse,
} from "@/lib/customers";
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
import { CustomersHeader } from "./_components/customers-header";
import { CustomersStats } from "./_components/customers-stats";
import { CustomersToolbar } from "./_components/customers-toolbar";
import { CustomersSkeleton } from "./_components/customers-skeleton";
import { CustomersEmptyState } from "./_components/customers-empty-state";
import { CustomerList } from "./_components/customer-list";
import { CustomerForm } from "./_components/customer-form";
import { CustomerPreview } from "./_components/customer-preview";
import type { CustomerStatusFilter } from "./_components/types";

export default function CustomersManagerPage() {
  const qc = useQueryClient();
  const { data: me } = useMeQuery();
  const canCreate = hasPermission(me?.permissions, "customers.create", me?.role);
  const canEdit = hasPermission(me?.permissions, "customers.edit", me?.role);
  const canDelete = hasPermission(
    me?.permissions,
    "customers.delete",
    me?.role,
  );

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<CustomerStatusFilter>("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ShowcaseCustomer | null>(null);
  const [preview, setPreview] = useState<ShowcaseCustomer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShowcaseCustomer | null>(
    null,
  );

  useEffect(() => {
    const timer = setTimeout(() => setQ(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const listQ = useQuery({
    queryKey: ["customers-admin", q, status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status !== "ALL") params.set("status", status);
      params.set("pageSize", "100");
      return apiGet<ShowcaseCustomerListResponse>(
        `/customers?${params.toString()}`,
      );
    },
  });

  const items = listQ.data?.items || [];
  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [items],
  );
  const hasQuery = Boolean(q) || status !== "ALL";
  const reorderEnabled = !hasQuery;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["customers-admin"] });
    qc.invalidateQueries({ queryKey: ["public-customers"] });
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
      return apiPatch(`/customers/${id}/publish`, { isPublished });
    },
    onSuccess: (_d, vars) => {
      toast.success(
        vars.isPublished
          ? "مشتری در وبسایت نمایش داده می‌شود"
          : "مشتری از وبسایت مخفی شد",
      );
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "تغییر وضعیت ناموفق بود"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await ensureCsrf();
      return apiDelete(`/customers/${id}`);
    },
    onSuccess: () => {
      toast.success("مشتری حذف شد");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "حذف مشتری ناموفق بود"),
  });

  const reorderMut = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await ensureCsrf();
      return apiPatch("/customers/reorder", { orderedIds });
    },
    onSuccess: () => {
      toast.success("ترتیب نمایش به‌روزرسانی شد");
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "تغییر ترتیب ناموفق بود"),
  });

  function reorder(fromId: string, toId: string) {
    const ids = sorted.map((s) => s.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0 || from === to) return;
    const copy = [...ids];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    reorderMut.mutate(copy);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6" dir="rtl">
      <CustomersHeader canCreate={canCreate} onCreate={openCreate} />

      <CustomersStats
        stats={{
          total:
            (listQ.data?.published ?? 0) + (listQ.data?.unpublished ?? 0),
          published: listQ.data?.published ?? 0,
          unpublished: listQ.data?.unpublished ?? 0,
        }}
        loading={listQ.isLoading}
      />

      <CustomersToolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        status={status}
        onStatusChange={setStatus}
      />

      {hasQuery ? null : sorted.length > 1 && canEdit ? (
        <p className="text-xs text-muted-foreground">
          برای تغییر ترتیب، کارت را بکشید و رها کنید.
        </p>
      ) : null}

      {listQ.isLoading ? <CustomersSkeleton /> : null}

      {listQ.isError ? (
        <ErrorState
          title="بارگذاری مشتریان ناموفق بود"
          description="لطفاً دوباره تلاش کنید."
          onRetry={() => listQ.refetch()}
        />
      ) : null}

      {!listQ.isLoading && !listQ.isError && sorted.length === 0 ? (
        <CustomersEmptyState
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
          <CustomerList
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
            onReorder={reorder}
          />
        </div>
      ) : null}

      <CustomerForm
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editing}
        onSaved={invalidate}
      />

      <CustomerPreview
        customer={preview}
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
            <DialogTitle>حذف مشتری</DialogTitle>
            <DialogDescription className="leading-6">
              مشتری «{deleteTarget?.name}» از «{deleteTarget?.companyName}» و
              تصویر مرتبط آن حذف می‌شود و از وب‌سایت عمومی برداشته خواهد شد. این
              عمل به‌سادگی قابل بازگشت نیست.
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
              onClick={() =>
                deleteTarget && deleteMut.mutate(deleteTarget.id)
              }
            >
              {deleteMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
