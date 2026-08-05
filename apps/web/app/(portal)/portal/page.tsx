"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Layers,
  Receipt,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { getMe, getDisplayName, isPortalUser } from "@/lib/auth";
import { type PortalDashboard } from "@/lib/portal";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreateProjectButton } from "@/components/portal/create-project-button";
import { DashboardHeader } from "@/components/portal/dashboard-header";
import { StatCard } from "@/components/portal/stat-card";
import { FinancialCard } from "@/components/portal/financial-card";
import { PortalProjectCard } from "@/components/portal/portal-project-card";

export default function PortalDashboardPage() {
  const { data: me } = useQuery({
    queryKey: ["me", "portal"],
    queryFn: getMe,
    staleTime: 60_000,
  });

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["portal-dashboard"],
    queryFn: () => apiGet<PortalDashboard>("/portal/dashboard"),
    retry: 1,
  });

  if (isLoading) {
    return (
      <div dir="rtl" className="space-y-4 text-start">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div dir="rtl" className="text-start">
        <EmptyState
          title="بارگذاری داشبورد ناموفق بود"
          description="اتصال به سرور برقرار نشد. لطفاً دوباره تلاش کنید."
          action={
            <Button
              variant="brand"
              className="gap-2"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw
                className={cn("h-4 w-4", isFetching && "animate-spin")}
              />
              تلاش مجدد
            </Button>
          }
        />
      </div>
    );
  }

  const customerName = (isPortalUser(me) ? getDisplayName(me) : "") || "مشتری";

  const actionNeeded = Math.max(
    data.pendingApprovals.length,
    data.stats.underReview,
  );

  const projectStats = [
    {
      title: "کل پروژه‌ها",
      value: data.stats.total,
      description: "تمام پروژه‌های ثبت‌شده",
      icon: FolderKanban,
      tone: "bg-brand/10 text-brand",
    },
    {
      title: "پروژه‌های فعال",
      value: data.stats.active,
      description: "در حال پیگیری و اجرا",
      icon: Layers,
      tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    },
    {
      title: "پروژه‌های تکمیل‌شده",
      value: data.stats.completed,
      description: "تحویل نهایی شده",
      icon: CheckCircle2,
      tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    {
      title: "در انتظار بررسی",
      value: data.stats.underReview,
      description: "نیازمند بازبینی تیم یا شما",
      icon: Clock3,
      tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    },
    {
      title: "نیازمند اقدام",
      value: actionNeeded,
      description: "تأیید در انتظار شماست",
      icon: AlertCircle,
      tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      trend: actionNeeded > 0 ? "اقدام لازم" : undefined,
    },
  ];

  const hasFinance =
    data.financial.totalProjectValue !== 0 || data.financial.totalPaid !== 0;

  return (
    <div dir="rtl" className="space-y-5 text-start md:space-y-6">
      <DashboardHeader
        customerName={customerName}
        canCreateProject={data.canCreateProject}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {projectStats.map((s) => (
          <StatCard
            key={s.title}
            title={s.title}
            value={s.value}
            description={s.description}
            icon={s.icon}
            iconClassName={s.tone}
            trend={s.trend}
          />
        ))}
      </section>

      <section className="space-y-3">
        <SectionTitle>نمای مالی</SectionTitle>
        {!hasFinance ? (
          <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
            اطلاعات پرداخت هنوز ثبت نشده است.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <FinancialCard
              title="ارزش کل پروژه‌ها"
              amount={formatCurrency(data.financial.totalProjectValue)}
              icon={Wallet}
              iconClassName="bg-muted text-muted-foreground"
              status="مجموع"
            />
            <FinancialCard
              title="پرداخت‌شده"
              amount={formatCurrency(data.financial.totalPaid)}
              icon={CheckCircle2}
              iconClassName="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              status="دریافت‌شده"
              statusTone="success"
            />
            <FinancialCard
              title="مانده حساب"
              amount={formatCurrency(data.financial.remainingBalance)}
              icon={Receipt}
              iconClassName="bg-brand/10 text-brand"
              status="باقی‌مانده"
              statusTone="brand"
              highlight
            />
            <FinancialCard
              title="آخرین پرداخت"
              amount={
                data.financial.lastPaymentDate
                  ? formatDate(data.financial.lastPaymentDate)
                  : "—"
              }
              icon={Clock3}
              iconClassName="bg-sky-500/10 text-sky-700 dark:text-sky-300"
              status="تاریخ"
            />
          </div>
        )}
      </section>

      {data.pendingApprovals.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>اقدامات ضروری</SectionTitle>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {data.pendingApprovals.map((v) => (
              <Link
                key={v.id}
                href={`/portal/projects/${v.project.id}`}
                className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/50 px-4 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-md dark:border-amber-500/30 dark:bg-amber-500/10"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-semibold">
                    {v.project.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <bdi dir="ltr">{v.project.code}</bdi>
                    {" — "}
                    نسخه{" "}
                    {v.versionNumber.toLocaleString("fa-AF", {
                      numberingSystem: "latn",
                    })}
                  </p>
                </div>
                <Badge className="shrink-0 bg-amber-500/15 text-amber-800 hover:bg-amber-500/20 dark:text-amber-200">
                  نیاز به تأیید
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle className="mb-0">پروژه‌های اخیر</SectionTitle>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-brand"
          >
            <Link href="/portal/projects">
              مشاهده همه
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {data.recentProjects.length === 0 ? (
          <Card className="overflow-hidden rounded-2xl border-dashed shadow-none">
            <CardContent className="relative py-4">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--brand)/0.08),transparent_55%)]" />
              <EmptyState
                className="border-0 bg-transparent py-12"
                title="هنوز پروژه‌ای ندارید"
                description="اولین پروژه خود را ایجاد کنید تا پیشرفت، فایل‌ها و پرداخت‌ها اینجا نمایش داده شوند."
                action={
                  <CreateProjectButton
                    canCreate={data.canCreateProject}
                    size="lg"
                    className="h-11 px-6 shadow-md shadow-brand/20"
                  />
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {data.recentProjects.map((p) => (
              <PortalProjectCard key={p.id} project={p} variant="row" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn("text-sm font-semibold text-foreground", className)}>
      {children}
    </h2>
  );
}
