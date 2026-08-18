"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import {
  Bell,
  Building2,
  CheckCheck,
  CheckCircle2,
  Clapperboard,
  FolderKanban,
  Mail,
  MessageSquareWarning,
  Mic2,
  Send,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api, apiDelete, apiGet, apiPost, type ApiEnvelope } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn, formatDateTime } from "@/lib/utils";
import { NotificationListSkeleton } from "@/components/loading/skeletons";
import { ErrorState } from "@/components/loading/error-state";

export type NotificationMeta = {
  type: string | null;
  projectId: string | null;
  projectCode: string | null;
  projectName: string | null;
  customerName: string | null;
  customerId: string | null;
  statusLabel: string | null;
  phone: string | null;
  eventKey: string | null;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  isUnseen?: boolean;
  createdAt: string;
  readAt: string | null;
  meta: NotificationMeta;
};

type NotificationsPage = {
  items: NotificationItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  unreadCount: number;
  unseenCount: number;
};

type UnseenCountPayload = {
  unseenCount: number;
  unreadCount: number;
};

type MarkSeenVars = {
  viewedBefore?: string;
  silent?: boolean;
};

const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;
const UNSEEN_COUNT_QUERY_KEY = ["notifications", "unseen-count"] as const;

function isUnseenNotification(item: NotificationItem): boolean {
  return item.isUnseen ?? !item.isRead;
}

function toSeen(item: NotificationItem, now: string): NotificationItem {
  if (!isUnseenNotification(item)) return item;
  return { ...item, isRead: true, isUnseen: false, readAt: now };
}

async function fetchNotificationsPage({
  pageParam = 1,
}: {
  pageParam?: number;
}): Promise<NotificationsPage> {
  const { data } = await api.get<
    ApiEnvelope<{
      items: NotificationItem[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    }>
  >("/notifications", { params: { page: pageParam, pageSize: 15 } });

  if (!data.success || !data.data) {
    throw new Error(data.error?.message || "خطا در بارگذاری اعلان‌ها");
  }

  const unseenCount = Number(
    (data.meta?.unseenCount ?? data.meta?.unreadCount) || 0,
  );

  return {
    ...data.data,
    items: data.data.items.map((item) => ({
      ...item,
      isUnseen: item.isUnseen ?? !item.isRead,
    })),
    unreadCount: unseenCount,
    unseenCount,
  };
}

async function fetchUnseenCount(): Promise<UnseenCountPayload> {
  const data = await apiGet<UnseenCountPayload>("/notifications/unseen-count");
  const unseenCount = Number((data?.unseenCount ?? data?.unreadCount) || 0);
  return { unseenCount, unreadCount: unseenCount };
}

function NotificationIcon({ type }: { type: string | null }) {
  if (type === "LEAD_CREATED") return <UserRound className="h-4 w-4" />;
  if (type === "CONTACT_MESSAGE") return <Mail className="h-4 w-4" />;
  if (type === "PROJECT_CREATED") return <FolderKanban className="h-4 w-4" />;
  if (type === "CONTENT_SENT_FOR_APPROVAL") return <Send className="h-4 w-4" />;
  if (type === "CONTENT_APPROVED_BY_CUSTOMER")
    return <CheckCircle2 className="h-4 w-4" />;
  if (type === "CONTENT_REVISION_REQUESTED")
    return <MessageSquareWarning className="h-4 w-4" />;
  if (
    type === "NARRATION_ASSIGNED" ||
    type === "NARRATION_DEADLINE_REMINDER" ||
    type === "NARRATION_UPLOADED" ||
    type === "NARRATION_APPROVED" ||
    type === "NARRATION_REVISION_REQUESTED"
  ) {
    return <Mic2 className="h-4 w-4" />;
  }
  if (
    type === "EDITING_ASSIGNED" ||
    type === "EDITING_REVISION_REQUESTED" ||
    type === "EDITING_COMPLETED" ||
    type === "EDITING_MANAGER_FEEDBACK" ||
    type === "EDITING_SUBMITTED" ||
    type === "FINAL_VIDEO_UPLOADED" ||
    type === "FINAL_VIDEO_UPLOAD_CONFIRMED" ||
    type === "FINAL_VIDEO_APPROVED" ||
    type === "FINAL_VIDEO_REVISION_REQUESTED" ||
    type === "EDITING_READY_FOR_CUSTOMER"
  ) {
    return <Clapperboard className="h-4 w-4" />;
  }
  return <Bell className="h-4 w-4" />;
}

function setUnseenCountCache(queryClient: QueryClient, unseenCount: number) {
  const next = Math.max(0, unseenCount);
  queryClient.setQueryData<UnseenCountPayload>(UNSEEN_COUNT_QUERY_KEY, {
    unseenCount: next,
    unreadCount: next,
  });
}

function markAllReadInCache(
  data: InfiniteData<NotificationsPage> | undefined,
): InfiniteData<NotificationsPage> | undefined {
  if (!data) return data;
  const now = new Date().toISOString();
  return {
    ...data,
    pages: data.pages.map((page, index) => ({
      ...page,
      unreadCount: index === 0 ? 0 : page.unreadCount,
      unseenCount: index === 0 ? 0 : page.unseenCount,
      items: page.items.map((item) => toSeen(item, now)),
    })),
  };
}

function NotificationCard({
  item,
  onOpen,
}: {
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
}) {
  const unseen = isUnseenNotification(item);
  const customer =
    item.meta.customerName ||
    (item.body?.match(/مشتری:\s*(.+)/)?.[1] ?? null);
  const project =
    item.meta.projectName ||
    (item.body?.match(/پروژه:\s*(.+)/)?.[1] ?? null);
  const projectCode = item.meta.projectCode;
  const statusLabel = item.meta.statusLabel;

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      data-unseen={unseen ? "true" : "false"}
      className={cn(
        "relative w-full rounded-xl border p-3 text-start",
        "transition-colors duration-300",
        "hover:border-brand/40 hover:bg-brand/[0.07] hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
        "active:scale-[0.99] active:bg-brand/10",
        "cursor-pointer",
        unseen
          ? "border-brand/30 bg-brand/[0.08] dark:bg-brand/[0.14]"
          : "border-border/80 bg-background",
      )}
    >
      {unseen && (
        <span
          className="absolute inset-y-2 start-1.5 w-1 rounded-full bg-brand"
          aria-hidden
        />
      )}
      <div className={cn("flex gap-3", unseen && "ps-2")}>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
            unseen
              ? "bg-brand/15 text-brand"
              : "bg-muted text-muted-foreground",
          )}
        >
          <NotificationIcon type={item.meta.type} />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={cn(
                "text-sm leading-snug transition-colors duration-300",
                unseen
                  ? "font-semibold text-foreground"
                  : "font-medium text-foreground/90",
              )}
            >
              {item.title}
            </h3>
            {unseen && (
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand"
                aria-label="اعلان جدید"
              />
            )}
          </div>

          {(customer || project || projectCode) && (
            <div className="space-y-1 text-xs text-muted-foreground">
              {customer && (
                <p className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    <span className="font-medium text-foreground">مشتری:</span>{" "}
                    {customer}
                  </span>
                </p>
              )}
              {project && (
                <p className="truncate">
                  <span className="font-medium text-foreground">پروژه:</span>{" "}
                  {project}
                </p>
              )}
              {projectCode && (
                <p className="truncate" dir="ltr">
                  <span className="font-medium text-foreground">شناسه:</span>{" "}
                  {projectCode}
                </p>
              )}
            </div>
          )}

          {!customer && !project && item.body && (
            <p className="whitespace-pre-line text-xs text-muted-foreground">
              {item.body}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {statusLabel && (
              <Badge variant="outline" className="text-[10px]">
                {statusLabel}
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground">
              {formatDateTime(item.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export function NotificationCenter({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  const unseenQuery = useQuery({
    queryKey: UNSEEN_COUNT_QUERY_KEY,
    queryFn: fetchUnseenCount,
    staleTime: 8_000,
    refetchInterval: open ? 8_000 : 12_000,
    refetchOnWindowFocus: true,
  });

  const query = useInfiniteQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: fetchNotificationsPage,
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    refetchInterval: open ? 8_000 : false,
    staleTime: 15_000,
    refetchOnWindowFocus: open,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );
  const unseenCount =
    unseenQuery.data?.unseenCount ??
    query.data?.pages[0]?.unseenCount ??
    query.data?.pages[0]?.unreadCount ??
    0;
  const total = query.data?.pages[0]?.total ?? items.length;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });

  const markAllRead = useMutation({
    mutationFn: (vars?: MarkSeenVars) =>
      apiPost("/notifications/read-all", vars?.viewedBefore ? { viewedBefore: vars.viewedBefore } : {}),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<InfiniteData<NotificationsPage>>(
        NOTIFICATIONS_QUERY_KEY,
      );
      const previousCount = queryClient.getQueryData<UnseenCountPayload>(
        UNSEEN_COUNT_QUERY_KEY,
      );
      queryClient.setQueryData<InfiniteData<NotificationsPage>>(
        NOTIFICATIONS_QUERY_KEY,
        (old) => markAllReadInCache(old),
      );
      setUnseenCountCache(queryClient, 0);
      return { previous, previousCount };
    },
    onError: (e, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previous);
      }
      if (context?.previousCount) {
        queryClient.setQueryData(UNSEEN_COUNT_QUERY_KEY, context.previousCount);
      }
      if (!vars?.silent) {
        toast.error(e instanceof Error ? e.message : "خطا در به‌روزرسانی اعلان‌ها");
      }
    },
    onSettled: invalidate,
  });

  const clearRead = useMutation({
    mutationFn: () => apiDelete("/notifications/read"),
    onSuccess: () => {
      toast.success("اعلان‌های خوانده‌شده پاک شدند");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا"),
  });

  const refetchList = query.refetch;
  const refetchUnseen = unseenQuery.refetch;

  useEffect(() => {
    if (!open) return;
    void refetchList();
    void refetchUnseen();
  }, [open, refetchList, refetchUnseen]);

  function markViewedAsSeen() {
    if (unseenCount <= 0 || markAllRead.isPending) return;
    markAllRead.mutate({
      viewedBefore: new Date().toISOString(),
      silent: true,
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    if (open && !nextOpen) {
      markViewedAsSeen();
    }
    setOpen(nextOpen);
  }

  function handleOpenNotification(item: NotificationItem) {
    handleOpenChange(false);
    if (item.link) {
      router.push(item.link);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
          aria-label={
            unseenCount > 0 ? `اعلان‌ها، ${unseenCount} جدید` : "اعلان‌ها"
          }
        >
          <Bell className="h-4 w-4" />
          {unseenCount > 0 && (
            <span className="absolute -top-0.5 -left-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unseenCount > 9 ? "9+" : unseenCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        showCloseButton={false}
        className="flex w-full max-w-md flex-col gap-0 overflow-hidden border-r p-0 shadow-2xl sm:max-w-md"
      >
        <SheetHeader dir="rtl" className="space-y-0 border-b px-4 py-4 text-start">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 text-start">
              <SheetTitle className="text-base sm:text-lg">اعلان‌ها</SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                  <span>
                    کل: <strong className="text-foreground">{total}</strong>
                  </span>
                  <span>
                    جدید:{" "}
                    <strong className="text-brand">{unseenCount}</strong>
                  </span>
                  {markAllRead.isPending && (
                    <span className="text-muted-foreground">در حال به‌روزرسانی…</span>
                  )}
                </div>
              </SheetDescription>
            </div>

            <SheetClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="بستن اعلان‌ها"
              >
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>

          <div className="flex flex-wrap gap-2 pt-3">
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              disabled={unseenCount === 0 || markAllRead.isPending}
              isLoading={markAllRead.isPending}
              loadingText="در حال به‌روزرسانی..."
              onClick={() => {
                if (unseenCount === 0 || markAllRead.isPending) return;
                markAllRead.mutate(undefined, {
                  onSuccess: () => toast.success("همه اعلان‌ها خوانده شدند"),
                });
              }}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              همه را خوانده‌شده کن
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-muted-foreground"
              disabled={total === 0}
              isLoading={clearRead.isPending}
              loadingText="در حال پاک‌سازی..."
              onClick={() => clearRead.mutate()}
            >
              <Trash2 className="h-3.5 w-3.5" />
              پاک‌سازی خوانده‌شده‌ها
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {query.isLoading && <NotificationListSkeleton count={6} />}

          {query.isError && (
            <ErrorState
              title="بارگذاری اعلان‌ها ناموفق بود"
              description="اتصال را بررسی کنید و دوباره تلاش کنید."
              className="border-none bg-transparent py-10"
              onRetry={() => query.refetch()}
            />
          )}

          {!query.isLoading && !query.isError && items.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 opacity-40" />
              اعلانی وجود ندارد
            </div>
          )}

          {items.map((item) => (
            <NotificationCard
              key={item.id}
              item={item}
              onOpen={handleOpenNotification}
            />
          ))}

          {query.hasNextPage && (
            <Button
              variant="outline"
              className="w-full"
              isLoading={query.isFetchingNextPage}
              loadingText="در حال بارگذاری..."
              onClick={() => query.fetchNextPage()}
            >
              بارگذاری بیشتر
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** @deprecated Use NotificationCenter */
export const NotificationDropdown = NotificationCenter;
