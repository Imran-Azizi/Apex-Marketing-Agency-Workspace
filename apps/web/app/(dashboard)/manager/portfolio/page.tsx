"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Film,
  Loader2,
  Pencil,
  Search,
  Trash2,
  EyeOff,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { apiDelete, apiGet, apiPatch } from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";
import { mediaStreamUrl } from "@/lib/media";
import { hasPermission } from "@/lib/rbac";
import { useMeQuery } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { VideoPlayer } from "@/components/media/video-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type PortfolioAdminItem = {
  id: string;
  title: string;
  description: string;
  slug: string;
  status: "PUBLISHED" | "UNPUBLISHED";
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    code: string;
    title: string;
    status: string;
    completedAt: string | null;
    serviceName: string | null;
  } | null;
  video: {
    id: string;
    name: string;
    kind: string;
    videoType: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
    version: number;
  } | null;
  publishedBy: { id: string; fullName: string } | null;
};

type ListPayload = {
  items: PortfolioAdminItem[];
  total: number;
  page: number;
  pageSize: number;
};

export default function PortfolioAdminPage() {
  const qc = useQueryClient();
  const { data: me } = useMeQuery();
  const canEdit = hasPermission(me?.permissions, "portfolio.edit", me?.role);
  const canDelete = hasPermission(
    me?.permissions,
    "portfolio.delete",
    me?.role,
  );

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"ALL" | "PUBLISHED" | "UNPUBLISHED">(
    "ALL",
  );
  const [preview, setPreview] = useState<PortfolioAdminItem | null>(null);
  const [editItem, setEditItem] = useState<PortfolioAdminItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [deleteItem, setDeleteItem] = useState<PortfolioAdminItem | null>(null);

  const listQ = useQuery({
    queryKey: ["portfolio-admin", q, status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status !== "ALL") params.set("status", status);
      params.set("pageSize", "50");
      const qs = params.toString();
      return apiGet<ListPayload>(`/portfolio${qs ? `?${qs}` : ""}`);
    },
  });

  const items = listQ.data?.items || [];

  const counts = useMemo(() => {
    const published = items.filter((i) => i.status === "PUBLISHED").length;
    return {
      total: listQ.data?.total ?? items.length,
      published,
      unpublished: (listQ.data?.total ?? items.length) - published,
    };
  }, [items, listQ.data?.total]);

  const updateMut = useMutation({
    mutationFn: (payload: {
      id: string;
      title?: string;
      description?: string;
      status?: "PUBLISHED" | "UNPUBLISHED";
    }) =>
      apiPatch(`/portfolio/${payload.id}`, {
        title: payload.title,
        description: payload.description,
        status: payload.status,
      }),
    onSuccess: () => {
      toast.success("نمونه‌کار به‌روزرسانی شد");
      qc.invalidateQueries({ queryKey: ["portfolio-admin"] });
      qc.invalidateQueries({ queryKey: ["public-portfolio"] });
      setEditItem(null);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "به‌روزرسانی ناموفق بود"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/portfolio/${id}`),
    onSuccess: () => {
      toast.success("از نمونه‌کارها حذف شد (پروژه اصلی باقی ماند)");
      qc.invalidateQueries({ queryKey: ["portfolio-admin"] });
      qc.invalidateQueries({ queryKey: ["public-portfolio"] });
      qc.invalidateQueries({ queryKey: ["portfolio-project"] });
      setDeleteItem(null);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "حذف ناموفق بود"),
  });

  function openEdit(item: PortfolioAdminItem) {
    setEditItem(item);
    setEditTitle(item.title);
    setEditDescription(item.description);
  }

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="نمونه‌کارها"
        subtitle="مدیریت پروژه‌های منتشرشده در وب‌سایت عمومی"
        actions={
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href="/portfolio" target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              مشاهده عمومی
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="کل نمونه‌کارها" value={counts.total} />
        <StatCard label="منتشرشده" value={counts.published} tone="success" />
        <StatCard label="غیرفعال" value={Math.max(0, counts.unpublished)} />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو در عنوان، توضیحات یا پروژه…"
            className="h-10 ps-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["ALL", "همه"],
              ["PUBLISHED", "منتشرشده"],
              ["UNPUBLISHED", "غیرفعال"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={status === id ? "brand" : "outline"}
              onClick={() => setStatus(id)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {listQ.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : null}

      {listQ.isError ? (
        <EmptyState
          title="بارگذاری نمونه‌کارها ناموفق بود"
          description="لطفاً دوباره تلاش کنید."
        />
      ) : null}

      {listQ.data && items.length === 0 ? (
        <EmptyState
          title="هنوز نمونه‌کاری منتشر نشده است"
          description="از تب محصول نهایی پروژه‌های تکمیل‌شده، گزینه «ارسال به نمونه‌کارها» را استفاده کنید."
        />
      ) : null}

      {items.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>نمونه‌کار</TableHead>
                <TableHead>پروژه</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>تاریخ انتشار</TableHead>
                <TableHead className="w-[1%] whitespace-nowrap">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="min-w-0 max-w-sm space-y-1">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">{item.project?.title || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.project?.code}
                        {item.project?.serviceName
                          ? ` · ${item.project.serviceName}`
                          : ""}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        item.status === "PUBLISHED" ? "success" : "secondary"
                      }
                    >
                      {item.status === "PUBLISHED" ? "منتشرشده" : "غیرفعال"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.publishedAt ? formatDate(item.publishedAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1 px-2"
                        onClick={() => setPreview(item)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        پیش‌نمایش
                      </Button>
                      {canEdit ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 px-2"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          ویرایش
                        </Button>
                      ) : null}
                      {canEdit ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 px-2"
                          disabled={updateMut.isPending}
                          onClick={() =>
                            updateMut.mutate({
                              id: item.id,
                              status:
                                item.status === "PUBLISHED"
                                  ? "UNPUBLISHED"
                                  : "PUBLISHED",
                            })
                          }
                        >
                          {item.status === "PUBLISHED" ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" />
                              لغو انتشار
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              انتشار
                            </>
                          )}
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 px-2 text-destructive hover:text-destructive"
                          onClick={() => setDeleteItem(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          حذف
                        </Button>
                      ) : null}
                      {item.project?.id ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 px-2"
                          asChild
                        >
                          <Link href={`/projects/${item.project.id}`}>
                            <Film className="h-3.5 w-3.5" />
                            پروژه
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl text-start sm:max-w-3xl" dir="rtl">
          <DialogHeader className="text-start">
            <DialogTitle>{preview?.title}</DialogTitle>
            <DialogDescription className="leading-6">
              {preview?.description}
            </DialogDescription>
          </DialogHeader>
          {preview?.video?.id ? (
            <VideoPlayer
              src={mediaStreamUrl(preview.video.id)}
              title={preview.title}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editItem}
        onOpenChange={(o) => !o && !updateMut.isPending && setEditItem(null)}
      >
        <DialogContent className="text-start sm:max-w-lg" dir="rtl">
          <DialogHeader className="text-start">
            <DialogTitle>ویرایش نمونه‌کار</DialogTitle>
            <DialogDescription>
              عنوان و توضیحات عمومی را ویرایش کنید.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-portfolio-title">عنوان</Label>
              <Input
                id="edit-portfolio-title"
                value={editTitle}
                disabled={updateMut.isPending}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-portfolio-desc">توضیحات</Label>
              <Textarea
                id="edit-portfolio-desc"
                rows={5}
                value={editDescription}
                disabled={updateMut.isPending}
                onChange={(e) => setEditDescription(e.target.value)}
                maxLength={2000}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="outline"
              disabled={updateMut.isPending}
              onClick={() => setEditItem(null)}
            >
              انصراف
            </Button>
            <Button
              variant="brand"
              className="gap-2"
              disabled={
                updateMut.isPending ||
                editTitle.trim().length < 3 ||
                editDescription.trim().length < 20
              }
              onClick={() => {
                if (!editItem) return;
                updateMut.mutate({
                  id: editItem.id,
                  title: editTitle.trim(),
                  description: editDescription.trim(),
                });
              }}
            >
              {updateMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              ذخیره
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteItem}
        onOpenChange={(o) => !o && !deleteMut.isPending && setDeleteItem(null)}
      >
        <DialogContent className="text-start sm:max-w-md" dir="rtl">
          <DialogHeader className="text-start">
            <DialogTitle>حذف از نمونه‌کارها</DialogTitle>
            <DialogDescription className="leading-6">
              «{deleteItem?.title}» از وب‌سایت عمومی حذف می‌شود. پروژه اصلی و
              ویدیوی نهایی حذف نمی‌شوند.
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
              حذف از نمونه‌کارها
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success";
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </p>
    </div>
  );
}
