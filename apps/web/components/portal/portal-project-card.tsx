"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Eye, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PortalStatusBadge } from "@/components/portal/portal-status-badge";
import { type PortalProjectSummary, projectThumbnailUrl } from "@/lib/portal";
import { projectPaymentLabel } from "@/lib/portal-dashboard";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ProjectProgressBar } from "@/components/projects/project-progress-bar";

type PortalProjectCardProps = {
  project: PortalProjectSummary;
  /** `card` = stacked card (lists/mobile). `row` = full-width dense row (dashboard). */
  variant?: "card" | "row";
};

function paymentBadgeClass(status: string) {
  if (status === "WAITING_PAYMENT") {
    return "border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200";
  }
  if (status === "COMPLETED" || status === "READY_DELIVERY") {
    return "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200";
  }
  return "border-border/70 bg-muted/60 text-muted-foreground";
}

export function PortalProjectCard({
  project,
  variant = "card",
}: PortalProjectCardProps) {
  const thumb = projectThumbnailUrl(project.thumbnailStorageKey, {
    url: project.thumbnailUrl,
  });
  const href = `/portal/projects/${project.id}`;
  const paymentLabel = projectPaymentLabel(project.status);

  if (variant === "row") {
    return (
      <Card
        dir="rtl"
        className="group overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-all hover:border-brand/35 hover:shadow-md"
      >
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:gap-6">
          {/* Identity + progress */}
          <div className="flex min-w-0 flex-1 items-start gap-3.5">
            <Thumb thumb={thumb} title={project.title} size="lg" />
            <div className="min-w-0 flex-1 space-y-3 text-start">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="min-w-0 truncate text-[15px] font-semibold leading-snug tracking-tight text-foreground">
                    {project.title}
                  </h3>
                  <PortalStatusBadge
                    status={project.status}
                    className="h-6 shrink-0 px-2 text-[11px] font-medium"
                  />
                </div>
                <p className="text-xs tabular-nums tracking-wide text-muted-foreground">
                  <bdi dir="ltr">{project.code}</bdi>
                </p>
              </div>

              <ProjectProgressBar
                progress={project.progress}
                status={project.status}
                variant="inline"
                className="max-w-sm"
              />
            </div>
          </div>

          {/* Meta grid */}
          <div
            className={cn(
              "grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-3",
              "sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-x-reverse sm:divide-border/60",
              "lg:min-w-[22rem] lg:shrink-0 lg:px-0 lg:py-2.5",
            )}
          >
            <MetaCell label="ایجاد" value={formatDate(project.createdAt)} />
            <MetaCell label="بروزرسانی" value={formatDate(project.updatedAt)} />
            <MetaCell label="پرداخت">
              <Badge
                variant="outline"
                className={cn(
                  "mt-0.5 h-6 border px-2 text-[11px] font-medium",
                  paymentBadgeClass(project.status),
                )}
              >
                {paymentLabel}
              </Badge>
            </MetaCell>
            <MetaCell
              label="بودجه"
              value={
                project.budget != null ? formatCurrency(project.budget) : "—"
              }
              ltr={project.budget != null}
              emphasize={project.budget != null}
            />
          </div>

          {/* Action */}
          <Button
            asChild
            variant="brand"
            size="sm"
            className="h-10 w-full gap-2 rounded-xl px-4 shadow-sm shadow-brand/15 sm:w-auto lg:shrink-0"
          >
            <Link href={href}>
              <Eye className="h-4 w-4" />
              مشاهده جزئیات
            </Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      dir="rtl"
      className="group overflow-hidden rounded-2xl border border-border/70 text-start shadow-sm transition-all hover:border-brand/35 hover:shadow-md"
    >
      <Link
        href={href}
        className="block p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <div className="flex items-start gap-3.5">
          <Thumb thumb={thumb} title={project.title} size="md" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <h3 className="line-clamp-2 text-[15px] font-semibold leading-6 tracking-tight">
                  {project.title}
                </h3>
                <p className="text-xs tabular-nums tracking-wide text-muted-foreground">
                  <bdi dir="ltr">{project.code}</bdi>
                </p>
              </div>
              <PortalStatusBadge
                status={project.status}
                className="h-6 shrink-0 px-2 text-[11px] font-medium"
              />
            </div>

            <ProjectProgressBar
              progress={project.progress}
              status={project.status}
              variant="inline"
              showTitle={false}
            />

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              <span>{formatDate(project.createdAt)}</span>
              <span className="text-border" aria-hidden>
                ·
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "h-5 border px-1.5 text-[10px] font-medium",
                  paymentBadgeClass(project.status),
                )}
              >
                {paymentLabel}
              </Badge>
              {project.budget != null ? (
                <>
                  <span className="text-border" aria-hidden>
                    ·
                  </span>
                  <bdi dir="ltr" className="font-semibold text-foreground">
                    {formatCurrency(project.budget)}
                  </bdi>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </Link>

      <div className="border-t border-border/60 bg-muted/15 px-3 py-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-9 w-full gap-1.5 rounded-xl text-brand hover:bg-brand/5 hover:text-brand"
        >
          <Link href={href}>
            <Eye className="h-3.5 w-3.5" />
            مشاهده جزئیات
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function Thumb({
  thumb,
  title,
  size,
}: {
  thumb: string | null;
  title: string;
  size: "sm" | "md" | "lg";
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xl border border-border/70 bg-muted/80",
        size === "sm" && "h-11 w-11",
        size === "md" && "h-12 w-12",
        size === "lg" && "h-14 w-14 sm:h-16 sm:w-16",
      )}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt={title} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand/10 via-muted to-muted text-brand/70">
          <FolderKanban
            className={cn(
              size === "sm" && "h-4 w-4",
              size === "md" && "h-5 w-5",
              size === "lg" && "h-6 w-6",
            )}
          />
        </div>
      )}
    </div>
  );
}

function MetaCell({
  label,
  value,
  ltr,
  emphasize,
  children,
}: {
  label: string;
  value?: string;
  ltr?: boolean;
  emphasize?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0 text-start sm:px-3.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      {children ? (
        children
      ) : (
        <p
          className={cn(
            "mt-0.5 truncate text-xs leading-5",
            emphasize
              ? "font-semibold tabular-nums text-foreground"
              : "font-medium text-foreground",
          )}
        >
          {ltr ? <bdi dir="ltr">{value}</bdi> : value}
        </p>
      )}
    </div>
  );
}
