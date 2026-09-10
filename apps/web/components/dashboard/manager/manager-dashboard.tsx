"use client";

import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  Banknote,
  Building2,
  CheckCircle2,
  Clock3,
  CircleDot,
  Clapperboard,
  FolderKanban,
  LayoutDashboard,
  Mic2,
  PiggyBank,
  Receipt,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { getMe } from "@/lib/auth";
import {
  financeDashboardQueryUrl,
  financeHasActivity,
  financeKpisLoaded,
  managerFinanceCardsFromKpis,
} from "@/lib/finance-kpis";
import type { FinanceDashboard } from "@/app/(dashboard)/finance/_components/types";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { getProjectStatusLabel } from "@/lib/project-status";
import { resolveCurrentStageLabel } from "@/lib/project-progress";
import { ProjectProgressBar } from "@/components/projects/project-progress-bar";
import { HorizontalScroll } from "@/components/shared/horizontal-scroll";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { DateRangePills } from "@/components/shared/date-range-pills";
import {
  EMPTY_DATE_RANGE,
  dateRangeQueryParams,
  isDateRangeReady,
} from "@/lib/date-range";
import { computeManagerMetrics, assigneeName } from "./compute-metrics";
import {
  EmptyInline,
  KpiCard,
  KpiSkeletonGrid,
  PriorityDot,
  SectionError,
  SectionShell,
} from "./widgets";
import type {
  DashboardSummary,
  DateRange,
  ManagerProject,
} from "./types";

const BusinessCharts = lazy(() =>
  import("./charts").then((m) => ({ default: m.BusinessCharts })),
);

const FINANCE_ICONS: LucideIcon[] = [
  Wallet,
  Banknote,
  Receipt,
  Activity,
  Building2,
  Mic2,
  Clapperboard,
  TrendingUp,
  PiggyBank,
];

const PROJECT_KPI_ICONS: LucideIcon[] = [
  FolderKanban,
  Activity,
  CheckCircle2,
  Clock3,
  CircleDot,
];

/**
 * Isolated live clock — ticks every second without re-rendering the dashboard tree.
 */
function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const tick = () => setNow(new Date());
    const delay = 1000 - (Date.now() % 1000);
    const timeoutId = setTimeout(() => {
      tick();
      intervalId = setInterval(tick, 1000);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return (
    <p className={className} suppressHydrationWarning>
      <span>{formatDate(now)}</span>
      <span className="mx-1.5 text-muted-foreground/40" aria-hidden>
        ·
      </span>
      <time
        dateTime={now.toISOString()}
        dir="ltr"
        className="inline-block tabular-nums tracking-tight [unicode-bidi:isolate]"
      >
        {formatTime(now)}
      </time>
    </p>
  );
}

function PulseChip({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand/30 hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5 text-brand" aria-hidden />
      <span>{label}</span>
      <span
        className="font-semibold tabular-nums text-foreground"
        dir="ltr"
        style={{ unicodeBidi: "isolate" }}
      >
        {new Intl.NumberFormat("fa-AF", { numberingSystem: "latn" }).format(
          value,
        )}
      </span>
    </Link>
  );
}

export function ManagerDashboard() {
  const [range, setRange] = useState<DateRange>(EMPTY_DATE_RANGE);

  const me = useQuery({
    queryKey: ["me", "internal"],
    queryFn: getMe,
    staleTime: 60_000,
  });

  const summary = useQuery({
    queryKey: ["dashboard-summary", "MANAGER"],
    queryFn: () => apiGet<DashboardSummary>("/projects/dashboard-summary"),
  });

  const projects = useQuery({
    queryKey: ["projects-home", "MANAGER"],
    queryFn: async () => {
      const res = await apiGet<{ items: ManagerProject[] }>(
        "/projects?page=1&pageSize=100",
      );
      return res.items;
    },
  });

  const financeQuery = useQuery({
    queryKey: [
      "finance-dashboard",
      "manager",
      range.preset,
      dateRangeQueryParams(range),
    ],
    queryFn: () => apiGet<FinanceDashboard>(financeDashboardQueryUrl(range)),
    enabled: isDateRangeReady(range),
    placeholderData: keepPreviousData,
  });

  const metrics = useMemo(() => {
    if (!projects.data && !summary.data) return null;
    return computeManagerMetrics({
      projects: projects.data || [],
      summary: summary.data,
      range,
      financeMonthly: financeQuery.data?.monthly,
    });
  }, [projects.data, summary.data, range, financeQuery.data?.monthly]);

  const financeCards = useMemo(() => {
    const kpis = financeQuery.data?.kpis;
    if (!financeKpisLoaded(kpis)) return null;
    return managerFinanceCardsFromKpis(kpis);
  }, [financeQuery.data?.kpis]);

  const financeActivity = financeQuery.data?.kpis
    ? financeHasActivity(financeQuery.data.kpis)
    : false;

  const projectsLoading = projects.isLoading && !projects.data;
  const summaryLoading = summary.isLoading && !summary.data;
  const financeLoading = financeQuery.isLoading && !financeQuery.data;
  const isBootstrapping = projectsLoading && summaryLoading && financeLoading;

  const isFatalError =
    projects.isError &&
    summary.isError &&
    financeQuery.isError &&
    !projects.data &&
    !summary.data &&
    !financeQuery.data;

  const managerName = me.data?.fullName || "مدیر";
  const systemOk =
    !projects.isError && !summary.isError && !financeQuery.isError;

  const refetchAll = () => {
    void summary.refetch();
    void projects.refetch();
    void financeQuery.refetch();
  };

  if (isFatalError) {
    return (
      <EmptyState
        title="بارگذاری داشبورد ناموفق بود"
        description="اتصال به سرور برقرار نشد. صفحه را تازه‌سازی کنید."
        action={
          <Button type="button" onClick={refetchAll}>
            <RefreshCw className="ms-1 h-4 w-4" />
            تلاش مجدد
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5 animate-fade-slide sm:space-y-6" dir="rtl">
      <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-bl from-brand/[0.07] via-card to-card p-4 shadow-sm sm:p-5">
        <div
          className="pointer-events-none absolute -start-16 -top-16 h-40 w-40 rounded-full bg-brand/10 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand">
                <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
                داشبورد مدیریت
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                  systemOk
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-destructive/30 bg-destructive/10 text-destructive",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    systemOk ? "bg-emerald-500" : "bg-destructive",
                  )}
                  aria-hidden
                />
                {systemOk ? "سیستم آنلاین" : "خطا در همگام‌سازی"}
              </span>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">
                خوش آمدید، {managerName}
              </h1>
              <LiveClock className="text-sm text-muted-foreground" />
            </div>
            {metrics ? (
              <div className="flex flex-wrap gap-2">
                <PulseChip
                  icon={Users}
                  label="سرنخ امروز"
                  value={metrics.crmPulse.leadsToday}
                  href="/crm"
                />
                <PulseChip
                  icon={Clock3}
                  label="پیگیری سررسید"
                  value={metrics.crmPulse.followUpsDue}
                  href="/crm"
                />
              </div>
            ) : null}
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <DateRangePills
              range={range}
              onChange={setRange}
              ariaLabel="فیلتر بازه زمانی داشبورد"
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="self-start rounded-full sm:self-end"
              onClick={refetchAll}
              disabled={
                summary.isFetching ||
                projects.isFetching ||
                financeQuery.isFetching
              }
            >
              <RefreshCw
                className={cn(
                  "ms-1 h-3.5 w-3.5",
                  (summary.isFetching ||
                    projects.isFetching ||
                    financeQuery.isFetching) &&
                    "animate-spin",
                )}
              />
              بروزرسانی
            </Button>
          </div>
        </div>
      </header>

      {/* Finance KPIs — always from /finance/dashboard */}
      <SectionShell
        title="نمای مالی"
        description="خلاصه اجرایی درآمد قرارداد، دریافتی تأییدشده و سود — هم‌راستا با بخش مالی"
        action={
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href="/finance">
              داشبورد مالی
              <ArrowUpRight className="ms-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        }
        className="border-brand/15 bg-gradient-to-bl from-brand/[0.05] via-card to-card"
      >
        {financeLoading ? (
          <KpiSkeletonGrid count={9} cols="finance" />
        ) : financeQuery.isError && !financeCards ? (
          <SectionError
            message="بارگذاری شاخص‌های مالی ناموفق بود."
            onRetry={() => void financeQuery.refetch()}
          />
        ) : financeCards ? (
          financeActivity ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {financeCards.map((card, i) => (
                <KpiCard
                  key={card.key}
                  metric={card}
                  icon={FINANCE_ICONS[i % FINANCE_ICONS.length]}
                />
              ))}
            </div>
          ) : (
            <EmptyInline message="هنوز داده مالی ثبت نشده است. پس از ثبت قرارداد یا پرداخت تأییدشده، این بخش به‌روز می‌شود." />
          )
        ) : (
          <EmptyInline message="دسترسی به داده مالی در دسترس نیست." />
        )}
      </SectionShell>

      {/* Project KPIs */}
      <SectionShell
        title="شاخص‌های پروژه"
        description="وضعیت کلی سبد پروژه‌ها بر اساس داده زنده سیستم"
      >
        {isBootstrapping || (!metrics && (projectsLoading || summaryLoading)) ? (
          <KpiSkeletonGrid count={5} cols="projects" />
        ) : summary.isError && projects.isError && !metrics ? (
          <SectionError
            message="بارگذاری شاخص‌های پروژه ناموفق بود."
            onRetry={() => {
              void summary.refetch();
              void projects.refetch();
            }}
          />
        ) : metrics ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {metrics.kpis.projects.map((m, i) => (
              <KpiCard
                key={m.key}
                metric={m}
                icon={PROJECT_KPI_ICONS[i % PROJECT_KPI_ICONS.length]}
              />
            ))}
          </div>
        ) : (
          <EmptyInline message="پروژه‌ای برای نمایش شاخص‌ها یافت نشد." />
        )}
      </SectionShell>

      {metrics ? (
        <Suspense
          fallback={
            <div className="grid gap-4 xl:grid-cols-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className={cn(
                    "h-[320px] rounded-2xl",
                    i === 2 && "xl:col-span-2",
                  )}
                />
              ))}
            </div>
          }
        >
          <BusinessCharts metrics={metrics} />
        </Suspense>
      ) : projectsLoading || summaryLoading || financeLoading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn("h-[320px] rounded-2xl", i === 2 && "xl:col-span-2")}
            />
          ))}
        </div>
      ) : null}

      <SectionShell
        title="پروژه‌های اخیر"
        description="آخرین به‌روزرسانی‌ها با مرحله، پیشرفت و مهلت"
        action={
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href="/projects">
              همه پروژه‌ها
              <ArrowUpRight className="ms-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      >
        {projectsLoading && !metrics ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : projects.isError && !projects.data ? (
          <SectionError
            message="بارگذاری فهرست پروژه‌ها ناموفق بود."
            onRetry={() => void projects.refetch()}
          />
        ) : !metrics || metrics.recentProjects.length === 0 ? (
          <EmptyInline message="پروژه‌ای در این بازه یافت نشد." />
        ) : (
          <HorizontalScroll className="rounded-xl border-border/60">
            <Table className="min-w-[56rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>پروژه</TableHead>
                  <TableHead>مشتری</TableHead>
                  <TableHead>ادیتور</TableHead>
                  <TableHead>مرحله</TableHead>
                  <TableHead>اولویت</TableHead>
                  <TableHead>پیشرفت</TableHead>
                  <TableHead>مهلت</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>به‌روزرسانی</TableHead>
                  <TableHead className="w-[1%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.recentProjects.map((p) => {
                  const overdue =
                    !!p.deadlineAt &&
                    p.status !== "COMPLETED" &&
                    p.status !== "CANCELED" &&
                    new Date(p.deadlineAt) < new Date();
                  const priority = overdue
                    ? "critical"
                    : p.deadlineAt &&
                        new Date(p.deadlineAt).getTime() - Date.now() <
                          2 * 86400000
                      ? "high"
                      : "medium";
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="min-w-[140px]">
                          <p className="font-medium">{p.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.code}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.crmCustomer?.personName || "—"}
                      </TableCell>
                      <TableCell>{assigneeName(p, "EDITOR")}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {resolveCurrentStageLabel(
                            p.progress,
                            getProjectStatusLabel(p.status),
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <PriorityDot priority={priority} />
                      </TableCell>
                      <TableCell className="min-w-[140px]">
                        <ProjectProgressBar
                          progress={p.progress}
                          status={p.status}
                          variant="compact"
                          showTitle={false}
                        />
                      </TableCell>
                      <TableCell>
                        {p.deadlineAt ? formatDate(p.deadlineAt) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            p.status === "COMPLETED"
                              ? "success"
                              : p.status === "CANCELED"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {getProjectStatusLabel(p.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(p.updatedAt)}
                      </TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/projects/${p.id}`}>باز کردن</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </HorizontalScroll>
        )}
      </SectionShell>
    </div>
  );
}
