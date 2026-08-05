"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { type PortalProjectsList, PORTAL_STATUS_LABELS } from "@/lib/portal";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ProjectProgressBar } from "@/components/projects/project-progress-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateProjectButton } from "@/components/portal/create-project-button";
import { PortalProjectCard } from "@/components/portal/portal-project-card";
import { PortalStatusBadge } from "@/components/portal/portal-status-badge";

const STATUS_OPTIONS = Object.entries(PORTAL_STATUS_LABELS);

export default function PortalProjectsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("updatedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("sort", sort);
    params.set("order", order);
    params.set("page", String(page));
    params.set("pageSize", "10");
    return params.toString();
  }, [search, status, dateFrom, dateTo, sort, order, page]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-projects", queryString],
    queryFn: () => apiGet<PortalProjectsList>(`/portal/projects?${queryString}`),
  });

  const hasFilters = Boolean(search.trim() || status || dateFrom || dateTo);

  function clearFilters() {
    setSearch("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setSort("updatedAt");
    setOrder("desc");
    setPage(1);
  }

  return (
    <div dir="rtl" className="space-y-6 text-start">
      <PageHeader
        title="پروژه‌ها"
        subtitle="مدیریت و پیگیری تمام پروژه‌های شما"
        actions={
          <CreateProjectButton canCreate={data?.canCreateProject ?? false} />
        }
      />

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b bg-muted/20 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-brand" />
            <CardTitle className="text-base">جستجو و فیلتر</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative space-y-1.5 lg:col-span-2">
            <Label htmlFor="project-search" className="text-xs text-muted-foreground">
              جستجو
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="project-search"
                placeholder="نام یا کد پروژه..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="ps-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">وضعیت</Label>
            <Select
              value={status || "ALL"}
              onValueChange={(v) => {
                setStatus(v === "ALL" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="وضعیت" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
                {STATUS_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="date-from"
              className="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              از تاریخ
            </Label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="[color-scheme:light]"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="date-to"
              className="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              تا تاریخ
            </Label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="[color-scheme:light]"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">مرتب‌سازی</Label>
            <Select
              value={`${sort}-${order}`}
              onValueChange={(v) => {
                const [s, o] = v.split("-");
                setSort(s);
                setOrder(o as "asc" | "desc");
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="مرتب‌سازی" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updatedAt-desc">جدیدترین بروزرسانی</SelectItem>
                <SelectItem value="createdAt-desc">جدیدترین ایجاد</SelectItem>
                <SelectItem value="createdAt-asc">قدیمی‌ترین ایجاد</SelectItem>
                <SelectItem value="title-asc">نام (الف-ی)</SelectItem>
                <SelectItem value="deadlineAt-asc">نزدیک‌ترین مهلت</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        {hasFilters && (
          <div className="flex justify-end border-t bg-muted/10 px-4 py-2">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              پاک کردن فیلترها
            </Button>
          </div>
        )}
      </Card>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      )}

      {error && (
        <EmptyState title="بارگذاری پروژه‌ها ناموفق بود" />
      )}

      {!isLoading && data && data.items.length === 0 && (
        <EmptyState
          title="پروژه‌ای یافت نشد"
          description={
            hasFilters
              ? "با فیلترهای انتخاب‌شده پروژه‌ای پیدا نشد."
              : "هنوز پروژه‌ای ثبت نشده است."
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                پاک کردن فیلترها
              </Button>
            ) : (
              <CreateProjectButton canCreate={data.canCreateProject} />
            )
          }
        />
      )}

      {!isLoading && data && data.items.length > 0 && (
        <>
          <div className="hidden overflow-hidden rounded-xl border shadow-sm md:block">
            <Table>
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
          </div>

          <div className="grid gap-4 md:hidden">
            {data.items.map((p) => (
              <PortalProjectCard key={p.id} project={p} />
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-xl border bg-muted/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              صفحه {data.page.toLocaleString("fa-AF", { numberingSystem: "latn" })} از{" "}
              {data.totalPages.toLocaleString("fa-AF", { numberingSystem: "latn" })}
              <span className="mx-1.5 text-border">|</span>
              <Badge variant="secondary" className="font-normal tabular-nums">
                {data.total.toLocaleString("fa-AF", { numberingSystem: "latn" })} پروژه
              </Badge>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronRight className="h-4 w-4" />
                قبلی
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
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
