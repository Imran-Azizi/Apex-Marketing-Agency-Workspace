"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Eye, Search, X } from "lucide-react";
import { apiGet } from "@/lib/api";
import { type PortalProjectsList } from "@/lib/portal";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { HorizontalScroll } from "@/components/shared/horizontal-scroll";
import { EmptyState } from "@/components/shared/empty-state";
import { ProjectProgressBar } from "@/components/projects/project-progress-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateProjectButton } from "@/components/portal/create-project-button";
import { PortalProjectCard } from "@/components/portal/portal-project-card";
import { PortalStatusBadge } from "@/components/portal/portal-status-badge";

const searchControlClass =
  "h-11 rounded-xl border-border/80 bg-background shadow-none transition-colors focus-visible:border-brand/40 focus-visible:ring-brand/20";

export default function PortalProjectsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    params.set("sort", "updatedAt");
    params.set("order", "desc");
    params.set("page", String(page));
    params.set("pageSize", "10");
    return params.toString();
  }, [search, page]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-projects", queryString],
    queryFn: () => apiGet<PortalProjectsList>(`/portal/projects?${queryString}`),
  });

  const hasSearch = Boolean(search.trim());

  function clearSearch() {
    setSearch("");
    setPage(1);
  }

  return (
    <div dir="rtl" className="space-y-4 text-start sm:space-y-6">
      <PageHeader
        title="پروژه‌ها"
        subtitle="مدیریت و پیگیری تمام پروژه‌های شما"
        subtitleClassName="hidden sm:block"
        inline
        className="mb-0 sm:mb-2"
        actions={
          <CreateProjectButton
            canCreate={data?.canCreateProject ?? false}
            pendingBriefsCount={data?.pendingBriefsCount ?? 0}
            pipelineStage={data?.pipelineStage}
            size="sm"
            className="h-9 gap-1.5 px-2.5 text-xs sm:h-10 sm:px-4 sm:text-sm"
          />
        }
      />

      <section
        aria-label="جستجوی پروژه"
        className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/25 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/15 text-brand">
              <Search className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">جستجو</h2>
              <p className="hidden text-[11px] text-muted-foreground sm:block">
                پیدا کردن سریع پروژه بر اساس نام یا کد
              </p>
            </div>
          </div>
          {hasSearch ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={clearSearch}
            >
              <X className="h-3.5 w-3.5" />
              پاک کردن
            </Button>
          ) : null}
        </div>

        <div className="p-4 sm:p-5">
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="project-search"
              placeholder="نام پروژه یا کد مانند APX-2026-0044..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className={cn(searchControlClass, "ps-10 pe-10")}
              aria-label="جستجوی پروژه"
            />
            {hasSearch ? (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute end-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="پاک کردن جستجو"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      )}

      {error && <EmptyState title="بارگذاری پروژه‌ها ناموفق بود" />}

      {!isLoading && data && data.items.length === 0 && (
        <EmptyState
          title="پروژه‌ای یافت نشد"
          description={
            hasSearch
              ? "با عبارت جستجو پروژه‌ای پیدا نشد."
              : "هنوز پروژه‌ای ثبت نشده است."
          }
          action={
            hasSearch ? (
              <Button variant="outline" onClick={clearSearch}>
                پاک کردن جستجو
              </Button>
            ) : (
              <CreateProjectButton
                canCreate={data.canCreateProject}
                pendingBriefsCount={data.pendingBriefsCount}
                pipelineStage={data.pipelineStage}
              />
            )
          }
        />
      )}

      {!isLoading && data && data.items.length > 0 && (
        <>
          <HorizontalScroll className="hidden rounded-xl shadow-sm md:block">
            <Table className="min-w-[48rem]">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-start">نام پروژه</TableHead>
                  <TableHead className="text-start">وضعیت</TableHead>
                  <TableHead className="text-start">پیشرفت</TableHead>
                  <TableHead className="text-start">ایجاد</TableHead>
                  <TableHead className="text-start">مهلت</TableHead>
                  <TableHead className="text-start">بودجه</TableHead>
                  <TableHead className="w-[7rem] text-start">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((p) => (
                  <TableRow key={p.id} className="group">
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-semibold leading-snug">{p.title}</p>
                        <p className="text-xs text-muted-foreground">
                          <bdi dir="ltr">{p.code}</bdi>
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <PortalStatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="min-w-[9rem]">
                      <ProjectProgressBar
                        progress={p.progress}
                        status={p.status}
                        variant="inline"
                        showTitle={false}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(p.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.deadlineAt ? formatDate(p.deadlineAt) : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {p.budget != null ? (
                        <bdi dir="ltr">{formatCurrency(p.budget)}</bdi>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="gap-1.5 opacity-90 group-hover:opacity-100"
                      >
                        <Link href={`/portal/projects/${p.id}`}>
                          <Eye className="h-3.5 w-3.5" />
                          جزئیات
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </HorizontalScroll>

          <div className="grid gap-3 md:hidden">
            {data.items.map((p) => (
              <PortalProjectCard key={p.id} project={p} />
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 sm:rounded-xl sm:border sm:bg-muted/10 sm:px-4 sm:py-3 sm:pt-3">
            <p className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">
              <span className="sm:hidden">
                {data.total.toLocaleString("fa-AF", { numberingSystem: "latn" })}{" "}
                پروژه
              </span>
              <span className="hidden sm:inline">
                صفحه{" "}
                {data.page.toLocaleString("fa-AF", { numberingSystem: "latn" })}{" "}
                از{" "}
                {data.totalPages.toLocaleString("fa-AF", {
                  numberingSystem: "latn",
                })}
                <span className="mx-1.5 text-border">|</span>
                <Badge variant="secondary" className="font-normal tabular-nums">
                  {data.total.toLocaleString("fa-AF", {
                    numberingSystem: "latn",
                  })}{" "}
                  پروژه
                </Badge>
              </span>
            </p>
            <div className="flex shrink-0 gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2.5 sm:h-9 sm:px-3"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronRight className="h-4 w-4" />
                قبلی
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2.5 sm:h-9 sm:px-3"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                بعدی
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
