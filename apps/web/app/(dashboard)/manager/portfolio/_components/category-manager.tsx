"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPatch, apiPost, ensureCsrf } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PortfolioAdminCategory, PortfolioListPayload } from "./types";

export function CategoryManager({
  categories,
  canEdit,
}: {
  categories: PortfolioAdminCategory[];
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(
    categories[0]?.id || null,
  );

  useEffect(() => {
    if (!activeId && categories[0]) setActiveId(categories[0].id);
  }, [activeId, categories]);

  const videosQ = useQuery({
    queryKey: ["portfolio-category-videos", activeId],
    enabled: Boolean(activeId),
    queryFn: () =>
      apiGet<PortfolioListPayload>(
        `/portfolio?categoryId=${encodeURIComponent(activeId!)}&pageSize=100`,
      ),
  });

  const videos = videosQ.data?.items || [];

  const createMut = useMutation({
    mutationFn: async () => {
      await ensureCsrf();
      return apiPost("/portfolio/categories", { name: name.trim() });
    },
    onSuccess: () => {
      toast.success("کتگوری ایجاد شد");
      setCreateOpen(false);
      setName("");
      qc.invalidateQueries({ queryKey: ["portfolio-categories"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "ایجاد کتگوری ناموفق بود"),
  });

  const toggleMut = useMutation({
    mutationFn: async (category: PortfolioAdminCategory) => {
      await ensureCsrf();
      return apiPatch(`/portfolio/categories/${category.id}`, {
        isActive: !category.isActive,
      });
    },
    onSuccess: () => {
      toast.success("وضعیت کتگوری به‌روزرسانی شد");
      qc.invalidateQueries({ queryKey: ["portfolio-categories"] });
      qc.invalidateQueries({ queryKey: ["public-portfolio-tabs"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "به‌روزرسانی ناموفق بود"),
  });

  const reorderMut = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await ensureCsrf();
      return apiPatch("/portfolio/reorder", {
        scope: "category",
        categoryId: activeId,
        orderedIds,
      });
    },
    onSuccess: () => {
      toast.success("ترتیب کتگوری ذخیره شد");
      void videosQ.refetch();
      qc.invalidateQueries({ queryKey: ["public-portfolio"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "مرتب‌سازی ناموفق بود"),
  });

  function moveVideo(id: string, delta: number) {
    const index = videos.findIndex((item) => item.id === id);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= videos.length) return;
    const ordered = [...videos];
    const [row] = ordered.splice(index, 1);
    ordered.splice(nextIndex, 0, row);
    reorderMut.mutate(ordered.map((item) => item.id));
  }

  return (
    <div className="space-y-4 text-start" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">مدیریت کتگوری ها</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            کتگوری‌های ازپیش‌تعریف‌شده را فعال کنید و ترتیب ویدیوهای هر دسته را
            تنظیم کنید.
          </p>
        </div>
        {canEdit ? (
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            ایجاد کتگوری
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[18rem_1fr]">
        <div className="space-y-2">
          {categories.map((category) => {
            const active = activeId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveId(category.id)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-start text-sm ${
                  active
                    ? "border-brand/40 bg-brand/5 text-foreground"
                    : "border-border/70 bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>
                  {category.name}
                  <span className="ms-2 text-[11px] tabular-nums">
                    {category.itemCount}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={category.isActive ? "success" : "secondary"}>
                    {category.isActive ? "فعال" : "غیرفعال"}
                  </Badge>
                  {canEdit ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleMut.mutate(category);
                      }}
                    >
                      {category.isActive ? "غیرفعال" : "فعال"}
                    </Button>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">ترتیب ویدیوها در این کتگوری</h3>
          <div className="space-y-2">
            {videos.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-xl border border-border/60 p-2"
              >
                <span className="w-6 text-center text-xs tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm">{item.title}</p>
                {canEdit ? (
                  <div className="flex">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={index === 0 || reorderMut.isPending}
                      onClick={() => moveVideo(item.id, -1)}
                      aria-label="انتقال به بالا"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={
                        index === videos.length - 1 || reorderMut.isPending
                      }
                      onClick={() => moveVideo(item.id, 1)}
                      aria-label="انتقال به پایین"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
            {!videosQ.isLoading && videos.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                در این کتگوری هنوز نمونه‌کاری اضافه نشده است
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent dir="rtl" className="text-start sm:max-w-md">
          <DialogHeader className="text-start">
            <DialogTitle>ایجاد کتگوری</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-category">نام کتگوری</Label>
            <Input
              id="new-category"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              انصراف
            </Button>
            <Button
              variant="brand"
              className="gap-2"
              disabled={name.trim().length < 2 || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              ایجاد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
