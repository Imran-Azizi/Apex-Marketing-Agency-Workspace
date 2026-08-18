"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPatch } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { useMeQuery } from "@/lib/permissions";
import type {
  ContactMessage,
  ContactMessageListPayload,
  ContactMessageStats,
} from "@/lib/contact";
import { ErrorState } from "@/components/loading/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContactMessagesHeader } from "./_components/contact-messages-header";
import { ContactMessageStats as ContactMessageStatsCards } from "./_components/contact-message-stats";
import { ContactMessagesToolbar } from "./_components/contact-messages-toolbar";
import { ContactMessagesTable } from "./_components/contact-messages-table";
import {
  ContactMessageDetails,
  ContactMessageDetailsSkeleton,
} from "./_components/contact-message-details";
import { ContactMessagesEmptyState } from "./_components/contact-messages-empty-state";
import { ContactMessagesSkeleton } from "./_components/contact-messages-skeleton";
import type { SortValue, StatusFilter, SubjectFilter } from "./_components/types";

const PAGE_SIZE = 20;
const EMPTY_STATS: ContactMessageStats = {
  unreadCount: 0,
  total: 0,
  readCount: 0,
};

function ContactMessagesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { data: me } = useMeQuery();
  const canEdit = hasPermission(me?.permissions, "contact.edit", me?.role);
  const canDelete = hasPermission(me?.permissions, "contact.delete", me?.role);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [subject, setSubject] = useState<SubjectFilter>("ALL");
  const [sort, setSort] = useState<SortValue>("newest");
  const [page, setPage] = useState(1);
  const selectedId = searchParams.get("id");
  const [deleteItem, setDeleteItem] = useState<ContactMessage | null>(null);
  const autoReadRef = useRef<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status, subject, sort]);

  const statsQ = useQuery({
    queryKey: ["contact-unread-count"],
    queryFn: () => apiGet<ContactMessageStats>("/contact/unread-count"),
    staleTime: 20_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const listQ = useQuery({
    queryKey: ["contact-messages", debouncedQ, status, subject, sort, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedQ) params.set("q", debouncedQ);
      if (status !== "ALL") params.set("status", status);
      if (subject !== "ALL") params.set("subject", subject);
      params.set("sort", sort);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      return apiGet<ContactMessageListPayload>(`/contact?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  const items = listQ.data?.items ?? [];
  const total = listQ.data?.total ?? 0;
  const totalPages = listQ.data?.totalPages ?? 1;
  const unreadCount =
    statsQ.data?.unreadCount ?? listQ.data?.unreadCount ?? 0;

  const selectedFromList = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  const detailQ = useQuery({
    queryKey: ["contact-message", selectedId],
    queryFn: () => apiGet<ContactMessage>(`/contact/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  const selected = detailQ.data ?? selectedFromList;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["contact-messages"] });
    qc.invalidateQueries({ queryKey: ["contact-unread-count"] });
    if (selectedId) {
      qc.invalidateQueries({ queryKey: ["contact-message", selectedId] });
    }
  };

  const markMut = useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean; silent?: boolean }) =>
      apiPatch<ContactMessage>(`/contact/${id}/${read ? "read" : "unread"}`),
    onSuccess: (row, vars) => {
      qc.setQueryData(["contact-message", row.id], row);
      invalidate();
      if (!vars.silent) {
        toast.success(
          vars.read
            ? "پیام با موفقیت خوانده شد"
            : "پیام به‌عنوان خوانده‌نشده علامت‌گذاری شد",
        );
      }
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "خطا در انجام عملیات"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/contact/${id}`),
    onSuccess: () => {
      toast.success("پیام با موفقیت حذف شد");
      setDeleteItem(null);
      closeDetails();
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "خطا در انجام عملیات"),
  });

  function openMessage(item: ContactMessage) {
    router.replace(`/manager/messages?id=${item.id}`);
  }

  function closeDetails() {
    router.replace("/manager/messages");
  }

  const markMutate = markMut.mutate;

  useEffect(() => {
    if (!selectedId) {
      autoReadRef.current = null;
      return;
    }
    if (!canEdit || !detailQ.data || detailQ.data.isRead) return;
    if (autoReadRef.current === detailQ.data.id) return;
    autoReadRef.current = detailQ.data.id;
    markMutate({ id: detailQ.data.id, read: true, silent: true });
  }, [canEdit, selectedId, detailQ.data, markMutate]);

  useEffect(() => {
    if (listQ.isError) {
      toast.error("خطا در دریافت پیام‌ها");
    }
  }, [listQ.isError]);

  const hasActiveFilters =
    Boolean(debouncedQ) || status !== "ALL" || subject !== "ALL";

  function clearFilters() {
    setQ("");
    setDebouncedQ("");
    setStatus("ALL");
    setSubject("ALL");
    setSort("newest");
    setPage(1);
  }

  return (
    <div className="min-w-0 space-y-5" dir="rtl">
      <ContactMessagesHeader unreadCount={unreadCount} />

      <ContactMessageStatsCards
        stats={statsQ.data ?? EMPTY_STATS}
        loading={statsQ.isLoading && !statsQ.data}
      />

      <ContactMessagesToolbar
        search={q}
        onSearchChange={setQ}
        status={status}
        onStatusChange={setStatus}
        unreadCount={unreadCount}
        subject={subject}
        onSubjectChange={setSubject}
        sort={sort}
        onSortChange={setSort}
      />

      {listQ.isLoading && !listQ.data ? <ContactMessagesSkeleton /> : null}

      {listQ.isError && !listQ.data ? (
        <ErrorState
          title="دریافت پیام‌ها با مشکل مواجه شد"
          description="اتصال را بررسی کنید و دوباره تلاش کنید."
          onRetry={() => listQ.refetch()}
        />
      ) : null}

      {!listQ.isLoading && !listQ.isError && items.length === 0 ? (
        <ContactMessagesEmptyState
          hasQuery={hasActiveFilters}
          onClear={hasActiveFilters ? clearFilters : undefined}
        />
      ) : null}

      {items.length > 0 ? (
        <ContactMessagesTable
          items={items}
          canEdit={canEdit}
          canDelete={canDelete}
          isFetching={listQ.isFetching && !listQ.isLoading}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onOpen={openMessage}
          onMarkRead={(message) =>
            markMut.mutate({ id: message.id, read: true })
          }
          onMarkUnread={(message) =>
            markMut.mutate({ id: message.id, read: false })
          }
          onDelete={setDeleteItem}
        />
      ) : null}

      <Dialog
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) closeDetails();
        }}
      >
        <DialogContent className="flex max-h-[min(90vh,44rem)] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>جزئیات پیام تماس</DialogTitle>
            <DialogDescription>
              اطلاعات مشتری و متن کامل پیام ارسال‌شده از وب‌سایت عمومی
            </DialogDescription>
          </DialogHeader>
          {detailQ.isLoading && !selected ? (
            <ContactMessageDetailsSkeleton />
          ) : null}
          {detailQ.isError && !selected ? (
            <div className="p-6">
              <ErrorState
                title="دریافت پیام با مشکل مواجه شد"
                onRetry={() => detailQ.refetch()}
              />
            </div>
          ) : null}
          {selected ? (
            <ContactMessageDetails
              message={selected}
              canEdit={canEdit}
              canDelete={canDelete}
              pending={markMut.isPending || deleteMut.isPending}
              onMarkRead={() =>
                markMut.mutate({ id: selected.id, read: true })
              }
              onMarkUnread={() =>
                markMut.mutate({ id: selected.id, read: false })
              }
              onDelete={() => setDeleteItem(selected)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteItem)}
        onOpenChange={(open) => {
          if (!open) setDeleteItem(null);
        }}
      >
        <DialogContent className="sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>حذف پیام</DialogTitle>
            <DialogDescription>
              آیا از حذف این پیام اطمینان دارید؟ این عملیات قابل بازگشت نیست.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>
              انصراف
            </Button>
            <Button
              variant="destructive"
              isLoading={deleteMut.isPending}
              loadingText="در حال حذف..."
              onClick={() => deleteItem && deleteMut.mutate(deleteItem.id)}
            >
              حذف پیام
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ContactMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5" dir="rtl">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-[4.25rem] rounded-2xl" />
            <Skeleton className="h-[4.25rem] rounded-2xl" />
            <Skeleton className="h-[4.25rem] rounded-2xl" />
          </div>
          <Skeleton className="h-28 w-full rounded-2xl" />
          <ContactMessagesSkeleton />
        </div>
      }
    >
      <ContactMessagesPageInner />
    </Suspense>
  );
}
