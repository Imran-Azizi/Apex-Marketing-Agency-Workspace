"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clapperboard,
  Clock3,
  RefreshCw,
  Send,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  EDITING_PRIORITY_LABEL,
  EDITING_STATUS_LABEL,
  editingActionLabel,
  editingPriorityVariant,
  editingStatusVariant,
  formatRemainingTime,
  type EditorTaskSummary,
} from "@/lib/editor";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
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

type DashboardPayload = {
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    submitted: number;
    revisionRequested: number;
    completed: number;
    overdue: number;
    completedThisMonth: number;
    totalEarnings: number;
    estimatedEarnings: number;
  };
  recent: EditorTaskSummary[];
  upcomingDeadlines: EditorTaskSummary[];
};

export default function EditorDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["editor-dashboard"],
    queryFn: () => apiGet<DashboardPayload>("/production/dashboard"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6" dir="rtl">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        title="بارگذاری داشبورد ناموفق بود"
        description="لطفاً صفحه را تازه‌سازی کنید یا دوباره وارد شوید."
      />
    );
  }

  const { stats, recent, upcomingDeadlines } = data;

  return (
    <div className="space-y-6 animate-fade-slide" dir="rtl">
      <PageHeader
        title="میز کار ادیتور"
        subtitle="نمای کلی پروژه‌های ادیت ارجاع‌شده و مهلت‌ها"
        actions={
          <Button variant="brand" className="gap-2" asChild>
            <Link href="/editor/projects">
              <Clapperboard className="h-4 w-4" />
              همه پروژه‌های ادیت
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="کل پروژه‌های ارجاع‌شده"
          value={stats.total.toLocaleString("fa-AF", { numberingSystem: "latn" })}
          icon={Clapperboard}
          tone="brand"
        />
        <StatCard
          title="در انتظار ادیت"
          value={stats.pending.toLocaleString("fa-AF", { numberingSystem: "latn" })}
          icon={Clock3}
          hint="ارجاع‌های جدید"
        />
        <StatCard
          title="در حال ادیت"
          value={stats.inProgress.toLocaleString("fa-AF", {
            numberingSystem: "latn",
          })}
          icon={TrendingUp}
          tone="warning"
        />
        <StatCard
          title="تکمیل‌شده"
          value={stats.completed.toLocaleString("fa-AF", {
            numberingSystem: "latn",
          })}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          title="ارسال‌شده برای بررسی"
          value={stats.submitted.toLocaleString("fa-AF", {
            numberingSystem: "latn",
          })}
          icon={Send}
        />
        <StatCard
          title="نیاز به اصلاح"
          value={stats.revisionRequested.toLocaleString("fa-AF", {
            numberingSystem: "latn",
          })}
          icon={RefreshCw}
          tone={stats.revisionRequested > 0 ? "danger" : "default"}
        />
        <StatCard
          title="مهلت گذشته"
          value={stats.overdue.toLocaleString("fa-AF", { numberingSystem: "latn" })}
          icon={AlertTriangle}
          tone={stats.overdue > 0 ? "danger" : "default"}
        />
        <StatCard
          title="تکمیل این ماه"
          value={stats.completedThisMonth.toLocaleString("fa-AF", {
            numberingSystem: "latn",
          })}
          icon={Send}
          hint="از ابتدای ماه جاری"
        />
        <StatCard
          title="درآمد تأییدشده"
          value={formatCurrency(stats.totalEarnings || 0)}
          icon={Wallet}
          tone="success"
          hint={
            stats.estimatedEarnings
              ? `مجموع برآوردی: ${formatCurrency(stats.estimatedEarnings)}`
              : undefined
          }
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">پروژه‌های اخیر</CardTitle>
              <CardDescription>آخرین تکالیف ارجاع‌شده توسط مدیر</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/editor/projects">همه</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!recent.length ? (
              <EmptyState
                title="پروژه‌ای ارجاع نشده"
                description="پس از ارجاع توسط مدیر، اینجا نمایش داده می‌شود."
              />
            ) : (
              <ul className="space-y-2">
                {recent.map((task) => (
                  <li
                    key={task.id}
                    className="flex flex-col gap-3 rounded-xl border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-medium">{task.title}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge
                          variant={editingStatusVariant(task.status)}
                          className="font-normal"
                        >
                          {EDITING_STATUS_LABEL[task.status] || task.status}
                        </Badge>
                        {task.assignedAt && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            {formatDate(task.assignedAt)}
                          </span>
                        )}
                        {task.deadline && (
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3 w-3" />
                            {formatDate(task.deadline)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button variant="brand" size="sm" className="shrink-0 gap-1.5" asChild>
                      <Link href={`/editor/tasks/${task.projectId}`}>
                        {editingActionLabel(task.status)}
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">مهلت‌های پیش‌رو</CardTitle>
            <CardDescription>پروژه‌هایی که نزدیک به مهلت هستند</CardDescription>
          </CardHeader>
          <CardContent>
            {!upcomingDeadlines.length ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                مهلت فعالی وجود ندارد
              </p>
            ) : (
              <ul className="space-y-2">
                {upcomingDeadlines.map((task) => (
                  <li
                    key={task.id}
                    className={cn(
                      "rounded-xl border p-3",
                      task.overdue
                        ? "border-destructive/30 bg-destructive/[0.03]"
                        : "border-border/70",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-medium">{task.title}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge
                            variant={editingPriorityVariant(task.priority)}
                            className="font-normal"
                          >
                            {EDITING_PRIORITY_LABEL[task.priority || "NORMAL"]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {task.deadline ? formatDate(task.deadline) : "—"} ·{" "}
                            {formatRemainingTime(task.remainingMs)}
                          </span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/editor/tasks/${task.projectId}`}>باز کردن</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
