"use client";

import { use, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PortalStatusBadge } from "@/components/portal/portal-status-badge";
import { PortalProjectBriefView } from "@/components/portal/portal-project-brief-view";
import type { PortalProjectAsset } from "@/components/portal/portal-project-assets";
import {
  ProjectSectionShell,
  ProjectSectionSwitcher,
  type ProjectDataSectionId,
} from "@/components/projects/project-data-sections";
import {
  SectionTabs,
  SectionTabsList,
  SectionTabsPanel,
  SectionTabsTrigger,
} from "@/components/shared/section-tab-nav";
import { replaceTabSearchParams } from "@/lib/tab-url";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  ClipboardList,
  Download,
  FolderOpen,
  MessageCircle,
  PackageCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ProjectProgressBar } from "@/components/projects/project-progress-bar";
import type { PortalFinalVideo } from "@/components/portal/portal-final-product";

function PortalPanelSkeleton() {
  return (
    <div className="space-y-3 p-1" aria-busy="true">
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

const PortalProjectAssets = dynamic(
  () =>
    import("@/components/portal/portal-project-assets").then(
      (m) => m.PortalProjectAssets,
    ),
  { ssr: false, loading: () => <PortalPanelSkeleton /> },
);

const PortalContentApproval = dynamic(
  () =>
    import("@/components/portal/portal-content-approval").then(
      (m) => m.PortalContentApproval,
    ),
  { ssr: false, loading: () => <PortalPanelSkeleton /> },
);

const PortalFinalProduct = dynamic(
  () =>
    import("@/components/portal/portal-final-product").then(
      (m) => m.PortalFinalProduct,
    ),
  { ssr: false, loading: () => <PortalPanelSkeleton /> },
);

type CustomerSubId = "brief" | "assets";
type ApexSubId = "content" | "final";

interface PortalProject {
  id: string;
  code: string;
  title: string;
  status: string;
  internalStatus?: string;
  progress: import("@/lib/project-progress").ProjectProgress | number;
  createdAt: string;
  updatedAt: string;
  deadlineAt: string | null;
  durationSec?: number | null;
  language?: string | null;
  tone?: string | null;
  platforms?: string[];
  format?: { id: string; name: string; ratio: string } | null;
  brief: Record<string, unknown>;
  customAspectRatio?: string | null;
  assets: PortalProjectAsset[];
  contentRevisionUsed: number;
  contentRevisionMax: number;
  videoRevisionUsed: number;
  videoRevisionMax: number;
  contentVersions: Array<{
    id: string;
    kind: string;
    versionNumber: number;
    status?: string;
    isLocked: boolean;
    publishedAt: string | null;
    rejectionReason?: string | null;
    scenario?: unknown;
    narration?: unknown;
    storyboard?: unknown;
  }>;
  watermarkedFiles: PortalFinalVideo[];
  cleanFiles?: PortalFinalVideo[];
  finalVideos?: PortalFinalVideo[];
  cleanDownloadAvailable: boolean;
  paymentStatus?: string;
  deliveryStatus?: string;
  cleanFileAccess?: string;
}

function applyLegacyTab(
  q: string | null,
  setters: {
    setSection: (v: ProjectDataSectionId) => void;
    setCustomerSub: (v: CustomerSubId) => void;
    setApexSub: (v: ApexSubId) => void;
  },
) {
  if (!q) return;
  if (q === "submitted") {
    setters.setSection("customer");
    setters.setCustomerSub("brief");
    return;
  }
  if (q === "assets") {
    setters.setSection("customer");
    setters.setCustomerSub("assets");
    return;
  }
  // Removed tabs: overview / delivery / workflow → nearest remaining tab
  if (q === "overview" || q === "approval" || q === "content") {
    setters.setSection("apex");
    setters.setApexSub("content");
    return;
  }
  if (q === "workflow" || q === "delivery" || q === "final" || q === "product") {
    setters.setSection("apex");
    setters.setApexSub("final");
    return;
  }
  if (q === "customer") {
    setters.setSection("customer");
    return;
  }
  if (q === "apex") {
    setters.setSection("apex");
  }
}

export default function PortalProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<ProjectDataSectionId>("customer");
  const [customerSub, setCustomerSub] = useState<CustomerSubId>("brief");
  const [apexSub, setApexSub] = useState<ApexSubId>("content");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackBody, setFeedbackBody] = useState("");

  useEffect(() => {
    applyLegacyTab(searchParams.get("tab"), {
      setSection,
      setCustomerSub,
      setApexSub,
    });
    const sectionParam = searchParams.get("section");
    if (sectionParam === "customer" || sectionParam === "apex") {
      setSection(sectionParam);
    }
  }, [searchParams]);

  const handleSectionChange = (next: ProjectDataSectionId) => {
    setSection(next);
    replaceTabSearchParams({ section: next });
  };

  const handleCustomerSubChange = (next: CustomerSubId) => {
    setCustomerSub(next);
    replaceTabSearchParams({
      section: "customer",
      tab: next === "assets" ? "assets" : "submitted",
    });
  };

  const handleApexSubChange = (next: ApexSubId) => {
    setApexSub(next);
    replaceTabSearchParams({
      section: "apex",
      tab: next,
    });
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-project", id],
    queryFn: () => apiGet<PortalProject>(`/portal/projects/${id}`),
  });

  const approveContent = useMutation({
    mutationFn: (versionId: string) =>
      apiPost(`/portal/content/${versionId}/approve`),
    onSuccess: () => {
      toast.success("محتوا تأیید شد");
      queryClient.invalidateQueries({ queryKey: ["portal-project", id] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "تأیید ناموفق بود");
    },
  });

  const requestContentChanges = useMutation({
    mutationFn: ({
      versionId,
      body,
      reason,
    }: {
      versionId: string;
      body: string;
      reason?: string;
    }) =>
      apiPost(`/portal/content/${versionId}/request-changes`, { body, reason }),
    onSuccess: () => {
      toast.success("درخواست اصلاح ثبت شد");
      queryClient.invalidateQueries({ queryKey: ["portal-project", id] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "ثبت درخواست ناموفق بود");
    },
  });

  const approveFinal = useMutation({
    mutationFn: (payload: {
      videoType: "CLEAN" | "WATERMARKED";
      fileId?: string;
    }) =>
      apiPost<{
        completed?: boolean;
        alreadyCompleted?: boolean;
        awaitingPayment?: boolean;
        awaitingDeliveryUnlock?: boolean;
      }>(`/portal/projects/${id}/final/approve`, payload),
    onSuccess: (res) => {
      toast.success(
        res?.alreadyCompleted
          ? "پروژه قبلاً تکمیل شده است"
          : res?.completed
            ? "محصول نهایی تأیید شد — پروژه تکمیل شد"
            : res?.awaitingPayment
              ? "محصول نهایی تأیید شد — در انتظار تسویه پرداخت"
              : "محصول نهایی تأیید شد — در انتظار فعال‌سازی تحویل",
      );
      queryClient.invalidateQueries({ queryKey: ["portal-project", id] });
      queryClient.invalidateQueries({ queryKey: ["portal-projects"] });
      queryClient.invalidateQueries({ queryKey: ["portal-dashboard"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "تأیید ناموفق بود");
    },
  });

  const requestFinalChanges = useMutation({
    mutationFn: (body: string) =>
      apiPost(`/portal/projects/${id}/final/request-changes`, { body }),
    onSuccess: () => {
      toast.success("درخواست اصلاح ثبت شد");
      setFeedbackOpen(false);
      setFeedbackBody("");
      queryClient.invalidateQueries({ queryKey: ["portal-project", id] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "ثبت درخواست ناموفق بود");
    },
  });

  const contactMut = useMutation({
    mutationFn: () =>
      apiGet<{ url: string }>(`/portal/projects/${id}/contact-manager`),
    onSuccess: (res) => {
      window.open(res.url, "_blank", "noopener,noreferrer");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "خطا");
    },
  });

  const downloadMut = useMutation({
    mutationFn: () =>
      apiGet<{ url: string; projectCompleted?: boolean }>(
        `/portal/downloads/${id}`,
      ),
    onSuccess: (res) => {
      window.open(res.url, "_blank", "noopener,noreferrer");
      toast.success(
        res.projectCompleted
          ? "دانلود شروع شد — پروژه تکمیل شد"
          : "لینک دانلود باز شد",
      );
      queryClient.invalidateQueries({ queryKey: ["portal-project", id] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "دانلود در دسترس نیست");
    },
  });

  function openFeedback() {
    setFeedbackBody("");
    setFeedbackOpen(true);
  }

  function submitFeedback() {
    if (!feedbackBody.trim()) {
      toast.error("توضیح تغییرات الزامی است");
      return;
    }
    requestFinalChanges.mutate(feedbackBody);
  }

  if (isLoading) {
    return (
      <div dir="rtl" className="space-y-4 text-start">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div dir="rtl" className="text-start">
        <EmptyState
          title="پروژه یافت نشد"
          action={
            <Button variant="outline" asChild>
              <Link href="/portal/projects">
                <ArrowRight className="h-4 w-4" />
                بازگشت به پروژه‌ها
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const finalVideos: PortalFinalVideo[] =
    data.finalVideos && data.finalVideos.length > 0
      ? data.finalVideos
      : data.watermarkedFiles || [];

  const watermarkedVideos =
    data.watermarkedFiles?.length
      ? data.watermarkedFiles
      : finalVideos.filter((v) => (v.videoType || "WATERMARKED") !== "CLEAN");

  const cleanVideos =
    data.cleanFiles?.length
      ? data.cleanFiles
      : finalVideos.filter((v) => v.videoType === "CLEAN");

  const primaryClean = cleanVideos[0];
  const cleanUnlocked =
    !!primaryClean &&
    primaryClean.accessLocked !== true &&
    primaryClean.canPlay !== false;
  const projectCompleted = data.status === "COMPLETED";
  const awaitingFinalDecision =
    !projectCompleted &&
    finalVideos.length > 0 &&
    (data.internalStatus === "WAITING_CLIENT_FINAL_APPROVAL" ||
      ["WAITING_YOUR_APPROVAL", "FINAL_REVIEW"].includes(data.status));
  const canApproveFinal =
    !projectCompleted &&
    finalVideos.length > 0 &&
    (awaitingFinalDecision || cleanUnlocked);
  const canRequestRevision =
    awaitingFinalDecision &&
    !["WAITING_PAYMENT", "READY_DELIVERY"].includes(data.status);

  return (
    <div dir="rtl" className="space-y-6 text-start">
      <header className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ms-2 h-8 gap-1.5 px-2"
          asChild
        >
          <Link href="/portal/projects">
            <ArrowRight className="h-4 w-4" />
            بازگشت به پروژه‌ها
          </Link>
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between">
          <div className="min-w-0 flex-1 space-y-3 text-start">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold leading-snug tracking-tight text-start">
                {data.title}
              </h1>
              <p className="text-sm text-muted-foreground">
                شماره پروژه:{" "}
                <bdi
                  dir="ltr"
                  className="inline-block font-medium text-foreground"
                >
                  {data.code}
                </bdi>
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-2">
              <PortalStatusBadge status={data.status} />
              <span className="text-xs text-muted-foreground">
                ایجاد: {formatDate(data.createdAt)}
              </span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                ·
              </span>
              <span className="text-xs text-muted-foreground">
                بروزرسانی: {formatDate(data.updatedAt)}
              </span>
            </div>
            <div className="flex flex-wrap justify-start gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => contactMut.mutate()}
                disabled={contactMut.isPending}
              >
                <MessageCircle className="h-4 w-4" />
                ارتباط با مدیر
              </Button>
              {data.cleanDownloadAvailable ? (
                <Button
                  variant="brand"
                  size="sm"
                  className="gap-2"
                  onClick={() => downloadMut.mutate()}
                  disabled={downloadMut.isPending}
                >
                  <Download className="h-4 w-4" />
                  دانلود فایل پاک
                </Button>
              ) : (
                (data.paymentStatus || data.deliveryStatus) &&
                (data.cleanFileAccess === "LOCKED_PAYMENT" ||
                  data.status === "COMPLETED") && (
                  <Badge
                    variant="outline"
                    className="h-8 gap-1 px-3 text-xs font-normal"
                  >
                    {data.cleanFileAccess === "LOCKED_PAYMENT"
                      ? "دانلود پس از تسویه پرداخت"
                      : data.status === "COMPLETED"
                        ? "پروژه تکمیل‌شده"
                        : null}
                  </Badge>
                )
              )}
            </div>
          </div>

          <div className="w-full shrink-0 sm:max-w-xs">
            <ProjectProgressBar
              progress={data.progress}
              status={data.status}
              variant="full"
            />
          </div>
        </div>
      </header>

      <div className="space-y-4">
        <ProjectSectionSwitcher
          value={section}
          onChange={handleSectionChange}
          customerDescription="اطلاعات و فایل‌هایی که شما ارسال کرده‌اید"
          apexDescription="محتوا و خروجی‌های تهیه‌شده توسط تیم APEX"
        />

        {section === "customer" && (
          <ProjectSectionShell
            tone="customer"
            title="اطلاعات ارسالی شما"
            badge="فقط مشاهده"
          >
            <SectionTabs
              value={customerSub}
              onValueChange={(v) => handleCustomerSubChange(v as CustomerSubId)}
              dir="rtl"
            >
              <SectionTabsList aria-label="بخش‌های اطلاعات مشتری">
                <SectionTabsTrigger value="brief">
                  <ClipboardList className="h-3.5 w-3.5" />
                  اطلاعات ارسالی
                </SectionTabsTrigger>
                <SectionTabsTrigger value="assets">
                  <FolderOpen className="h-3.5 w-3.5" />
                  دارایی‌ها
                </SectionTabsTrigger>
              </SectionTabsList>

              <SectionTabsPanel value="brief">
                <PortalProjectBriefView
                  brief={data.brief || {}}
                  durationSec={data.durationSec}
                  language={data.language}
                  tone={data.tone}
                  platforms={data.platforms}
                  format={data.format}
                  customAspectRatio={data.customAspectRatio}
                />
              </SectionTabsPanel>

              <SectionTabsPanel value="assets">
                <PortalProjectAssets assets={data.assets || []} />
              </SectionTabsPanel>
            </SectionTabs>
          </ProjectSectionShell>
        )}

        {section === "apex" && (
          <ProjectSectionShell
            tone="apex"
            title="آماده‌سازی و خروجی تیم APEX"
            badge="تهیه‌شده توسط APEX"
          >
            <SectionTabs
              value={apexSub}
              onValueChange={(v) => handleApexSubChange(v as ApexSubId)}
              dir="rtl"
            >
              <SectionTabsList aria-label="بخش‌های پروژه APEX">
                <SectionTabsTrigger value="content">
                  <Sparkles className="h-3.5 w-3.5" />
                  تأیید محتوا
                </SectionTabsTrigger>
                <SectionTabsTrigger value="final">
                  <PackageCheck className="h-3.5 w-3.5" />
                  محصول نهایی
                </SectionTabsTrigger>
              </SectionTabsList>

              <SectionTabsPanel value="content">
                <Card>
                  <CardContent className="p-4 sm:p-5">
                    <PortalContentApproval
                      versions={data.contentVersions}
                      revisionUsed={data.contentRevisionUsed}
                      revisionMax={data.contentRevisionMax}
                      approving={approveContent.isPending}
                      requesting={requestContentChanges.isPending}
                      onApprove={(versionId) => approveContent.mutate(versionId)}
                      onRequestRevision={async ({ versionId, body, reason }) => {
                        await requestContentChanges.mutateAsync({
                          versionId,
                          body,
                          reason,
                        });
                      }}
                    />
                  </CardContent>
                </Card>
              </SectionTabsPanel>

              <SectionTabsPanel value="final">
                <PortalFinalProduct
                  videos={finalVideos}
                  watermarkedVideos={watermarkedVideos}
                  cleanVideos={cleanVideos}
                  projectTitle={data.title}
                  projectCode={data.code}
                  revisionUsed={data.videoRevisionUsed}
                  revisionMax={data.videoRevisionMax}
                  canApproveFinal={canApproveFinal}
                  canRequestRevision={canRequestRevision}
                  approving={approveFinal.isPending}
                  onApproveFinal={(payload) => approveFinal.mutate(payload)}
                  onRequestRevision={openFeedback}
                  paymentDetailsHref="/portal"
                />
              </SectionTabsPanel>
            </SectionTabs>
          </ProjectSectionShell>
        )}
      </div>

      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent dir="rtl" className="text-start sm:max-w-md">
          <DialogHeader className="space-y-1 text-start sm:text-start">
            <DialogTitle>درخواست اصلاح</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feedback" className="text-start">
                توضیح تغییرات
              </Label>
              <Textarea
                id="feedback"
                dir="rtl"
                rows={4}
                value={feedbackBody}
                onChange={(e) => setFeedbackBody(e.target.value)}
                placeholder="لطفاً تغییرات مورد نظر خود را بنویسید..."
                className="text-start"
              />
            </div>
            <Button
              className="w-full"
              variant="brand"
              onClick={submitFeedback}
              disabled={requestFinalChanges.isPending}
            >
              ارسال
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
