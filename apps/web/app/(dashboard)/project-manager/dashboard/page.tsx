"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FolderKanban,
  RefreshCw,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { getProjectStatusLabel } from "@/lib/project-status";

type ProjectRow = {
  id: string;
  code: string;
  title: string;
  status: string;
};

export default function ProjectManagerDashboardPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["projects", "pm-dashboard"],
    queryFn: async () => {
      const res = await apiGet<{ items: ProjectRow[] }>(
        "/projects?page=1&pageSize=100",
      );
      return res.items;
    },
  });

  const stats = useMemo(() => {
    const items = data || [];
    const active = items.filter((p) => p.status !== "COMPLETED" && p.status !== "CANCELLED");
    const completed = items.filter((p) => p.status === "COMPLETED");
    const inProduction = items.filter((p) =>
      ["PRODUCTION_EDITING", "NARRATION_RECORDING", "CONTENT_APPROVED"].includes(p.status),
    );
    return {
      total: items.length,
      active: active.length,
      completed: completed.length,
      inProduction: inProduction.length,
    };
  }, [data]);

  const statusBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const project of data || []) {
      counts.set(project.status, (counts.get(project.status) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([status, count]) => ({
        status,
        label: getProjectStatusLabel(status),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-6" dir="rtl">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div dir="rtl">
        <EmptyState
          title="بارگذاری داشبورد ناموفق بود"
          description="لطفاً دوباره تلاش کنید."
          action={
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="ms-2 h-4 w-4" />
              تلاش مجدد
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        inline
        title="داشبورد مدیر پروژه"
        subtitle="نمای کلی پروژه‌های فعال و وضعیت تولید"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/projects">
              <FolderKanban className="ms-2 h-4 w-4" />
              همه پروژه‌ها
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="کل پروژه‌ها"
          value={String(stats.total)}
          icon={FolderKanban}
          tone="brand"
        />
        <StatCard
          title="پروژه‌های فعال"
          value={String(stats.active)}
          icon={Clock3}
          tone="default"
        />
        <StatCard
          title="در حال تولید"
          value={String(stats.inProduction)}
          icon={RefreshCw}
          tone="warning"
        />
        <StatCard
          title="تکمیل‌شده"
          value={String(stats.completed)}
          icon={CheckCircle2}
          tone="success"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">وضعیت پروژه‌ها</CardTitle>
            <CardDescription>توزیع پروژه‌ها بر اساس مرحله جاری</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusBreakdown.length ? (
              statusBreakdown.map((item) => (
                <div
                  key={item.status}
                  className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2"
                >
                  <span className="text-sm text-foreground">{item.label}</span>
                  <span className="text-sm font-semibold tabular-nums">{item.count}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">هنوز پروژه‌ای ثبت نشده است.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">میانبرها</CardTitle>
            <CardDescription>دسترسی سریع به بخش‌های اصلی پنل</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button variant="secondary" className="justify-between" asChild>
              <Link href="/projects">
                <span>مدیریت پروژه‌ها</span>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {isFetching ? (
        <p className="text-xs text-muted-foreground">در حال به‌روزرسانی…</p>
      ) : null}
    </div>
  );
}
