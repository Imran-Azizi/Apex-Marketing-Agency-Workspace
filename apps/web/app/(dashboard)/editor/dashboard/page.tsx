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
      <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden sm:space-y-6" dir="rtl">
        <Skeleton className="h-12 w-full rounded-2xl sm:h-16" />
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden animate-fade-slide sm:space-y-6" dir="rtl">
      <PageHeader
        title="میز کار ادیتور"
        inline
        className="mb-0"
        actions={
          <Button
            variant="brand"
            size="sm"
            className="h-8 max-w-full gap-1 px-2.5 text-xs sm:h-9 sm:gap-1.5 sm:px-3 sm:text-sm"
            asChild
          >
            <Link href="/editor/projects" className="min-w-0">
              <Clapperboard className="hidden h-4 w-4 sm:block" />
              <span className="truncate">همه پروژه‌های ادیت</span>
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
            </Link>
          </Button>
        }
      />

      <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 p-4 pb-3 sm:p-6 sm:pb-3">
            <div className="min-w-0">
              <CardTitle className="text-base">پروژه‌های اخیر</CardTitle>
              <CardDescription className="mt-0.5 leading-snug">
                آخرین تکالیف ارجاع‌شده توسط مدیر
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="h-8 shrink-0 px-2.5" asChild>
              <Link href="/editor/projects">همه</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {!recent.length ? (
              <EmptyState
                title="پروژه‌ای ارجاع نشده"
                description="پس از ارجاع توسط مدیر، اینجا نمایش داده می‌شود."
              />
            ) : (
              <ul className="space-y-2.5">
                {recent.map((task) => (
                  <li
                    key={task.id}
                    className="min-w-0 rounded-xl border border-border/70 p-3 sm:flex sm:items-center sm:justify-between sm:gap-3"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium leading-snug sm:text-base">
                          {task.title}
                        </p>
                        <Badge
                          variant={
                            task.projectStatus === "COMPLETED"
                              ? "success"
                              : editingStatusVariant(task.status)
                          }
                          className="max-w-[40%] shrink-0 truncate font-normal"
                        >
                          {task.projectStatus === "COMPLETED"
                            ? "تکمیل‌شده"
                            : EDITING_STATUS_LABEL[task.status] || task.status}
                        </Badge>
                      </div>
                      {(task.assignedAt || task.deadline) && (
                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {task.assignedAt && (
                            <span className="inline-flex min-w-0 items-center gap-1">
                              <CalendarClock className="h-3 w-3 shrink-0" />
                              <span className="truncate">{formatDate(task.assignedAt)}</span>
                            </span>
                          )}
                          {task.deadline && (
                            <span className="inline-flex min-w-0 items-center gap-1">
                              <Clock3 className="h-3 w-3 shrink-0" />
                              <span className="truncate">{formatDate(task.deadline)}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="brand"
                      size="sm"
                      className="mt-3 h-8 w-full shrink-0 gap-1.5 sm:mt-0 sm:w-auto"
                      asChild
                    >
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

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base">مهلت‌های پیش‌رو</CardTitle>
            <CardDescription>پروژه‌هایی که نزدیک به مهلت هستند</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
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
                      "min-w-0 rounded-xl border p-3",
                      task.overdue
                        ? "border-destructive/30 bg-destructive/[0.03]"
                        : "border-border/70",
                    )}
                  >
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-medium">{task.title}</p>
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <Badge
                            variant={editingPriorityVariant(task.priority)}
                            className="font-normal"
                          >
                            {EDITING_PRIORITY_LABEL[task.priority || "NORMAL"]}
                          </Badge>
                          <span className="min-w-0 break-words text-xs text-muted-foreground">
                            {task.deadline ? formatDate(task.deadline) : "—"} ·{" "}
                            {formatRemainingTime(task.remainingMs)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-full shrink-0 sm:w-auto"
                        asChild
                      >
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
