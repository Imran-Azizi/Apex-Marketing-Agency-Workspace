"use client";

import { use } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, CalendarDays, FolderOpen } from "lucide-react";
import { apiGet } from "@/lib/api";
import {
  WORKSPACE_TABS,
  parseWorkspaceTab,
  type PortalContractDetail,
  type WorkspaceTab,
} from "@/lib/contract-workspace";
import { formatCount } from "@/lib/contract-project";
import { cn, formatDate } from "@/lib/utils";
import { CompanyProfileView } from "@/components/contract-content/company-profile-view";
import { ContractAssetsGrid } from "@/components/contract-content/asset-card";
import { CalendarTable } from "@/components/contract-content/calendar-table";
import { CalendarPdfCard } from "@/components/contract-content/calendar-pdf-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const TAB_ICONS: Record<WorkspaceTab, typeof Building2> = {
  company: Building2,
  assets: FolderOpen,
  calendar: CalendarDays,
};

function availableTabs(data: PortalContractDetail): WorkspaceTab[] {
  return WORKSPACE_TABS.map((tab) => tab.id).filter((id) => {
    if (id === "company") return Boolean(data.company);
    if (id === "assets") return Boolean(data.shares.assets);
    return data.calendars.length > 0;
  });
}

function SharedAt({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  return <p className="text-xs text-muted-foreground">ارسال‌شده در {formatDate(value)}</p>;
}

export default function PortalContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-contract", id],
    queryFn: () => apiGet<PortalContractDetail>(`/portal/contracts/${id}`),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        title="قرارداد یافت نشد"
        description={error instanceof Error ? error.message : undefined}
        action={
          <Button variant="outline" asChild>
            <Link href="/portal/contracts">بازگشت به قراردادها</Link>
          </Button>
        }
      />
    );
  }

  const tabs = availableTabs(data);
  const requested = parseWorkspaceTab(searchParams.get("tab"));
  const active = requested && tabs.includes(requested) ? requested : tabs[0];

  const selectTab = (tab: WorkspaceTab) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", tab);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div dir="rtl" className="space-y-4 text-start sm:space-y-6">
      <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
            <Link href="/portal/contracts">
              <ArrowRight className="h-3.5 w-3.5" />
              قراردادها
            </Link>
          </Button>
          <Badge variant="outline" className="font-mono" dir="ltr">
            {data.code}
          </Badge>
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="break-words text-xl font-bold tracking-tight sm:text-2xl">{data.title}</h1>
            {data.startDate || data.endDate ? (
              <p className="text-sm text-muted-foreground">
                مدت قرارداد: {data.startDate ? formatDate(data.startDate) : "—"} تا{" "}
                {data.endDate ? formatDate(data.endDate) : "—"}
              </p>
            ) : null}
          </div>
          {tabs.length ? (
            <div
              role="tablist"
              aria-label="بخش‌های قرارداد"
              className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border/70 bg-muted/40 p-1"
            >
              {tabs.map((tabId) => {
                const Icon = TAB_ICONS[tabId];
                const selected = active === tabId;
                return (
                  <button
                    key={tabId}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => selectTab(tabId)}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                      selected
                        ? "bg-card text-brand shadow-sm"
                        : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {WORKSPACE_TABS.find((tab) => tab.id === tabId)?.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      <section
        role="tabpanel"
        className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6"
      >
        {active === "company" && data.company ? (
          <>
            <SharedAt value={data.shares.company?.sharedAt} />
            <CompanyProfileView company={data.company} />
          </>
        ) : active === "assets" ? (
          <>
            <SharedAt value={data.shares.assets?.sharedAt} />
            {data.assets.length ? (
              <ContractAssetsGrid assets={data.assets} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">دارایی‌ای موجود نیست.</p>
            )}
          </>
        ) : active === "calendar" ? (
          <div className="space-y-4">
            {data.calendars.map((calendar) => {
              const share = data.shares.calendars[calendar.id];
              return share?.pdf ? (
                <CalendarPdfCard
                  key={calendar.id}
                  title={calendar.title}
                  rowCount={calendar.rows.length}
                  sharedAt={share.sharedAt}
                  pdf={share.pdf}
                />
              ) : (
                <div key={calendar.id} className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold sm:text-base">{calendar.title}</h2>
                    <Badge variant="secondary" className="tabular-nums">
                      {formatCount(calendar.rows.length)} ردیف
                    </Badge>
                  </div>
                  <SharedAt value={share?.sharedAt} />
                  <CalendarTable rows={calendar.rows} />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">هنوز محتوایی ارسال نشده.</p>
        )}
      </section>
    </div>
  );
}
