"use client";

import { use, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, CalendarDays, FolderOpen, Pencil } from "lucide-react";
import { apiGet } from "@/lib/api";
import {
  WORKSPACE_TABS,
  parseWorkspaceTab,
  type ContentCalendar,
  type PortalContractDetail,
  type ShareInfo,
  type WorkspaceTab,
} from "@/lib/contract-workspace";
import { formatCount } from "@/lib/contract-project";
import { cn, formatDate } from "@/lib/utils";
import { CompanyProfileView } from "@/components/contract-content/company-profile-view";
import { ContractAssetsGrid } from "@/components/contract-content/asset-card";
import { CalendarTable } from "@/components/contract-content/calendar-table";
import { CalendarPdfCard } from "@/components/contract-content/calendar-pdf-card";
import { PortalCalendarEditorDialog } from "@/components/contract-content/portal-calendar-editor";
import { PortalContractOverview } from "@/components/contract-content/portal-contract-overview";
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

function PortalCalendarBlock({
  contractId,
  calendar,
  share,
  onEdit,
}: {
  contractId: string;
  calendar: ContentCalendar;
  share?: ShareInfo | null;
  onEdit: () => void;
}) {
  const changedAfterShare =
    Boolean(share?.sharedAt) &&
    new Date(calendar.updatedAt).getTime() > new Date(share!.sharedAt).getTime() + 1000;

  if (share?.pdf) {
    return (
      <div className="space-y-3">
        <CalendarPdfCard
          contractId={contractId}
          calendarId={calendar.id}
          title={calendar.title}
          rowCount={calendar.rows.length}
          sharedAt={share.sharedAt}
          pdf={share.pdf}
          onEdit={onEdit}
        />
        {changedAfterShare ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            این تقویم پس از ارسال PDF ویرایش شده است. نسخهٔ جدول زیر به‌روز است؛ PDF تا ارسال مجدد تیم اپکس
            همان نسخهٔ قبلی می‌ماند.
          </p>
        ) : null}
        <CalendarTable rows={calendar.rows} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold sm:text-base">{calendar.title}</h2>
            <Badge variant="secondary" className="tabular-nums">
              {formatCount(calendar.rows.length)} ردیف
            </Badge>
          </div>
          <SharedAt value={share?.sharedAt} />
        </div>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          ویرایش
        </Button>
      </div>
      <CalendarTable rows={calendar.rows} />
    </div>
  );
}

export default function PortalContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [editingCalendar, setEditingCalendar] = useState<ContentCalendar | null>(null);

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
        <h1 className="break-words text-xl font-bold tracking-tight sm:text-2xl">{data.title}</h1>
      </section>

      <PortalContractOverview contract={data} />

      <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-base font-bold">محتوای ارسال‌شده</h2>
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
        <div role="tabpanel" className="space-y-4">
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
            {data.calendars.map((calendar) => (
              <PortalCalendarBlock
                key={calendar.id}
                contractId={data.id}
                calendar={calendar}
                share={data.shares.calendars[calendar.id]}
                onEdit={() => setEditingCalendar(calendar)}
              />
            ))}
            <PortalCalendarEditorDialog
              contractId={data.id}
              calendar={editingCalendar}
              open={Boolean(editingCalendar)}
              onOpenChange={(open) => {
                if (!open) setEditingCalendar(null);
              }}
              hasSharedPdf={Boolean(
                editingCalendar && data.shares.calendars[editingCalendar.id]?.pdf,
              )}
            />
          </div>
        ) : data.requestedByCustomer ? (
          <div className="space-y-1 py-8 text-center">
            <p className="text-sm font-medium">قرارداد شما ثبت شد.</p>
            <p className="text-xs text-muted-foreground">
              اطلاعات شرکت، دارایی‌ها و تقویم محتوایی پس از ارسال توسط تیم اپکس اینجا نمایش داده می‌شود.
            </p>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">هنوز محتوایی ارسال نشده.</p>
        )}
        </div>
      </section>
    </div>
  );
}
