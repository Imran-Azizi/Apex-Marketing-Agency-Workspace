"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPut, ensureCsrf } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  PortfolioAdminCategory,
  PortfolioAdminItem,
  PortfolioListPayload,
} from "./types";

export function MixedPortfolioManager({
  categories,
  canEdit,
}: {
  categories: PortfolioAdminCategory[];
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("ALL");
  const [selected, setSelected] = useState<PortfolioAdminItem[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const mixedQ = useQuery({
    queryKey: ["portfolio-mixed"],
    queryFn: () => apiGet<{ items: PortfolioAdminItem[] }>("/portfolio/mixed"),
  });

  const availableQ = useQuery({
    queryKey: ["portfolio-mixed-available", q, categoryId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (categoryId !== "ALL") params.set("categoryId", categoryId);
      params.set("pageSize", "50");
      return apiGet<PortfolioListPayload>(`/portfolio?${params.toString()}`);
    },
  });

  useEffect(() => {
    if (mixedQ.data?.items) setSelected(mixedQ.data.items);
  }, [mixedQ.data]);

  const selectedIds = useMemo(
    () => new Set(selected.map((item) => item.id)),
    [selected],
  );

  const saveMut = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await ensureCsrf();
      return apiPut("/portfolio/mixed", { orderedIds });
    },
    onSuccess: () => {
      toast.success("انتخاب مختلط ذخیره شد");
      void mixedQ.refetch();
      qc.invalidateQueries({ queryKey: ["portfolio-admin-stats"] });
      qc.invalidateQueries({ queryKey: ["public-portfolio"] });
      qc.invalidateQueries({ queryKey: ["public-portfolio-tabs"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "ذخیره مختلط ناموفق بود"),
  });

  function toggle(item: PortfolioAdminItem, checked: boolean) {
    setSelected((prev) => {
      if (checked) {
        if (prev.some((row) => row.id === item.id)) return prev;
        return [...prev, item];
      }
      return prev.filter((row) => row.id !== item.id);
    });
  }

  function move(id: string, delta: number) {
    setSelected((prev) => {
      const index = prev.findIndex((row) => row.id === id);
      const nextIndex = index + delta;
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev;
      const copy = [...prev];
      const [row] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, row);
      return copy;
    });
  }

  return (
    <div className="space-y-4 text-start" dir="rtl">
      <div>
        <h2 className="text-lg font-semibold">مدیریت مختلط</h2>
        <p className="mt-1 text-sm leading-7 text-muted-foreground">
          ویدیوهایی که در تب «کتگوری مختلط» وب‌سایت عمومی نمایش داده می‌شوند را
          انتخاب و مرتب کنید. همه ویدیوها به‌صورت خودکار اضافه نمی‌شوند.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-border/70 bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">ویدیوهای موجود</h3>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجوی عنوان…"
                className="ps-9"
                aria-label="جستجوی ویدیو برای مختلط"
              />
            </div>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="sm:w-48" dir="rtl">
                <SelectValue placeholder="کتگوری" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="ALL">همه کتگوری‌ها</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="max-h-[28rem] space-y-2 overflow-y-auto">
            {(availableQ.data?.items || []).map((item) => {
              const checked = selectedIds.has(item.id);
              return (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 p-2 hover:bg-muted/40"
                >
                  <Checkbox
                    checked={checked}
                    disabled={!canEdit}
                    onCheckedChange={(value) => toggle(item, value === true)}
                  />
                  <div className="h-12 w-20 overflow-hidden rounded-lg bg-muted">
                    {item.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {item.categories.map((c) => c.name).join("، ") || "بدون کتگوری"}
                    </p>
                  </div>
                </label>
              );
            })}
            {!availableQ.isLoading && (availableQ.data?.items || []).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                ویدیویی یافت نشد
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">
            ویدیوهای انتخاب‌شده ({selected.length})
          </h3>
          <div className="max-h-[28rem] space-y-2 overflow-y-auto">
            {selected.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-xl border border-border/60 p-2"
              >
                <span className="w-6 text-center text-xs tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <div className="h-12 w-20 overflow-hidden rounded-lg bg-muted">
                  {item.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {item.title}
                </p>
                {canEdit ? (
                  <div className="flex shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={index === 0}
                      onClick={() => move(item.id, -1)}
                      aria-label="انتقال به بالا"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={index === selected.length - 1}
                      onClick={() => move(item.id, 1)}
                      aria-label="انتقال به پایین"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => toggle(item, false)}
                    >
                      حذف
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
            {selected.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                هنوز نمونه‌کاری برای کتگوری مختلط انتخاب نشده است
              </p>
            ) : null}
          </div>
        </section>
      </div>

      {canEdit ? (
        <div className="flex justify-start">
          <Button
            variant="brand"
            className="gap-2"
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate(selected.map((item) => item.id))}
          >
            {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            ذخیره تغییرات مختلط
          </Button>
        </div>
      ) : null}
    </div>
  );
}
