"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  flattenNavLinks,
  getNavItems,
  getRoleLabel,
  hasPermission,
  isFullAccessRole,
  type InternalRole,
} from "@/lib/rbac";
import { useMeQuery } from "@/lib/permissions";
import { PROJECT_STATUS_LABELS } from "@/lib/project-status";
import { ProjectProgressBar } from "@/components/projects/project-progress-bar";
import type { ProjectProgress } from "@/lib/project-progress";
import { formatLeadSource } from "@/app/(dashboard)/crm/_components/constants";

interface DashboardSummary {
  projectStatusCounts: Array<{ status: string; _count: number }>;
  leadsToday: number;
  followUpsDue: number;
}

interface ProjectListItem {
  id: string;
  code: string;
  title: string;
  status: string;
  updatedAt?: string;
  progress?: ProjectProgress | number | null;
  crmCustomer?: { personName?: string } | null;
}

interface CrmCustomer {
  id: string;
  personName: string;
  companyName: string | null;
  source: string | null;
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  salesOwner?: { fullName: string } | null;
}

interface CrmListResponse {
  items: CrmCustomer[];
  total: number;
}

const EDITOR_STATUS_HINT: Record<string, string> = {
  PRODUCTION_EDITING: "در حال ادیت",
  FINAL_REVISION: "نیاز به بازنگری",
  MANAGER_FINAL_REVIEW: "ارسال‌شده برای بررسی",
  CONTENT_GENERATION: "در انتظار",
  INTERNAL_CONTENT_REVIEW: "در انتظار",
};

const NARRATOR_STATUS_HINT: Record<string, string> = {
  NARRATION_RECORDING: "در حال ضبط",
  CONTENT_REVISION: "نیاز به بازنگری",
  PRODUCTION_EDITING: "ارسال‌شده",
  WAITING_CLIENT_CONTENT_APPROVAL: "در انتظار",
};

export function RoleDashboard({
  role,
  title,
  subtitle,
}: {
  role: InternalRole;
  title: string;
  subtitle: string;
}) {
  const { data: me } = useMeQuery();
  const isManagerLike = isFullAccessRole(role);
  const nav = flattenNavLinks(getNavItems(role, me?.permissions)).filter(
    (n) => !n.href.endsWith("/dashboard") && n.href !== `/${role.toLowerCase()}/dashboard`
  );

  const summary = useQuery({
    queryKey: ["dashboard-summary", role],
    queryFn: () => apiGet<DashboardSummary>("/projects/dashboard-summary"),
    enabled:
      hasPermission(me?.permissions, "dashboard.view", role) &&
      (isManagerLike || role === "SALES" || role === "FINANCE"),
  });

  const projects = useQuery({
    queryKey: ["projects-home", role],
    queryFn: () => apiGet<ProjectListItem[]>("/projects"),
    enabled: hasPermission(me?.permissions, "projects.view", role),
  });

  const editorTasks = useQuery({
    queryKey: ["editor-my-tasks-home", role],
    queryFn: () =>
      apiGet<
        Array<{
          id: string;
          projectId: string;
          status: string;
          title: string;
          deadline?: string | null;
        }>
      >("/production/my-tasks"),
    enabled: role === "EDITOR",
  });

  const narratorTasks = useQuery({
    queryKey: ["narration-my-tasks", role],
    queryFn: () =>
      apiGet<
        Array<{
          id: string;
          projectId: string;
          status: string;
          title: string;
          deadline?: string | null;
        }>
      >("/narration/my-tasks"),
    enabled: role === "NARRATOR",
  });

  const customers = useQuery({
    queryKey: ["crm-home", role],
    queryFn: () => apiGet<CrmListResponse>("/crm/customers?page=1&pageSize=8"),
    enabled: role === "SALES" || isManagerLike,
  });

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={`${subtitle} · نقش: ${getRoleLabel(role)}`}
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.href}
              asChild
              variant="outline"
              className="h-auto justify-start gap-3 px-4 py-4"
            >
              <Link href={item.href}>
                <Icon className="h-5 w-5 text-brand" />
                <span>{item.label}</span>
              </Link>
            </Button>
          );
        })}
      </div>

      {(isManagerLike || role === "SALES") && (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {summary.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">سرنخ امروز</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-bold">
                  {summary.data?.leadsToday ?? 0}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">پیگیری سررسید</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-bold">
                  {summary.data?.followUpsDue ?? 0}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">پروژه‌های فعال</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-bold">
                  {summary.data?.projectStatusCounts.reduce((s, c) => s + c._count, 0) ?? 0}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {role === "SALES" && (
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>مشتریان و سرنخ‌ها</CardTitle>
              <CardDescription>
                ثبت مشتری، پیگیری تعاملات و مشاهده وضعیت پروژه — بدون دسترسی به داده‌های پرداخت و مدیریت کارمندان
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {customers.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : !customers.data?.items.length ? (
                <p className="text-sm text-muted-foreground">مشتری ثبت نشده است.</p>
              ) : (
                <ul className="space-y-2">
                  {customers.data.items.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/crm/${c.id}`}
                        className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm hover:border-brand"
                      >
                        <span className="font-medium">
                          {c.personName}
                          {c.companyName ? (
                            <span className="ms-2 text-xs font-normal text-muted-foreground">
                              {c.companyName}
                            </span>
                          ) : null}
                        </span>
                        <div className="flex flex-col items-end gap-1 text-end">
                          {c.source ? (
                            <span className="text-xs text-muted-foreground">
                              {formatLeadSource(c.source)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">بدون منبع</span>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button asChild variant="brand">
                  <Link href="/crm">باز کردن CRM</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/sales/interactions">تعاملات مشتری</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>وضعیت پروژه‌های مشتری</CardTitle>
              <CardDescription>فقط مشاهده وضعیت — بدون ویرایش محتوای AI</CardDescription>
            </CardHeader>
            <CardContent>
              {projects.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : !projects.data?.length ? (
                <p className="text-sm text-muted-foreground">پروژه‌ای نیست.</p>
              ) : (
                <ul className="space-y-2">
                  {projects.data.slice(0, 8).map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/projects/${p.id}`}
                        className="block space-y-2 rounded-lg border px-4 py-3 text-sm hover:border-brand"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>
                            <span className="font-medium">{p.code}</span> —{" "}
                            {p.title}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {PROJECT_STATUS_LABELS[p.status] || p.status}
                          </span>
                        </div>
                        <ProjectProgressBar
                          progress={p.progress}
                          status={p.status}
                          variant="inline"
                          showTitle={false}
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {role === "EDITOR" && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>پروژه‌های ادیت</CardTitle>
            <CardDescription>
              داشبورد تحلیلی و فهرست پروژه‌های ارجاع‌شده — بدون دسترسی به پرداخت و
              مدیریت کاربران.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="brand">
                <Link href="/editor/dashboard">میز کار ادیتور</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/editor/projects">پروژه‌های ادیت</Link>
              </Button>
            </div>
            {editorTasks.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !editorTasks.data?.length ? (
              <p className="text-sm text-muted-foreground">پروژه‌ای ارجاع نشده است.</p>
            ) : (
              <ul className="space-y-2">
                {editorTasks.data.slice(0, 6).map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/editor/tasks/${task.projectId}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 text-sm hover:border-brand"
                    >
                      <span className="font-medium">{task.title}</span>
                      <Badge variant="outline">
                        {EDITOR_STATUS_HINT[task.status] ||
                          PROJECT_STATUS_LABELS[task.status] ||
                          task.status}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {role === "NARRATOR" && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>تکالیف نریشن</CardTitle>
            <CardDescription>
              داشبورد تحلیلی و فهرست نریشن‌های ارسال‌شده — بدون دسترسی به اطلاعات
              پروژه، مشتری یا پرداخت.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="brand">
                <Link href="/narrator/dashboard">میز کار نریتور</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/narrator/projects">پروژه‌های نریشن</Link>
              </Button>
            </div>
            {narratorTasks.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !narratorTasks.data?.length ? (
              <p className="text-sm text-muted-foreground">
                نریشنی ارسال نشده است.
              </p>
            ) : (
              <ul className="space-y-2">
                {narratorTasks.data.slice(0, 6).map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/narrator/tasks/${task.projectId}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 text-sm hover:border-brand"
                    >
                      <span className="font-medium">{task.title}</span>
                      <Badge variant="outline">
                        {NARRATOR_STATUS_HINT[task.status] ||
                          PROJECT_STATUS_LABELS[task.status] ||
                          task.status}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {role === "FINANCE" && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>پرداخت و پروژه‌ها</CardTitle>
            <CardDescription>
              ثبت و پیگیری پرداخت‌ها از CRM و مشاهده وضعیت پروژه‌ها
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="brand">
              <Link href="/crm">CRM و پرداخت‌ها</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/projects">پروژه‌ها</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {isManagerLike && (
        <Card>
          <CardHeader>
            <CardTitle>مدیریت کارمندان</CardTitle>
            <CardDescription>
              ایجاد و کنترل کاربران فروش، ادیتور و نریتور با دسترسی نقش‌محور
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="brand">
              <Link href="/employees">باز کردن مدیریت کارمندان</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
