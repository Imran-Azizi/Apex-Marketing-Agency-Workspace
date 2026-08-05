"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Mic2,
  RefreshCw,
  Send,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  NARRATION_STATUS_LABEL,
  NARRATION_PRIORITY_LABEL,
  formatRemainingTime,
  narrationActionLabel,
  narrationPriorityVariant,
  narrationStatusVariant,
  type NarratorTaskSummary,
} from "@/lib/narrator";
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
import { STATUS_PIGMENT } from "@/lib/theme-tones";

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
  statusBreakdown: Array<{ status: string; label: string; count: number }>;
  recent: NarratorTaskSummary[];
  upcomingDeadlines: NarratorTaskSummary[];
};

function ProgressBar({
  items,
}: {
  items: Array<{ status: string; label: string; count: number }>;
}) {
  const total = items.reduce((s, i) => s + i.count, 0) || 1;
  const colors: Record<string, string> = {
    PENDING_NARRATION: STATUS_PIGMENT.brand,
    RECORDING_IN_PROGRESS: STATUS_PIGMENT.info,
    NARRATION_SUBMITTED: STATUS_PIGMENT.warning,
    REVISION_REQUESTED: STATUS_PIGMENT.caution,
    APPROVED: STATUS_PIGMENT.success,
  };

  return (
    <div className="space-y-4">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {items.map((item) => (
          <div
            key={item.status}
            className={cn(
              "h-full transition-all duration-500",
              colors[item.status] || STATUS_PIGMENT.muted,
            )}
            style={{ width: `${(item.count / total) * 100}%` }}
            title={`${item.label}: ${item.count}`}
          />
        ))}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li
            key={item.status}
            className="flex items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm"
          >
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  colors[item.status] || STATUS_PIGMENT.muted,
                )}
              />
              {item.label}
            </span>
            <span className="font-semibold tabular-nums">{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function NarratorDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["narrator-dashboard"],
    queryFn: () => apiGet<DashboardPayload>("/narration/dashboard"),
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

  const { stats, statusBreakdown, recent, upcomingDeadlines } = data;

  return (
    <div className="space-y-6 animate-fade-slide" dir="rtl">
      <PageHeader
        title="میز کار نریتور"
        subtitle="نمای کلی تکالیف نریشن، مهلت‌ها و پیشرفت کار — فقط نریشن‌های ارسال‌شده به شما"
        actions={
          <Button variant="brand" className="gap-2" asChild>
            <Link href="/narrator/projects">
              <Mic2 className="h-4 w-4" />
              همه نریشن‌ها
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="کل نریشن‌های ارجاع‌شده"
          value={stats.total.toLocaleString("fa-AF", { numberingSystem: "latn" })}
          icon={Mic2}
          tone="brand"
        />
        <StatCard
          title="در انتظار ضبط"
          value={stats.pending.toLocaleString("fa-AF", { numberingSystem: "latn" })}
          icon={Clock3}
          hint="نریشن‌های جدید"
        />
        <StatCard
          title="در حال کار"
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">نمای پیشرفت</CardTitle>
          <CardDescription>
            توزیع وضعیت نریشن‌های ارجاع‌شده به شما
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProgressBar items={statusBreakdown} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">نریشن‌های اخیر</CardTitle>
              <CardDescription>آخرین تکالیف ارسال‌شده توسط مدیر</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/narrator/projects">همه</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!recent.length ? (
              <EmptyState
                title="نریشنی ارسال نشده"
                description="پس از ارسال توسط مدیر، اینجا نمایش داده می‌شود."
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
                          variant={narrationStatusVariant(task.status)}
                          className="font-normal"
                        >
                          {NARRATION_STATUS_LABEL[task.status] || task.status}
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
                      <Link href={`/narrator/tasks/${task.projectId}`}>
                        {narrationActionLabel(task.status)}
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
            <CardDescription>نریشن‌هایی که نزدیک به مهلت هستند</CardDescription>
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
                            variant={narrationPriorityVariant(task.priority)}
                            className="font-normal"
                          >
                            {NARRATION_PRIORITY_LABEL[task.priority || "NORMAL"]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {task.deadline ? formatDate(task.deadline) : "—"} ·{" "}
                            {formatRemainingTime(task.remainingMs)}
                          </span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/narrator/tasks/${task.projectId}`}>باز کردن</Link>
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
