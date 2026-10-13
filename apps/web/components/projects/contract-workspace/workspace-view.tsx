"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarDays, FolderOpen, X } from "lucide-react";
import { apiGet } from "@/lib/api";
import {
  WORKSPACE_TABS,
  type ContractWorkspace,
  type WorkspaceTab,
} from "@/lib/contract-workspace";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AssetsPanel } from "./assets-panel";
import { CalendarPanel } from "./calendar-panel";
import { CompanyPanel, type CompanyDefaults } from "./company-panel";

const TAB_ICONS: Record<WorkspaceTab, typeof Building2> = {
  company: Building2,
  assets: FolderOpen,
  calendar: CalendarDays,
};

export function ContractWorkspaceTabs({
  active,
  onSelect,
}: {
  active: WorkspaceTab | null;
  onSelect: (tab: WorkspaceTab | null) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="بخش‌های قرارداد"
      className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border/70 bg-muted/40 p-1"
    >
      {WORKSPACE_TABS.map((tab) => {
        const Icon = TAB_ICONS[tab.id];
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(selected ? null : tab.id)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              selected
                ? "bg-card text-brand shadow-sm"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function ContractWorkspaceView({
  projectId,
  contractTitle,
  contractCode,
  customerName,
  tab,
  canEdit,
  customerWhatsapp,
  companyDefaults,
  onClose,
}: {
  projectId: string;
  contractTitle: string;
  contractCode: string;
  customerName: string;
  tab: WorkspaceTab;
  canEdit: boolean;
  customerWhatsapp: string | null;
  companyDefaults: CompanyDefaults;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["contract-workspace", projectId],
    queryFn: () => apiGet<ContractWorkspace>(`/projects/${projectId}/workspace`),
  });

  return (
    <section
      role="tabpanel"
      className="relative rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6"
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute end-3 top-3 h-8 w-8 text-muted-foreground"
        aria-label="بستن و بازگشت به نمای قرارداد"
        title="بستن"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </Button>
      <div className="pe-10">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : error || !data ? (
          <p className="py-8 text-center text-sm text-destructive">
            {error instanceof Error ? error.message : "بارگذاری اطلاعات ناموفق بود"}
          </p>
        ) : tab === "company" ? (
          <CompanyPanel
            projectId={projectId}
            workspace={data}
            defaults={companyDefaults}
            canEdit={canEdit}
          />
        ) : tab === "assets" ? (
          <AssetsPanel projectId={projectId} workspace={data} canEdit={canEdit} />
        ) : (
          <CalendarPanel
            projectId={projectId}
            contractTitle={contractTitle}
            contractCode={contractCode}
            customerName={customerName}
            workspace={data}
            canEdit={canEdit}
            customerWhatsapp={customerWhatsapp}
          />
        )}
      </div>
    </section>
  );
}
