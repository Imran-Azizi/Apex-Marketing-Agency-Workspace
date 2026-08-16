"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Building2,
  Clapperboard,
  FolderOpen,
  Mic2,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  NarrationFinalView,
  ScenarioFinalView,
  StoryboardFinalView,
} from "@/components/projects/ai-content-views";
import {
  ProjectInfoTabContent,
  type ProjectCustomerOverviewData,
  type ProjectInfoTabId,
} from "@/components/projects/project-customer-overview";
import { ProjectSectionShell } from "@/components/projects/project-data-sections";
import { type PortalProjectAsset } from "@/components/portal/portal-project-assets";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCustomTabListClass,
  getCustomTabTriggerClass,
} from "@/components/shared/tab-styles";
import { apiGet } from "@/lib/api";
import {
  downloadMediaFile,
  downloadStoredFile,
} from "@/lib/upload";
import { cn } from "@/lib/utils";
import {
  NarrationAudioVersions,
  type NarrationTakeRecord,
} from "@/components/narration/narration-audio-versions";
import { toast } from "sonner";

export type EditingMaterialsData = {
  brief?: unknown;
  approvedContent?: {
    id: string;
    versionNumber: number;
    scenario?: unknown;
    narration?: unknown;
    storyboard?: unknown;
    status?: string;
  } | null;
  clientAssets?: Array<{
    id: string;
    name: string;
    kind?: string;
    storageKey?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    createdAt?: string | null;
    meta?: Record<string, unknown> | null;
  }>;
  voiceFiles?: Array<{
    id: string;
    name: string;
    storageKey?: string;
    mimeType?: string | null;
    sizeBytes?: number | null;
    createdAt?: string;
    version?: number;
  }>;
  narrationAudio?: {
    approvedAt?: string | null;
    approvedFileId?: string | null;
    takes?: Array<{
      id: string;
      version: number;
      createdAt: string;
      isCurrent?: boolean;
      audioFile?: {
        id: string;
        name: string;
        storageKey: string;
        mimeType?: string | null;
        sizeBytes?: number | null;
        version?: number | null;
        createdAt: string;
      } | null;
    }>;
  } | null;
  customerFeedback?: Array<{
    id: string;
    scope: string;
    body: string;
    createdAt: string;
  }>;
};

export type ProductionWorkspaceTab = "customer" | "ai" | "narration" | "final";

export const PRODUCTION_WORKSPACE_TABS: Array<{
  id: ProductionWorkspaceTab;
  label: string;
  shortLabel: string;
}> = [
  { id: "customer", label: "اطلاعات مشتری", shortLabel: "مشتری" },
  { id: "ai", label: "تولید شده هوش مصنوعی", shortLabel: "AI" },
  { id: "narration", label: "فایل صوتی نریشن", shortLabel: "نریشن" },
  { id: "final", label: "محصول نهایی", shortLabel: "نهایی" },
];

const CUSTOMER_INFO_TABS: Array<{
  id: ProjectInfoTabId;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "customer", label: "مشتری", icon: UserRound },
  { id: "brief", label: "بریف", icon: Building2 },
  { id: "assets", label: "دارایی‌ها", icon: FolderOpen },
];

type ProjectSummary = {
  id?: string;
  title: string;
  code?: string;
  status: string;
  videoRevisionUsed: number;
  videoRevisionMax: number;
  extraVideoRevision: boolean;
  language?: string | null;
  tone?: string | null;
  durationSec?: number | null;
  platforms?: unknown;
  brief?: unknown;
  format?: { id: string; name: string; ratio: string } | null;
  service?: { id: string; name: string } | null;
  crmCustomer?: ProjectCustomerOverviewData["crmCustomer"] | null;
  assignments?: Array<{
    role: string;
    teamProfile?: { displayName: string } | null;
  }>;
};

type TaskSummary = {
  status: string;
  deadline?: string | null;
  revisionNotes?: string | null;
  instructions?: string | null;
  version?: number;
};

type MaterialsCtx = {
  materials: EditingMaterialsData;
  project: ProjectSummary;
  task?: TaskSummary | null;
  roleCode?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractScenes(storyboard: unknown) {
  const obj = asRecord(storyboard);
  const scenes = Array.isArray(obj?.storyboard)
    ? obj.storyboard
    : Array.isArray(obj?.scenes)
      ? obj.scenes
      : Array.isArray(storyboard)
        ? storyboard
        : [];
  const list = scenes as Array<Record<string, unknown>>;
  return [...list].sort((a, b) => {
    const aNo = Number(a.sceneNumber ?? a.scene_number ?? a.shot ?? 0);
    const bNo = Number(b.sceneNumber ?? b.scene_number ?? b.shot ?? 0);
    return aNo - bNo;
  });
}

function storyboardSceneCount(storyboard: unknown): number {
  return extractScenes(storyboard).length;
}

function useMaterialsDerived({ materials }: MaterialsCtx) {
  const assets = useMemo(
    () =>
      (materials.clientAssets || []).filter(Boolean).map(
        (a): PortalProjectAsset => ({
          id: a.id,
          name: a.name,
          kind: a.kind || "OTHER",
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          storageKey: a.storageKey || undefined,
          meta: a.meta || null,
          createdAt: a.createdAt ?? null,
        }),
      ),
    [materials.clientAssets],
  );

  const voiceFiles = materials.voiceFiles || [];
  const narrationTakes = materials.narrationAudio?.takes || [];
  const scenes = storyboardSceneCount(materials.approvedContent?.storyboard);

  return {
    assets,
    voiceFiles,
    narrationTakes,
    scenes,
    hasNarration: !!materials.approvedContent?.narration,
    hasNarrationAudio: narrationTakes.length > 0 || voiceFiles.length > 0,
    hasScenario: !!materials.approvedContent?.scenario,
  };
}

export function getProductionTabBadges(
  ctx: MaterialsCtx,
  extras?: { finalCount?: number },
): Partial<Record<ProductionWorkspaceTab, number>> {
  const assets = ctx.materials.clientAssets?.length || 0;
  const narrationAudioCount =
    ctx.materials.narrationAudio?.takes?.length ||
    ctx.materials.voiceFiles?.length ||
    0;
  const scenes = storyboardSceneCount(
    ctx.materials.approvedContent?.storyboard,
  );
  const aiCount =
    (ctx.materials.approvedContent?.scenario ? 1 : 0) +
    (ctx.materials.approvedContent?.narration ? 1 : 0) +
    (scenes > 0 ? 1 : 0);
  const finalCount = extras?.finalCount || 0;
  return {
    customer: assets || undefined,
    ai: aiCount || undefined,
    narration: narrationAudioCount || undefined,
    final: finalCount || undefined,
  };
}

function EmptyMaterial({
  icon: Icon,
  message,
  action,
}: {
  icon: LucideIcon;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-14 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground/70">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="max-w-sm text-sm leading-6 text-muted-foreground">
        {message}
      </p>
      {action}
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  badge,
  tone = "neutral",
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  tone?: "neutral" | "info" | "success" | "warning" | "ai";
  children: ReactNode;
}) {
  const iconTone = {
    neutral: "bg-muted text-muted-foreground",
    info: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
    success:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    warning:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
    ai: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  }[tone];

  return (
    <section
      dir="rtl"
      className="overflow-hidden rounded-2xl border border-border/70 bg-card text-start shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-3 border-b border-border/50 px-4 py-3.5 sm:px-5">
        <span
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            iconTone,
          )}
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight sm:text-[15px]">
              {title}
            </h3>
            {badge}
          </div>
          {subtitle ? (
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      <div className="px-4 py-4 text-start sm:px-5">{children}</div>
    </section>
  );
}

function buildNarrationTakeRecords(ctx: MaterialsCtx): NarrationTakeRecord[] {
  const { materials } = ctx;
  if (materials.narrationAudio?.takes?.length) {
    const approvedId = materials.narrationAudio.approvedFileId;
    const approved = materials.narrationAudio.takes.filter(
      (take) =>
        take.isCurrent ||
        (approvedId != null && take.audioFile?.id === approvedId),
    );
    const source = approved.length
      ? approved
      : materials.narrationAudio.takes.slice(-1);
    return source.map((take) => ({
      id: take.id,
      version: take.version,
      createdAt: take.createdAt,
      isCurrent: true,
      audioFile: take.audioFile ?? undefined,
    }));
  }

  const voiceFiles = materials.voiceFiles || [];
  if (!voiceFiles.length) return [];

  // Fallback: production API already scopes voiceFiles to the approved take.
  const file = voiceFiles[voiceFiles.length - 1];
  return [
    {
      id: file.id,
      version: file.version ?? 1,
      createdAt: file.createdAt || new Date().toISOString(),
      isCurrent: true,
      audioFile: {
        id: file.id,
        name: file.name,
        storageKey: file.storageKey || "",
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        version: file.version,
        createdAt: file.createdAt || new Date().toISOString(),
      },
    },
  ];
}

async function downloadNarrationAudioFile(file: {
  id: string;
  name: string;
  storageKey: string;
}) {
  if (file.storageKey) {
    await downloadStoredFile(file.storageKey, file.name);
  } else {
    await downloadMediaFile(file.id, file.name);
  }
}

export function NarrationAudioMaterialsSection({ ctx }: { ctx: MaterialsCtx }) {
  const takes = useMemo(() => buildNarrationTakeRecords(ctx), [ctx]);
  const currentFileId =
    ctx.materials.narrationAudio?.approvedFileId ??
    takes.find((take) => take.isCurrent)?.audioFile?.id ??
    takes[0]?.audioFile?.id;

  if (!takes.length) return null;

  return (
    <NarrationAudioVersions
      takes={takes}
      currentFileId={currentFileId}
      emptyMessage="هنوز فایل صوتی نریشن برای این پروژه موجود نیست."
      onDownload={async (file) => {
        try {
          await downloadNarrationAudioFile(file);
          toast.success("فایل صوتی با موفقیت دانلود شد");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "دانلود ناموفق بود");
          throw e;
        }
      }}
    />
  );
}

export function StoryboardTab(ctx: MaterialsCtx) {
  const storyboard = ctx.materials.approvedContent?.storyboard;
  const scenes = extractScenes(storyboard);

  if (!scenes.length) {
    return (
      <EmptyMaterial
        icon={Clapperboard}
        message="استوری‌بوردی برای این پروژه ثبت نشده است."
      />
    );
  }

  return (
    <div
      className="max-h-[min(48rem,78vh)] space-y-3 overflow-y-auto overscroll-contain pe-1"
      dir="rtl"
    >
      <StoryboardFinalView value={storyboard} dir="rtl" />
    </div>
  );
}

export function EditingMaterialsSkeleton() {
  return (
    <div
      className="space-y-4"
      dir="rtl"
      aria-busy="true"
      aria-label="در حال بارگذاری فضای تولید"
    >
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function briefString(
  brief: Record<string, unknown> | null,
  key: string,
): string {
  const v = brief?.[key];
  return typeof v === "string" ? v.trim() : "";
}

function briefNumber(
  brief: Record<string, unknown> | null,
  key: string,
): number | null {
  const v = brief?.[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

type ProductionProjectDetail = {
  id: string;
  code: string;
  title: string;
  status: string;
  customerFacingStatus: string;
  createdAt?: string;
  completedAt?: string | null;
  deadlineAt: string | null;
  language: string | null;
  tone: string | null;
  durationSec: number | null;
  platforms?: unknown;
  brief: Record<string, unknown> | null;
  service?: { id: string; name: string } | null;
  format?: { id: string; name: string; ratio: string } | null;
  crmCustomer: ProjectCustomerOverviewData["crmCustomer"] & { id?: string };
  assignments?: ProjectCustomerOverviewData["assignments"];
  assetRefs?: Array<{
    clientAsset: (PortalProjectAsset & { deletedAt?: string | null }) | null;
  }>;
};

function assetsFromRefs(
  refs?: ProductionProjectDetail["assetRefs"],
): PortalProjectAsset[] {
  return (refs || [])
    .map((r) => r.clientAsset)
    .filter(
      (asset): asset is PortalProjectAsset & { deletedAt?: string | null } =>
        Boolean(asset && !asset.deletedAt),
    )
    .map(({ deletedAt: _d, ...asset }) => asset);
}

function buildCustomerOverview(ctx: MaterialsCtx): ProjectCustomerOverviewData {
  const brief = asRecord(ctx.materials.brief) || asRecord(ctx.project.brief);
  const assets = (ctx.materials.clientAssets || []).filter(Boolean).map(
    (a): PortalProjectAsset => ({
      id: a.id,
      name: a.name,
      kind: a.kind || "OTHER",
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      storageKey: a.storageKey || undefined,
      meta: a.meta || null,
      createdAt: a.createdAt ?? null,
    }),
  );

  const crm = ctx.project.crmCustomer || null;

  return {
    id: ctx.project.id || "",
    code: ctx.project.code || "",
    title: ctx.project.title,
    status: ctx.project.status,
    customerFacingStatus: "",
    deadlineAt: null,
    language: ctx.project.language || briefString(brief, "language") || null,
    tone: ctx.project.tone || briefString(brief, "tone") || null,
    durationSec:
      ctx.project.durationSec ?? briefNumber(brief, "durationSec"),
    platforms: ctx.project.platforms || brief?.platforms,
    brief: (ctx.project.brief as Record<string, unknown> | null) ?? brief,
    format: ctx.project.format,
    service: ctx.project.service || null,
    assignments: ctx.project.assignments,
    crmCustomer: {
      id: crm?.id,
      personName: crm?.personName || briefString(brief, "personName"),
      companyName:
        crm?.companyName || briefString(brief, "companyName") || null,
      jobTitle: crm?.jobTitle || briefString(brief, "jobTitle") || null,
      phone: crm?.phone || briefString(brief, "phone") || null,
      email: crm?.email || briefString(brief, "email") || null,
      address: crm?.address || briefString(brief, "address") || null,
      city: crm?.city || briefString(brief, "city") || null,
      normalizedWhatsapp: crm?.normalizedWhatsapp || null,
      whatsappRaw: crm?.whatsappRaw || null,
      notes: crm?.notes || briefString(brief, "notes") || null,
    },
    assets,
  };
}

function CustomerInfoSubTabBar({
  value,
  onChange,
}: {
  value: ProjectInfoTabId;
  onChange: (tab: ProjectInfoTabId) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="sm:hidden">
        <Select
          value={value}
          onValueChange={(v) => onChange(v as ProjectInfoTabId)}
        >
          <SelectTrigger
            className="h-11 w-full"
            aria-label="انتخاب زیربخش مشتری"
          >
            <SelectValue>
              {CUSTOMER_INFO_TABS.find((t) => t.id === value)?.label ||
                "انتخاب بخش"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CUSTOMER_INFO_TABS.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        role="tablist"
        aria-label="زیربخش‌های اطلاعات مشتری"
        className={cn(
          getCustomTabListClass("line"),
          "hidden w-full overflow-x-auto overscroll-x-contain [scrollbar-width:thin] sm:flex",
        )}
      >
        <div className="flex w-max min-w-full gap-0">
          {CUSTOMER_INFO_TABS.map((t) => {
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
                  "min-w-[7rem] flex-1 text-xs sm:text-sm",
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
    </div>
  );
}

export function CustomerInfoTab(ctx: MaterialsCtx) {
  const [infoTab, setInfoTab] = useState<ProjectInfoTabId>("customer");
  const projectId = ctx.project.id;
  const canFetchProjectDetail =
    Boolean(projectId) && ctx.roleCode !== "EDITOR";

  const projectQ = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiGet<ProductionProjectDetail>(`/projects/${projectId}`),
    enabled: canFetchProjectDetail,
    retry: false,
    staleTime: 60_000,
  });

  const materialsOverview = useMemo(
    () => buildCustomerOverview(ctx),
    [ctx.materials, ctx.project],
  );

  const overview = useMemo((): ProjectCustomerOverviewData => {
    const detail = projectQ.data;
    if (!detail) return materialsOverview;

    const detailAssets = assetsFromRefs(detail.assetRefs);
    return {
      id: detail.id,
      code: detail.code,
      title: detail.title,
      status: detail.status,
      customerFacingStatus: detail.customerFacingStatus,
      createdAt: detail.createdAt,
      completedAt: detail.completedAt,
      deadlineAt: detail.deadlineAt,
      language: detail.language,
      tone: detail.tone,
      durationSec: detail.durationSec,
      platforms: detail.platforms,
      brief: detail.brief,
      service: detail.service,
      format: detail.format,
      crmCustomer: detail.crmCustomer,
      assignments: detail.assignments,
      assets: detailAssets.length > 0 ? detailAssets : materialsOverview.assets,
    };
  }, [projectQ.data, materialsOverview]);

  const showLoading = canFetchProjectDetail && projectQ.isLoading && !projectQ.data;

  return (
    <div className="space-y-4 text-start" dir="rtl">
      <ProjectSectionShell
        tone="customer"
        title="اطلاعات ارائه‌شده توسط مشتری"
        badge="منبع: مشتری"
      >
        <CustomerInfoSubTabBar value={infoTab} onChange={setInfoTab} />

        <div
          key={infoTab}
          role="tabpanel"
          className="min-w-0 animate-fade-slide"
        >
          {showLoading ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
          ) : (
            <>
              {infoTab === "brief" && ctx.task?.instructions ? (
                <div className="mb-4">
                  <SectionCard
                    icon={BookOpen}
                    title="دستورالعمل مدیر"
                    subtitle="راهنمای اختصاصی این ارجاع"
                    tone="info"
                  >
                    <div className="rounded-2xl border border-sky-200/70 border-s-4 border-s-sky-500 bg-sky-50/70 p-4 dark:border-sky-900/50 dark:bg-sky-950/25">
                      <p className="max-w-[42rem] whitespace-pre-wrap text-[15px] leading-8">
                        {ctx.task.instructions}
                      </p>
                    </div>
                  </SectionCard>
                </div>
              ) : null}

              <ProjectInfoTabContent
                tab={infoTab}
                project={{
                  ...overview,
                  assets: infoTab === "assets" ? overview.assets : undefined,
                }}
              />
            </>
          )}
        </div>
      </ProjectSectionShell>
    </div>
  );
}

export function AIGeneratedContentTab(ctx: MaterialsCtx) {
  const content = ctx.materials.approvedContent;
  const d = useMaterialsDerived(ctx);
  const [section, setSection] = useState<
    "scenario" | "narration" | "storyboard"
  >(d.hasScenario ? "scenario" : d.hasNarration ? "narration" : "storyboard");

  const sections: Array<{
    id: "scenario" | "narration" | "storyboard";
    label: string;
    available: boolean;
  }> = [
    { id: "scenario", label: "سناریو", available: d.hasScenario },
    { id: "narration", label: "نریشن", available: d.hasNarration },
    {
      id: "storyboard",
      label: "استوری‌بورد",
      available: d.scenes > 0,
    },
  ];

  if (!content || (!d.hasScenario && !d.hasNarration && d.scenes === 0)) {
    return (
      <EmptyMaterial
        icon={Sparkles}
        message="هنوز محتوای تولیدشده توسط هوش مصنوعی برای این پروژه موجود نیست."
      />
    );
  }

  return (
    <div className="space-y-4 text-start" dir="rtl">
      <div
        role="tablist"
        aria-label="بخش‌های محتوای AI"
        dir="rtl"
        className={cn(
          getCustomTabListClass("line"),
          "w-full overflow-x-auto overscroll-x-contain [scrollbar-width:thin]",
        )}
      >
        <div className="flex w-max min-w-full gap-0">
          {sections.map((s) => {
            const active = section === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={!s.available}
                onClick={() => setSection(s.id)}
                className={getCustomTabTriggerClass(
                  active,
                  "line",
                  "min-w-[6.5rem] flex-1 text-xs sm:text-sm",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        key={section}
        role="tabpanel"
        dir="rtl"
        className="min-w-0 animate-fade-slide text-start"
      >
        {section === "scenario" ? (
          <ScenarioFinalView value={content.scenario} dir="rtl" />
        ) : null}
        {section === "narration" ? (
          <NarrationFinalView value={content.narration} dir="rtl" />
        ) : null}
        {section === "storyboard" ? <StoryboardTab {...ctx} /> : null}
      </div>
    </div>
  );
}

export function NarrationAudioTab(ctx: MaterialsCtx) {
  const takes = useMemo(() => buildNarrationTakeRecords(ctx), [ctx]);

  if (!takes.length) {
    return (
      <EmptyMaterial
        icon={Mic2}
        message="هنوز فایل صوتی نریشن تأییدشده‌ای برای این پروژه موجود نیست. پس از تأیید نریشن توسط مدیر، فایل‌ها اینجا نمایش داده می‌شوند."
      />
    );
  }

  return (
    <div className="space-y-4 text-start" dir="rtl">
      <ProjectSectionShell
        tone="apex"
        title="فایل صوتی نریشن"
        badge="تأییدشده توسط مدیر"
      >
        <div className="p-4 sm:p-5">
          <NarrationAudioMaterialsSection ctx={ctx} />
        </div>
      </ProjectSectionShell>
    </div>
  );
}
