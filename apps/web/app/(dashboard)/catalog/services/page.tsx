"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  apiDelete,
  apiGet,
  apiPatch,
  ensureCsrf,
} from "@/lib/api";
import {
  serviceImageSrc,
  serviceTitle,
  type PublicService,
  type ServiceListResponse,
} from "@/lib/services";
import { formatDate, cn } from "@/lib/utils";
import { useHasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { ServiceFormDialog } from "./_components/service-form-dialog";
import { ServiceCard } from "@/components/public/service-cards";

const ALL = "ALL";

export default function CatalogServicesPage() {
  const qc = useQueryClient();
  const canCreate = useHasPermission("services.create");
  const canEdit = useHasPermission("services.edit");
  const canDelete = useHasPermission("services.delete");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PublicService | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PublicService | null>(null);
  const [preview, setPreview] = useState<PublicService | null>(null);

  const listQ = useQuery({
    queryKey: ["catalog-services", q, status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status !== ALL) params.set("status", status);
      params.set("pageSize", "100");
      const qs = params.toString();
      return apiGet<ServiceListResponse>(`/services${qs ? `?${qs}` : ""}`);
    },
  });

  const items = listQ.data?.items || [];

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          (a.sortOrder ?? a.displayOrder ?? 0) -
          (b.sortOrder ?? b.displayOrder ?? 0),
      ),
    [items],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["catalog-services"] });
    qc.invalidateQueries({ queryKey: ["public-services"] });
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
      return apiPatch(`/services/${id}/publish`, { isPublished });
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.isPublished ? "خدمت منتشر شد" : "خدمت غیرفعال شد");
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "تغییر وضعیت ناموفق بود"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await ensureCsrf();
      return apiDelete(`/services/${id}`);
    },
    onSuccess: () => {
      toast.success("خدمت حذف شد");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "حذف خدمت ناموفق بود"),
  });

  const reorderMut = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await ensureCsrf();
      return apiPatch("/services/reorder", { orderedIds });
    },
    onSuccess: () => {
      toast.success("ترتیب نمایش به‌روزرسانی شد");
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "تغییر ترتیب ناموفق بود"),
  });

  function move(id: string, direction: -1 | 1) {
    const ids = sorted.map((s) => s.id);
    const idx = ids.indexOf(id);
    const next = idx + direction;
    if (idx < 0 || next < 0 || next >= ids.length) return;
    const copy = [...ids];
    const [item] = copy.splice(idx, 1);
    copy.splice(next, 0, item);
    reorderMut.mutate(copy);
  }

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="مدیریت خدمات"
        subtitle="کارت‌های خدمات وب‌سایت عمومی را ایجاد، ویرایش، مرتب و منتشر کنید."
        actions={
          canCreate ? (
            <Button
              variant="brand"
              className="gap-2"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              ایجاد خدمت
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو در عنوان یا توضیحات…"
            className="ps-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44" dir="rtl">
            <SelectValue placeholder="وضعیت" />
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value={ALL}>همه وضعیت‌ها</SelectItem>
            <SelectItem value="active">فعال / منتشرشده</SelectItem>
            <SelectItem value="inactive">غیرفعال</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {listQ.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : null}

      {listQ.isError ? (
        <EmptyState
          title="بارگذاری خدمات ناموفق بود"
          description="لطفاً دوباره تلاش کنید."
        />
      ) : null}

      {!listQ.isLoading && !listQ.isError && sorted.length === 0 ? (
        <EmptyState
          title="خدمتی ثبت نشده است"
          description="با ایجاد اولین خدمت، کارت‌ها در وب‌سایت عمومی نمایش داده می‌شوند."
          action={
            canCreate ? (
              <Button
                variant="brand"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                ایجاد خدمت
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {sorted.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {sorted.map((service, index) => {
            const published = service.isPublished ?? service.isActive;
            const img = serviceImageSrc(service);
            return (
              <article
                key={service.id}
                className={cn(
                  "overflow-hidden rounded-2xl border bg-card shadow-sm",
                  published ? "border-border/70" : "border-dashed border-border/80 opacity-90",
                )}
              >
                <div className="flex flex-col sm:flex-row">
                  <div className="relative aspect-[16/10] w-full shrink-0 bg-muted sm:aspect-auto sm:w-44">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={serviceTitle(service)}
                        className="h-full w-full object-cover sm:absolute sm:inset-0"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          const fallback = e.currentTarget.nextElementSibling;
                          if (fallback instanceof HTMLElement) {
                            fallback.classList.remove("hidden");
                          }
                          if (process.env.NODE_ENV !== "production") {
                            console.warn("[catalog-service-image] failed:", img);
                          }
                        }}
                      />
                    ) : null}
                    <div
                      className={cn(
                        "flex h-full min-h-[7rem] items-center justify-center text-xs text-muted-foreground",
                        img ? "hidden" : "",
                      )}
                    >
                        بدون تصویر
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="tabular-nums">
                            ترتیب {service.sortOrder ?? index + 1}
                          </Badge>
                          <Badge variant={published ? "success" : "secondary"}>
                            {published ? "منتشرشده" : "غیرفعال"}
                          </Badge>
                        </div>
                        <h3 className="truncate text-base font-semibold">
                          {serviceTitle(service)}
                        </h3>
                        {service.description ? (
                          <p className="line-clamp-2 text-xs leading-6 text-muted-foreground">
                            {service.description}
                          </p>
                        ) : null}
                        <p className="text-[11px] text-muted-foreground">
                          به‌روزرسانی:{" "}
                          {service.updatedAt
                            ? formatDate(service.updatedAt)
                            : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => setPreview(service)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        پیش‌نمایش
                      </Button>
                      {canEdit ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => {
                              setEditing(service);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            ویرایش
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled={publishMut.isPending || reorderMut.isPending}
                            onClick={() =>
                              publishMut.mutate({
                                id: service.id,
                                isPublished: !published,
                              })
                            }
                          >
                            {published ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                            {published ? "غیرفعال" : "انتشار"}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            disabled={
                              index === 0 ||
                              reorderMut.isPending ||
                              publishMut.isPending
                            }
                            onClick={() => move(service.id, -1)}
                            aria-label="بالا"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            disabled={
                              index === sorted.length - 1 ||
                              reorderMut.isPending ||
                              publishMut.isPending
                            }
                            onClick={() => move(service.id, 1)}
                            aria-label="پایین"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </>
                      ) : null}
                      {canDelete ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(service)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          حذف
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      <ServiceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        service={editing}
        onSaved={invalidate}
      />

      <Dialog
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
      >
        <DialogContent className="max-w-lg text-start" dir="rtl">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>پیش‌نمایش کارت خدمت</DialogTitle>
            <DialogDescription>
              نمای تقریبی کارت در وب‌سایت عمومی
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <ServiceCard service={preview} index={0} />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && !deleteMut.isPending && setDeleteTarget(null)}
      >
        <DialogContent className="text-start sm:max-w-md" dir="rtl">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>حذف خدمت</DialogTitle>
            <DialogDescription className="leading-6">
              خدمت «{deleteTarget ? serviceTitle(deleteTarget) : ""}» حذف نرم
              می‌شود و از وب‌سایت عمومی برداشته خواهد شد. این عمل قابل‌بازگشت
              نیست مگر از طریق پشتیبان.
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
              disabled={deleteMut.isPending || !deleteTarget}
              className="gap-2"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              {deleteMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              حذف خدمت
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
