"use client";

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

export function PortalProjectCard({
  project,
  variant = "card",
}: PortalProjectCardProps) {
  const thumb = projectThumbnailUrl(project.thumbnailStorageKey, {
    url: project.thumbnailUrl,
  });

  if (variant === "row") {
    return (
      <Card
        dir="rtl"
        className="overflow-hidden rounded-xl border shadow-sm transition-colors hover:border-brand/30"
      >
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-3.5">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Thumb thumb={thumb} title={project.title} size="md" />
            <div className="min-w-0 flex-1 space-y-1.5 text-start">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-semibold leading-snug">
                  {project.title}
                </h3>
                <PortalStatusBadge
                  status={project.status}
                  className="h-5 px-1.5 text-[10px]"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                <bdi dir="ltr">{project.code}</bdi>
              </p>
              <ProjectProgressBar
                progress={project.progress}
                status={project.status}
                variant="compact"
                showTitle={false}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:shrink-0">
            <MetaInline label="ایجاد" value={formatDate(project.createdAt)} />
            <MetaInline label="بروزرسانی" value={formatDate(project.updatedAt)} />
            <div className="text-start">
              <p className="text-[10px] text-muted-foreground">پرداخت</p>
              <Badge
                variant="secondary"
                className="mt-0.5 h-5 px-1.5 text-[10px] font-medium"
              >
                {projectPaymentLabel(project.status)}
              </Badge>
            </div>
            {project.budget != null && (
              <MetaInline
                label="بودجه"
                value={formatCurrency(project.budget)}
                ltr
              />
            )}
          </div>

          <Button asChild variant="brand" size="sm" className="h-8 gap-1.5 sm:shrink-0">
            <Link href={`/portal/projects/${project.id}`}>
              <Eye className="h-3.5 w-3.5" />
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
      className="overflow-hidden rounded-2xl border border-border/70 text-start shadow-sm transition-colors hover:border-brand/35"
    >
      <Link
        href={`/portal/projects/${project.id}`}
        className="block p-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <div className="flex items-start gap-3">
          <Thumb thumb={thumb} title={project.title} size="sm" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="line-clamp-2 text-sm font-semibold leading-6">
                  {project.title}
                </h3>
                <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                  <bdi dir="ltr">{project.code}</bdi>
                </p>
              </div>
              <PortalStatusBadge
                status={project.status}
                className="h-5 shrink-0 px-1.5 text-[10px]"
              />
            </div>

            <ProjectProgressBar
              progress={project.progress}
              status={project.status}
              variant="compact"
              showTitle={false}
            />

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
              <span>{formatDate(project.createdAt)}</span>
              <span className="text-border">·</span>
              <span>{projectPaymentLabel(project.status)}</span>
              {project.budget != null ? (
                <>
                  <span className="text-border">·</span>
                  <bdi dir="ltr" className="font-medium text-foreground">
                    {formatCurrency(project.budget)}
                  </bdi>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </Link>

      <div className="border-t border-border/60 px-3 py-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-8 w-full gap-1.5 text-brand hover:bg-brand/5 hover:text-brand"
        >
          <Link href={`/portal/projects/${project.id}`}>
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
  size: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-lg border bg-muted",
        size === "sm" ? "h-11 w-11" : "h-14 w-14",
      )}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt={title} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <FolderKanban className={size === "sm" ? "h-4 w-4" : "h-6 w-6"} />
        </div>
      )}
    </div>
  );
}

function MetaInline({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="text-start">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">
        {ltr ? <bdi dir="ltr">{value}</bdi> : value}
      </p>
    </div>
  );
}
