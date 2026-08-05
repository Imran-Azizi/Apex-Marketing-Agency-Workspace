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
  const thumb = projectThumbnailUrl(project.thumbnailStorageKey);

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
      className="flex h-full flex-col overflow-hidden rounded-xl border text-start shadow-sm transition-colors hover:border-brand/30"
    >
      <div className="flex items-start gap-3 p-3.5 pb-3">
        <Thumb thumb={thumb} title={project.title} size="sm" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
                {project.title}
              </h3>
              <p className="text-xs text-muted-foreground">
                <bdi dir="ltr">{project.code}</bdi>
              </p>
            </div>
            <PortalStatusBadge
              status={project.status}
              className="h-5 shrink-0 px-1.5 text-[10px]"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 px-3.5 pb-3">
        <ProjectProgressBar
          progress={project.progress}
          status={project.status}
          variant="compact"
          showTitle={false}
        />
        <div className="grid grid-cols-2 gap-2 text-xs">
          <MetaCell label="ایجاد" value={formatDate(project.createdAt)} />
          <MetaCell label="بروزرسانی" value={formatDate(project.updatedAt)} />
          <MetaCell
            label="پرداخت"
            value={projectPaymentLabel(project.status)}
          />
          {project.deadlineAt && (
            <MetaCell
              label="مهلت"
              value={formatDate(project.deadlineAt)}
            />
          )}
          {project.budget != null && (
            <MetaCell
              label="بودجه"
              value={formatCurrency(project.budget)}
              ltr
              className="col-span-2"
            />
          )}
        </div>
      </div>

      <div className="mt-auto border-t bg-muted/20 p-2.5">
        <Button asChild variant="brand" size="sm" className="h-8 w-full gap-1.5">
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
        size === "sm" ? "h-12 w-12" : "h-14 w-14",
      )}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt={title} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <FolderKanban className={size === "sm" ? "h-5 w-5" : "h-6 w-6"} />
        </div>
      )}
    </div>
  );
}

function MetaCell({
  label,
  value,
  ltr,
  className,
}: {
  label: string;
  value: string;
  ltr?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg bg-muted/40 px-2.5 py-1.5", className)}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium text-foreground">
        {ltr ? <bdi dir="ltr">{value}</bdi> : value}
      </p>
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
