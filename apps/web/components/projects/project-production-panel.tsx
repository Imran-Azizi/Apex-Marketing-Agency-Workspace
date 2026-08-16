"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { useMeQuery } from "@/lib/permissions";
import {
  CurrencyField,
  validateCurrencyInput,
} from "@/components/shared/currency-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AIGeneratedContentTab,
  CustomerInfoTab,
  EditingMaterialsSkeleton,
  getProductionTabBadges,
  NarrationAudioTab,
  PRODUCTION_WORKSPACE_TABS,
  type ProductionWorkspaceTab,
} from "@/components/projects/editing-materials-panel";
import { ProjectFinalProductPanel } from "@/components/projects/project-final-product-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FinalProductsPayload } from "@/lib/final-product";
import {
  Film,
  Loader2,
  Mic2,
  PackageCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

type EditingStatus =
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "REVIEW_REQUIRED"
  | "REVISION_REQUESTED"
  | "COMPLETED";

type ProductionFile = {
  id: string;
  name: string;
  storageKey?: string;
  version: number;
  uploadedBy?: string | null;
  uploadedByName?: string | null;
  createdAt: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

type ProductionPayload = {
  task: {
    id: string;
    status: EditingStatus;
    deadline?: string | null;
    assignedAmount?: string | number | null;
    instructions?: string | null;
    revisionNotes?: string | null;
    version: number;
    submittedAt?: string | null;
    completedAt?: string | null;
    editorUser?: { id: string; fullName: string; email: string } | null;
    editorTeamProfile?: { id: string; displayName: string } | null;
    assignedBy?: { id: string; fullName: string } | null;
  } | null;
  materials: {
    brief?: unknown;
    approvedContent?: {
      id: string;
      versionNumber: number;
      scenario?: unknown;
      narration?: unknown;
      storyboard?: unknown;
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
    voiceFiles?: ProductionFile[];
    customerFeedback?: Array<{
      id: string;
      scope: string;
      body: string;
      createdAt: string;
    }>;
  };
  productionFiles?: {
    watermarked?: ProductionFile[];
    clean?: ProductionFile[];
  };
  project: {
    id: string;
    code: string;
    title: string;
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
    crmCustomer?: {
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
    } | null;
    assignments?: Array<{
      role: string;
      teamProfile?: { displayName: string } | null;
    }>;
  };
};

type EditorProfile = {
  id: string;
  displayName: string;
  user: { id: string; fullName: string; email: string };
  rates?: Array<{ amount: string | number; isActive?: boolean }>;
};

export function ProjectProductionPanel({
  projectId,
  roleCode,
  initialWorkspaceTab,
}: {
  projectId: string;
  roleCode?: string | null;
  initialWorkspaceTab?: ProductionWorkspaceTab;
}) {
  const qc = useQueryClient();
  const { data: me } = useMeQuery();
  const isManager = hasPermission(
    me?.permissions,
    ["projects.assign", "video.approve", "video.send"],
    roleCode,
  );
  const isEditor = roleCode === "EDITOR";

  const [assignOpen, setAssignOpen] = useState(false);
  const [editorId, setEditorId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [editingCost, setEditingCost] = useState("");
  const [editingCostError, setEditingCostError] = useState<string>();
  const [instructions, setInstructions] = useState("");
  const [workspaceTab, setWorkspaceTab] = useState<ProductionWorkspaceTab>(
    initialWorkspaceTab &&
      PRODUCTION_WORKSPACE_TABS.some((t) => t.id === initialWorkspaceTab)
      ? initialWorkspaceTab
      : "customer",
  );

  useEffect(() => {
    if (
      initialWorkspaceTab &&
      PRODUCTION_WORKSPACE_TABS.some((t) => t.id === initialWorkspaceTab)
    ) {
      setWorkspaceTab(initialWorkspaceTab);
    }
  }, [initialWorkspaceTab]);

  const dataQ = useQuery({
    queryKey: ["production-task", projectId],
    queryFn: () =>
      apiGet<ProductionPayload>(`/production/projects/${projectId}`),
  });

  const finalsQ = useQuery({
    queryKey: ["final-products", projectId],
    queryFn: () =>
      apiGet<FinalProductsPayload>(
        `/production/projects/${projectId}/final-products`,
      ),
    staleTime: 15_000,
  });

  const editorsQ = useQuery({
    queryKey: ["production-editors"],
    queryFn: () => apiGet<EditorProfile[]>("/production/editors"),
    enabled: isManager && assignOpen,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["production-task", projectId] });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["final-products", projectId] });
    qc.invalidateQueries({ queryKey: ["production-my-tasks"] });
    qc.invalidateQueries({ queryKey: ["editor-dashboard"] });
    qc.invalidateQueries({ queryKey: ["editor-projects"] });
    qc.invalidateQueries({ queryKey: ["editor-my-tasks-home"] });
    qc.invalidateQueries({ queryKey: ["projects-home"] });
  };

  const assignMut = useMutation({
    mutationFn: () => {
      const costError = validateCurrencyInput(editingCost, "هزینه ادیت");
      if (costError) {
        setEditingCostError(costError);
        throw new Error(costError);
      }
      return apiPost(`/production/projects/${projectId}/assign`, {
        editorProfileId: editorId,
        deadline: deadline || undefined,
        instructions: instructions || undefined,
        editingCost: editingCost.replace(/,/g, "").trim(),
      });
    },
    onSuccess: () => {
      toast.success("ادیتور ارجاع شد");
      setAssignOpen(false);
      setEditorId("");
      setDeadline("");
      setInstructions("");
      setEditingCost("");
      setEditingCostError(undefined);
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "خطا در ارجاع"),
  });

  const startMut = useMutation({
    mutationFn: () => apiPost(`/production/projects/${projectId}/start`, {}),
    onSuccess: () => {
      toast.success("وضعیت به «در حال ادیت» تغییر کرد");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا"),
  });

  const payload = dataQ.data;
  const task = payload?.task;

  if (dataQ.isLoading) {
    return <EditingMaterialsSkeleton />;
  }

  if (dataQ.error || !payload) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        بارگذاری گردش‌کار تولید ناموفق بود.
      </div>
    );
  }

  const materialsCtx = {
    materials: payload.materials,
    project: payload.project,
    task: task
      ? {
          status: task.status,
          deadline: task.deadline,
          revisionNotes: task.revisionNotes,
          instructions: task.instructions,
          version: task.version,
        }
      : null,
    roleCode,
  };

  const finalCount =
    finalsQ.data?.counts.total ??
    (payload.productionFiles?.watermarked?.length || 0) +
      (payload.productionFiles?.clean?.length || 0);

  const tabBadges = getProductionTabBadges(materialsCtx, { finalCount });

  const showAssign = isManager;
  const showStart =
    isEditor &&
    task &&
    (task.status === "ASSIGNED" || task.status === "REVISION_REQUESTED");

  const TAB_ICONS: Record<ProductionWorkspaceTab, typeof PackageCheck> = {
    customer: UserRound,
    ai: Sparkles,
    narration: Mic2,
    final: PackageCheck,
  };

  return (
    <div className="space-y-4 text-start" dir="rtl">
      {showAssign || showStart ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {showAssign ? (
            <Button
              variant="brand"
              size="sm"
              onClick={() => setAssignOpen(true)}
            >
              <UserRound className="h-4 w-4" />
              {task ? "تغییر ادیتور" : "ارجاع ادیتور"}
            </Button>
          ) : null}
          {showStart ? (
            <Button
              variant="brand"
              size="sm"
              onClick={() => startMut.mutate()}
              disabled={startMut.isPending}
            >
              {startMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Film className="h-4 w-4" />
              )}
              شروع ادیت
            </Button>
          ) : null}
        </div>
      ) : null}

      <Tabs
        value={workspaceTab}
        onValueChange={(v) => setWorkspaceTab(v as ProductionWorkspaceTab)}
        className="space-y-4"
        dir="rtl"
      >
        <TabsList
          variant="line"
          className="w-full justify-start overflow-x-auto overscroll-x-contain rounded-xl border border-border/60 bg-muted/20 p-1 [scrollbar-width:thin]"
          aria-label="تب‌های فضای تولید"
        >
          {PRODUCTION_WORKSPACE_TABS.map((t) => {
            const Icon = TAB_ICONS[t.id];
            const count = tabBadges[t.id];
            return (
              <TabsTrigger
                key={t.id}
                value={t.id}
                variant="line"
                className="gap-1.5 rounded-lg px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Icon className="h-3.5 w-3.5 opacity-70" aria-hidden />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.shortLabel}</span>
                {count != null && count > 0 ? (
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">
                    {count}
                  </span>
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent
          value="customer"
          className="mt-0 text-start focus-visible:ring-0"
          dir="rtl"
        >
          {workspaceTab === "customer" ? (
            <CustomerInfoTab {...materialsCtx} />
          ) : null}
        </TabsContent>

        <TabsContent
          value="ai"
          className="mt-0 text-start focus-visible:ring-0"
          dir="rtl"
        >
          {workspaceTab === "ai" ? (
            <AIGeneratedContentTab {...materialsCtx} />
          ) : null}
        </TabsContent>

        <TabsContent
          value="narration"
          className="mt-0 text-start focus-visible:ring-0"
          dir="rtl"
        >
          {workspaceTab === "narration" ? (
            <NarrationAudioTab {...materialsCtx} />
          ) : null}
        </TabsContent>

        <TabsContent
          value="final"
          className="mt-0 text-start focus-visible:ring-0"
          dir="rtl"
        >
          {workspaceTab === "final" ? (
            <ProjectFinalProductPanel
              projectId={projectId}
              roleCode={roleCode}
            />
          ) : null}
        </TabsContent>
      </Tabs>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="text-start sm:max-w-md" dir="rtl">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>ارجاع ادیتور</DialogTitle>
            <DialogDescription>
              ادیتور، هزینه ادیت، مهلت و دستورالعمل را مشخص کنید.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-start">
            <div className="space-y-2">
              <Label>ادیتور</Label>
              <Select
                value={editorId}
                onValueChange={(value) => {
                  setEditorId(value);
                  const profile = (editorsQ.data || []).find(
                    (e) => e.id === value,
                  );
                  const rate = profile?.rates?.[0]?.amount;
                  if (rate != null && rate !== "") {
                    setEditingCost(String(rate));
                  }
                }}
              >
                <SelectTrigger dir="rtl">
                  <SelectValue placeholder="انتخاب ادیتور" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {(editorsQ.data || []).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.displayName} — {e.user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <CurrencyField
              id="editing-cost"
              label="هزینه ادیت"
              value={editingCost}
              onChange={(v) => {
                setEditingCost(v);
                if (editingCostError) {
                  setEditingCostError(validateCurrencyInput(v, "هزینه ادیت"));
                }
              }}
              error={editingCostError}
              required
              hint="مبلغ پرداختی به ادیتور برای این پروژه"
            />
            <div className="space-y-2">
              <Label>مهلت ادیت</Label>
              <Input
                type="datetime-local"
                dir="ltr"
                className="text-start"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>دستورالعمل / یادداشت</Label>
              <Textarea
                rows={3}
                dir="rtl"
                className="text-start"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="نکات مهم برای ادیتور…"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              انصراف
            </Button>
            <Button
              variant="brand"
              disabled={!editorId || !editingCost.trim() || assignMut.isPending}
              onClick={() => assignMut.mutate()}
            >
              {assignMut.isPending ? "در حال ارجاع..." : "ارجاع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
