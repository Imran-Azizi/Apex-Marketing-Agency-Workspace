"use client";

import { use, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import {
  getCustomTabListClass,
  getCustomTabTriggerClass,
} from "@/components/shared/tab-styles";
import { replaceTabSearchParams } from "@/lib/tab-url";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ProjectInfoTabContent,
  type ProjectInfoTabId,
} from "@/components/projects/project-customer-overview";
import {
  ProjectSectionShell,
  ProjectSectionSwitcher,
  type ProjectDataSectionId,
} from "@/components/projects/project-data-sections";
import type { PortalProjectAsset } from "@/components/portal/portal-project-assets";
import {
  getCustomerFacingStatusLabel,
  getProjectStatusLabel,
} from "@/lib/project-status";
import { ProjectProgressBar } from "@/components/projects/project-progress-bar";
import type { ProjectProgress } from "@/lib/project-progress";
import { getMe, type MeResponse } from "@/lib/auth";
import {
  ArrowRight,
  Banknote,
  Building2,
  Clapperboard,
  FolderOpen,
  Mic2,
  Sparkles,
  UserRound,
} from "lucide-react";

function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true">
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

const ProjectAiAssistant = dynamic(
  () =>
    import("@/components/projects/project-ai-assistant").then(
      (m) => m.ProjectAiAssistant,
    ),
  { ssr: false, loading: () => <PanelSkeleton /> },
);

const ProjectNarrationPanel = dynamic(
  () =>
    import("@/components/projects/project-narration-panel").then(
      (m) => m.ProjectNarrationPanel,
    ),
  { ssr: false, loading: () => <PanelSkeleton /> },
);

const ProjectProductionPanel = dynamic(
  () =>
    import("@/components/projects/project-production-panel").then(
      (m) => m.ProjectProductionPanel,
    ),
  { ssr: false, loading: () => <PanelSkeleton /> },
);

const ProjectFinancePanel = dynamic(
  () =>
    import("@/components/projects/project-finance-panel").then(
      (m) => m.ProjectFinancePanel,
    ),
  { ssr: false, loading: () => <PanelSkeleton className="h-40" /> },
);

interface ProjectDetail {
  id: string;
  code: string;
  title: string;
  status: string;
  customerFacingStatus: string;
  progress?: ProjectProgress | number | null;
  createdAt?: string;
  completedAt?: string | null;
  deadlineAt: string | null;
  language: string | null;
  tone: string | null;
  durationSec: number | null;
  platforms?: unknown;
  brief: Record<string, unknown> | null;
  contentRevisionUsed: number;
  contentRevisionMax: number;
  videoRevisionUsed: number;
  videoRevisionMax: number;
  service?: { id: string; name: string } | null;
  format?: { id: string; name: string; ratio: string } | null;
  crmCustomer: {
    id?: string;
    personName: string;
    companyName: string | null;
    jobTitle?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    normalizedWhatsapp?: string | null;
    whatsappRaw?: string | null;
    notes?: string | null;
  };
  assignments?: Array<{
    role: string;
    teamProfile?: { displayName: string } | null;
  }>;
  assetRefs?: Array<{
    clientAsset: (PortalProjectAsset & { deletedAt?: string | null }) | null;
  }>;
  finance?: {
    agreedPrice?: string;
    narratorCost?: string;
    editorCost?: string;
    otherDirectCosts?: string;
    received: string;
    balance?: number;
    profit?: number;
    finalProjectPrice?: string;
  } | null;
  downloadPermission?: {
    allowed: boolean;
    allowedAt?: string | null;
    overrideBalance?: boolean;
  } | null;
}

type DetailTab =
  | ProjectInfoTabId
  | "finance"
  | "ai"
  | "narration"
  | "production";

const CUSTOMER_TAB_IDS: DetailTab[] = [
  "customer",
  "brief",
  "assets",
  "finance",
];

const DETAIL_TABS: Array<{
  id: DetailTab;
  label: string;
  icon: typeof Building2;
  section: ProjectDataSectionId;
}> = [
  { id: "customer", label: "مشتری", icon: UserRound, section: "customer" },
  { id: "brief", label: "بریف", icon: Building2, section: "customer" },
  { id: "assets", label: "دارایی‌ها", icon: FolderOpen, section: "customer" },
  { id: "finance", label: "پرداخت‌ها", icon: Banknote, section: "customer" },
  { id: "ai", label: "تولید محتوا", icon: Sparkles, section: "apex" },
  { id: "narration", label: "نریشن صوتی", icon: Mic2, section: "apex" },
  {
    id: "production",
    label: "تولید و ادیت",
    icon: Clapperboard,
    section: "apex",
  },
];

/** Role-scoped tabs — editors only see production materials, not finance/AI/customer PII hub. */
function tabsForRole(role?: string | null): typeof DETAIL_TABS {
  if (role === "EDITOR") {
    return DETAIL_TABS.filter((t) =>
      ["brief", "assets", "production"].includes(t.id),
    );
  }
  if (role === "NARRATOR") {
    return DETAIL_TABS.filter((t) => ["brief", "narration"].includes(t.id));
  }
  if (role === "SALES") {
    return DETAIL_TABS.filter((t) => t.id !== "finance" && t.id !== "ai");
  }
  if (role === "FINANCE") {
    return DETAIL_TABS.filter((t) => t.id !== "ai" && t.id !== "production");
  }
  return DETAIL_TABS;
}

function sectionForTab(tab: DetailTab): ProjectDataSectionId {
  return CUSTOMER_TAB_IDS.includes(tab) ? "customer" : "apex";
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm sm:p-4">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold sm:text-base">
        {value}
      </p>
      {hint && (
        <p className="mt-1 break-words text-[11px] text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function SubTabBar({
  tabs,
  value,
  onChange,
}: {
  tabs: typeof DETAIL_TABS;
  value: DetailTab;
  onChange: (tab: DetailTab) => void;
}) {
  if (tabs.length === 0) return null;

  return (
    <>
      <div className="md:hidden">
        <Select value={value} onValueChange={(v) => onChange(v as DetailTab)}>
          <SelectTrigger className="h-11 w-full" aria-label="انتخاب زیربخش">
            <SelectValue>
              {tabs.find((t) => t.id === value)?.label || "انتخاب بخش"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {tabs.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        role="tablist"
        aria-label="زیربخش‌های جزئیات"
        className={cn(
          getCustomTabListClass("line"),
          "hidden w-full overflow-x-auto overscroll-x-contain [scrollbar-width:thin] md:flex",
        )}
      >
        <div className="flex w-max min-w-full gap-0">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = value === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChange(t.id)}
                className={getCustomTabTriggerClass(
                  active,
                  "line",
                  "text-xs sm:text-sm",
                )}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-colors",
                    active ? "text-brand" : "opacity-70",
                  )}
                  aria-hidden
                />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [section, setSection] = useState<ProjectDataSectionId>("customer");
  const [tab, setTab] = useState<DetailTab>("brief");
  const [aiPanel, setAiPanel] = useState<"content" | "feedback">("content");
  const [productionWorkspace, setProductionWorkspace] = useState<
    "customer" | "ai" | "final" | undefined
  >(undefined);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const workspaceParam = searchParams.get("workspace");

    // Legacy links: ?tab=final or /final → production workspace final tab
    if (tabParam === "final") {
      router.replace(`/projects/${id}?tab=production&workspace=final`);
      return;
    }

    if (
      tabParam === "ai" ||
      tabParam === "narration" ||
      tabParam === "production" ||
      tabParam === "customer" ||
      tabParam === "brief" ||
      tabParam === "assets" ||
      tabParam === "finance"
    ) {
      const next = tabParam as DetailTab;
      setTab(next);
      setSection(sectionForTab(next));
    }
    const sectionParam = searchParams.get("section");
    if (sectionParam === "customer" || sectionParam === "apex") {
      setSection(sectionParam);
    }
    const panelParam = searchParams.get("panel");
    if (panelParam === "feedback" || panelParam === "content") {
      setAiPanel(panelParam);
    }
    if (
      workspaceParam === "customer" ||
      workspaceParam === "ai" ||
      workspaceParam === "final"
    ) {
      setProductionWorkspace(workspaceParam);
    }
  }, [searchParams, id, router]);

  const { data: me } = useQuery({
    queryKey: ["me", "internal"],
    queryFn: getMe,
  });

  const role = (me as MeResponse | null)?.role;
  const blockProjectDetail = role === "NARRATOR" || role === "EDITOR";

  const { data, isLoading, error } = useQuery({
    queryKey: ["project", id],
    queryFn: () => apiGet<ProjectDetail>(`/projects/${id}`),
    enabled: !blockProjectDetail,
  });

  useEffect(() => {
    if (role === "NARRATOR") {
      router.replace(`/narrator/tasks/${id}`);
    }
    if (role === "EDITOR") {
      router.replace(`/editor/tasks/${id}`);
    }
  }, [role, id, router]);

  const visibleTabs = useMemo(
    () => tabsForRole((me as MeResponse | null)?.role),
    [me],
  );

  const customerTabs = useMemo(
    () => visibleTabs.filter((t) => t.section === "customer"),
    [visibleTabs],
  );
  const apexTabs = useMemo(
    () => visibleTabs.filter((t) => t.section === "apex"),
    [visibleTabs],
  );

  const sectionTabs = section === "customer" ? customerTabs : apexTabs;

  useEffect(() => {
    if (visibleTabs.length === 0) return;

    const tabVisible = visibleTabs.some((t) => t.id === tab);
    if (!tabVisible) {
      const fallback =
        (section === "customer" ? customerTabs[0] : apexTabs[0]) ||
        visibleTabs[0];
      if (fallback) {
        setTab(fallback.id);
        setSection(fallback.section);
      }
      return;
    }

    if (!sectionTabs.some((t) => t.id === tab) && sectionTabs[0]) {
      setTab(sectionTabs[0].id);
    }
  }, [visibleTabs, tab, section, customerTabs, apexTabs, sectionTabs]);

  const clientAssets = useMemo(() => {
    if (!data?.assetRefs) return [] as PortalProjectAsset[];
    return data.assetRefs
      .map((ref) => ref.clientAsset)
      .filter(
        (asset): asset is PortalProjectAsset & { deletedAt?: string | null } =>
          Boolean(asset && !asset.deletedAt),
      )
      .map(({ deletedAt: _d, ...asset }) => asset);
  }, [data?.assetRefs]);

  function handleTabChange(next: DetailTab) {
    setTab(next);
    setSection(sectionForTab(next));
    replaceTabSearchParams({
      tab: next,
      section: sectionForTab(next),
    });
  }

  function handleSectionChange(next: ProjectDataSectionId) {
    setSection(next);
    const first = (next === "customer" ? customerTabs : apexTabs)[0];
    if (first) {
      setTab(first.id);
      replaceTabSearchParams({
        section: next,
        tab: first.id,
      });
    } else {
      replaceTabSearchParams({ section: next });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        title="پروژه یافت نشد"
        action={
          <Button variant="outline" asChild>
            <Link href="/projects">
              <ArrowRight className="h-4 w-4" />
              بازگشت
            </Link>
          </Button>
        }
      />
    );
  }

  const progress = data.progress;

  const showCustomerSection = customerTabs.length > 0;
  const showApexSection = apexTabs.length > 0;

  return (
    <div
      dir="rtl"
      className="min-w-0 max-w-full space-y-5 text-start sm:space-y-6"
    >
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand/10 via-transparent to-transparent"
          aria-hidden
        />
        <div className="relative space-y-5 p-4 sm:p-6 lg:p-7">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                asChild
              >
                <Link href="/projects">
                  <ArrowRight className="h-3.5 w-3.5" />
                  پروژه‌ها
                </Link>
              </Button>
              <Badge variant="outline" className="font-mono" dir="ltr">
                {data.code}
              </Badge>
            </div>
            <div className="space-y-1.5">
              <h1 className="break-words text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
                {data.title}
              </h1>
              <p className="break-words text-sm text-muted-foreground">
                {data.crmCustomer.companyName
                  ? `${data.crmCustomer.personName} · ${data.crmCustomer.companyName}`
                  : data.crmCustomer.personName}
                {data.crmCustomer.id && (
                  <>
                    {" · "}
                    <Link
                      href={`/crm/${data.crmCustomer.id}`}
                      className="text-brand underline-offset-2 hover:underline"
                    >
                      پرونده مشتری
                    </Link>
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="brand">
                {getProjectStatusLabel(data.status)}
              </Badge>
              <Badge variant="secondary">
                {getCustomerFacingStatusLabel(data.customerFacingStatus)}
              </Badge>
              {data.deadlineAt && (
                <Badge variant="outline">
                  مهلت: {formatDate(data.deadlineAt)}
                </Badge>
              )}
              {data.downloadPermission?.allowed && (
                <Badge variant="success">دانلود فعال</Badge>
              )}
            </div>
          </div>

          <ProjectProgressBar
            progress={progress}
            status={data.status}
            variant="full"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="مشتری"
          value={data.crmCustomer.personName}
          hint={data.crmCustomer.companyName || undefined}
        />
        <Metric label="خدمت" value={data.service?.name || "ارائه نشده"} />
        <Metric
          label="اصلاحات محتوا"
          value={`${data.contentRevisionUsed.toLocaleString("fa-AF", { numberingSystem: "latn" })} / ${data.contentRevisionMax.toLocaleString("fa-AF", { numberingSystem: "latn" })}`}
          hint={`ویدیو: ${data.videoRevisionUsed.toLocaleString("fa-AF", { numberingSystem: "latn" })} / ${data.videoRevisionMax.toLocaleString("fa-AF", { numberingSystem: "latn" })}`}
        />
        <Metric
          label="قیمت توافقی"
          value={
            data.finance?.agreedPrice != null && data.finance.agreedPrice !== ""
              ? formatCurrency(Number(data.finance.agreedPrice))
              : data.finance?.finalProjectPrice != null &&
                  data.finance.finalProjectPrice !== ""
                ? formatCurrency(Number(data.finance.finalProjectPrice))
                : "ارائه نشده"
          }
          hint={
            data.finance?.balance != null
              ? `مانده: ${formatCurrency(data.finance.balance)}`
              : undefined
          }
        />
      </div>

      <section className="space-y-4">
        <ProjectSectionSwitcher
          value={section}
          onChange={handleSectionChange}
          showCustomer={showCustomerSection}
          showApex={showApexSection}
          customerDescription="نیازمندی‌ها، اطلاعات تماس، فایل‌ها و وضعیت پرداخت مرتبط با مشتری"
          apexDescription="برنامه‌ریزی، تولید محتوا و آماده‌سازی خروجی توسط تیم APEX"
        />

        {section === "customer" && showCustomerSection && (
          <ProjectSectionShell
            tone="customer"
            title="اطلاعات ارائه‌شده توسط مشتری"
            badge="منبع: مشتری"
          >
            <SubTabBar
              tabs={customerTabs}
              value={tab}
              onChange={handleTabChange}
            />
            <div
              key={tab}
              role="tabpanel"
              className="min-w-0 animate-fade-slide"
            >
              {(tab === "customer" || tab === "brief" || tab === "assets") && (
                <ProjectInfoTabContent
                  tab={tab}
                  project={{
                    ...data,
                    assets: tab === "assets" ? clientAssets : undefined,
                  }}
                />
              )}

              {tab === "finance" && (
                <ProjectFinancePanel finance={data.finance} />
              )}
            </div>
          </ProjectSectionShell>
        )}

        {section === "apex" && showApexSection && (
          <ProjectSectionShell
            tone="apex"
            title="اطلاعات و آماده‌سازی تیم APEX"
            badge="تهیه‌شده توسط APEX"
          >
            <SubTabBar tabs={apexTabs} value={tab} onChange={handleTabChange} />
            <div
              key={tab}
              role="tabpanel"
              className="min-w-0 animate-fade-slide"
            >
              {tab === "ai" && (
                <ProjectAiAssistant projectId={id} initialPanel={aiPanel} />
              )}

              {tab === "narration" && (
                <ProjectNarrationPanel
                  projectId={id}
                  roleCode={(me as MeResponse | null)?.role}
                />
              )}

              {tab === "production" && (
                <ProjectProductionPanel
                  projectId={id}
                  roleCode={(me as MeResponse | null)?.role}
                  initialWorkspaceTab={productionWorkspace}
                />
              )}
            </div>
          </ProjectSectionShell>
        )}
      </section>
    </div>
  );
}
