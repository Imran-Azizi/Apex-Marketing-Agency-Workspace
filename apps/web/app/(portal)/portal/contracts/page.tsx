"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarDays, ChevronLeft, FileSignature, FolderOpen } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { PortalContractSummary } from "@/lib/contract-workspace";
import { formatCount } from "@/lib/contract-project";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const SECTION_META = {
  COMPANY: { label: "اطلاعات شرکت", icon: Building2 },
  ASSETS: { label: "دارایی ها", icon: FolderOpen },
  CALENDAR: { label: "تقویم محتوایی", icon: CalendarDays },
} as const;

const SECTION_ORDER = ["COMPANY", "ASSETS", "CALENDAR"] as const;

export default function PortalContractsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-contracts"],
    queryFn: () => apiGet<PortalContractSummary[]>("/portal/contracts"),
  });

  return (
    <div dir="rtl" className="space-y-4 text-start sm:space-y-6">
      <PageHeader
        title="قراردادها"
        subtitle="قراردادهای چندویدیویی شما و محتوایی که تیم اپکس برایتان ارسال کرده"
        subtitleClassName="hidden sm:block"
        inline
        className="mb-0 sm:mb-2"
      />

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <EmptyState title="بارگذاری قراردادها ناموفق بود" />
      ) : !data?.length ? (
        <EmptyState
          title="هنوز قراردادی ثبت نشده"
          description="قراردادهای چندویدیویی شما و محتوایی که تیم اپکس ارسال کند، اینجا نمایش داده می‌شود."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((contract) => {
            const sections = SECTION_ORDER.filter((key) => contract.sections.includes(key));
            return (
              <Link
                key={contract.id}
                href={`/portal/contracts/${contract.id}`}
                className="group flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <FileSignature className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="break-words font-semibold leading-snug">{contract.title}</p>
                    <p className="text-xs text-muted-foreground">
                      <bdi dir="ltr">{contract.code}</bdi>
                      {contract.startDate ? ` · ${formatDate(contract.startDate)}` : ""}
                      {contract.endDate ? ` تا ${formatDate(contract.endDate)}` : ""}
                    </p>
                  </div>
                  <ChevronLeft className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {contract.requestedByCustomer && !sections.length ? (
                    <Badge variant="outline" className="font-normal">
                      ثبت‌شده توسط شما
                    </Badge>
                  ) : null}
                  {contract.videoCount != null ? (
                    <Badge variant="secondary" className="font-normal tabular-nums">
                      {formatCount(contract.videoCount)} ویدیو
                    </Badge>
                  ) : null}
                  {contract.posterCount ? (
                    <Badge variant="secondary" className="font-normal tabular-nums">
                      {formatCount(contract.posterCount)} پوستر
                    </Badge>
                  ) : null}
                  {sections.map((key) => {
                    const { label, icon: Icon } = SECTION_META[key];
                    return (
                      <Badge key={key} variant="secondary" className="gap-1 font-normal">
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </Badge>
                    );
                  })}
                  {contract.lastSharedAt ? (
                    <span className="ms-auto text-xs text-muted-foreground">
                      آخرین ارسال: {formatDate(contract.lastSharedAt)}
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
