"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  LayoutTemplate,
  Pencil,
  Plus,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import {
  apiDelete,
  apiGet,
  apiPost,
  ensureCsrf,
} from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { useMeQuery } from "@/lib/permissions";
import {
  slugifyLanding,
  validateLandingSlug,
  type LandingPageListResponse,
  type LandingPageSummary,
} from "@/lib/landing-pages";
import { ErrorState } from "@/components/loading/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatDate } from "@/lib/utils";

type StatusFilter = "ALL" | "published" | "draft";

export default function LandingPagesManagerPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me } = useMeQuery();
  const canCreate = hasPermission(me?.permissions, "landing_pages.create", me?.role);
  const canEdit = hasPermission(me?.permissions, "landing_pages.edit", me?.role);
  const canDelete = hasPermission(me?.permissions, "landing_pages.delete", me?.role);
  const canPublish = hasPermission(
    me?.permissions,
    "landing_pages.publish",
    me?.role,
  );

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LandingPageSummary | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQ(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const listQ = useQuery({
    queryKey: ["landing-pages-admin", q, status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status !== "ALL") params.set("status", status);
      params.set("pageSize", "100");
      return apiGet<LandingPageListResponse>(`/landing-pages?${params.toString()}`);
    },
  });

  const items = listQ.data?.items || [];
  const hasQuery = Boolean(q) || status !== "ALL";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["landing-pages-admin"] });
  };

  const createMut = useMutation({
    mutationFn: async () => {
      const slugError = validateLandingSlug(slug || slugifyLanding(title));
      if (slugError) throw new Error(slugError);
      await ensureCsrf();
      return apiPost<LandingPageSummary>("/landing-pages", {
        title: title.trim(),
        slug: slugifyLanding(slug || title),
        description: description.trim() || null,
      });
    },
    onSuccess: (created) => {
      toast.success("صفحه لندنگ ایجاد شد");
      setCreateOpen(false);
      invalidate();
      router.push(`/manager/landing-pages/${created.id}`);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "ایجاد صفحه ناموفق بود"),
  });

  const duplicateMut = useMutation({
    mutationFn: async (id: string) => {
      await ensureCsrf();
      return apiPost<LandingPageSummary>(`/landing-pages/${id}/duplicate`);
    },
    onSuccess: (created) => {
      toast.success("کپی صفحه ایجاد شد");
      invalidate();
      router.push(`/manager/landing-pages/${created.id}`);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "کپی صفحه ناموفق بود"),
  });

  const publishMut = useMutation({
    mutationFn: async ({ id, publish }: { id: string; publish: boolean }) => {
      await ensureCsrf();
      return apiPost(
        `/landing-pages/${id}/${publish ? "publish" : "unpublish"}`,
      );
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.publish ? "صفحه منتشر شد" : "انتشار لغو شد");
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "تغییر وضعیت ناموفق بود"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await ensureCsrf();
      return apiDelete(`/landing-pages/${id}`);
    },
    onSuccess: () => {
      toast.success("صفحه لندنگ حذف شد");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "حذف صفحه ناموفق بود"),
  });

  const stats = useMemo(
    () => ({
      total: (listQ.data?.published ?? 0) + (listQ.data?.unpublished ?? 0),
      published: listQ.data?.published ?? 0,
      unpublished: listQ.data?.unpublished ?? 0,
    }),
    [listQ.data],
  );

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="صفحات لندنگ"
        subtitle="طراحی، پیش‌نمایش و انتشار صفحات اختصاصی وب‌سایت عمومی"
        className="mb-0 sm:mb-0"
        actions={
          canCreate ? (
            <Button
              variant="brand"
              size="sm"
              className="h-9 gap-1.5 rounded-xl px-3.5"
              onClick={() => {
                setTitle("");
                setSlug("");
                setDescription("");
                setSlugTouched(false);
                setCreateOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              ایجاد صفحه لندنگ
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {listQ.isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[4.75rem] rounded-2xl" />
            ))
          : [
              { label: "کل صفحات", value: stats.total },
              { label: "منتشرشده", value: stats.published },
              { label: "پیش‌نویس", value: stats.unpublished },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm"
              >
                <p className="text-[11px] text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{card.value}</p>
              </div>
            ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="جستجو در عنوان یا نامک…"
            className="ps-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-44" dir="rtl">
            <SelectValue placeholder="وضعیت" />
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
            <SelectItem value="published">منتشرشده</SelectItem>
            <SelectItem value="draft">پیش‌نویس</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {listQ.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : null}

      {listQ.isError ? (
        <ErrorState
          title="بارگذاری صفحات لندنگ ناموفق بود"
          onRetry={() => listQ.refetch()}
        />
      ) : null}

      {!listQ.isLoading && !listQ.isError && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/60 px-6 py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/25 bg-brand/10">
            <LayoutTemplate className="h-7 w-7 text-brand" />
          </div>
          <h3 className="text-lg font-semibold">
            {hasQuery ? "نتیجه‌ای یافت نشد" : "هنوز صفحه لندنگی ساخته نشده است"}
          </h3>
          {!hasQuery && canCreate ? (
            <Button variant="brand" className="mt-6 rounded-xl" onClick={() => setCreateOpen(true)}>
              ایجاد صفحه لندنگ
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold">{item.title}</p>
                <Badge variant={item.isPublished ? "success" : "secondary"}>
                  {item.isPublished ? "منتشرشده" : "پیش‌نویس"}
                </Badge>
                {item.hasUnpublishedChanges ? (
                  <Badge variant="warning">تغییرات منتشرنشده</Badge>
                ) : null}
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground" dir="ltr">
                /{item.slug}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                ایجاد: {formatDate(item.createdAt)} · به‌روزرسانی: {formatDate(item.updatedAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" asChild>
                <Link href={`/manager/landing-pages/${item.id}/preview`}>
                  <Eye className="h-3 w-3" />
                  پیش‌نمایش
                </Link>
              </Button>
              {item.isPublished ? (
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" asChild>
                  <Link href={`/${item.slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3 w-3" />
                    عمومی
                  </Link>
                </Button>
              ) : null}
              {canEdit ? (
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" asChild>
                  <Link href={`/manager/landing-pages/${item.id}`}>
                    <Pencil className="h-3 w-3" />
                    ویرایش
                  </Link>
                </Button>
              ) : null}
              {canCreate ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                  onClick={() => duplicateMut.mutate(item.id)}
                >
                  <Copy className="h-3 w-3" />
                  کپی
                </Button>
              ) : null}
              {canPublish ? (
                <Button
                  size="sm"
                  variant="outline"
                  className={cn("h-8 gap-1 text-xs", item.isPublished && "text-muted-foreground")}
                  onClick={() =>
                    publishMut.mutate({ id: item.id, publish: !item.isPublished })
                  }
                >
                  {item.isPublished ? <EyeOff className="h-3 w-3" /> : <UploadCloud className="h-3 w-3" />}
                  {item.isPublished ? "لغو انتشار" : "انتشار"}
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs text-destructive"
                  onClick={() => setDeleteTarget(item)}
                >
                  <Trash2 className="h-3 w-3" />
                  حذف
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>ایجاد صفحه لندنگ</DialogTitle>
            <DialogDescription>
              عنوان و نامک را وارد کنید. سپس وارد سازنده صفحه می‌شوید.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>عنوان</Label>
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!slugTouched) setSlug(slugifyLanding(e.target.value));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>نامک</Label>
              <Input
                dir="ltr"
                className="text-start"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugifyLanding(e.target.value));
                }}
              />
              <p className="text-[11px] text-muted-foreground">/{slug || "..."}</p>
            </div>
            <div className="space-y-1.5">
              <Label>توضیح داخلی (اختیاری)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              انصراف
            </Button>
            <Button
              variant="brand"
              disabled={createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              ایجاد و ورود به سازنده
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>حذف صفحه لندنگ</DialogTitle>
            <DialogDescription>
              «{deleteTarget?.title}» حذف می‌شود و دیگر در وب‌سایت عمومی در دسترس نخواهد بود.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              انصراف
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
