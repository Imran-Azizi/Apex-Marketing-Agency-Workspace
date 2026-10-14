"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { CalendarRange, ChevronLeft, Clapperboard } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ProjectBriefWizard,
  type ProjectBriefSubmitPayload,
  type ProjectBriefWizardProfile,
} from "@/components/brief/project-brief-wizard";
import type { ClientAssetItem } from "@/components/brief/client-assets-uploader";
import { CreateContractForm } from "@/components/projects/create-contract-form";

interface PendingBrief {
  id: string;
  service: { id: string; name: string } | null;
}

type ProjectType = "single" | "contract";

const PROJECT_TYPES = [
  {
    type: "single",
    label: "پروژه تک‌ویدیویی",
    description: "یک ویدیو با فرم کامل اطلاعات پروژه",
    Icon: Clapperboard,
  },
  {
    type: "contract",
    label: "قرارداد چندویدیویی / ماهانه",
    description: "چند ویدیو و پوستر در یک دوره قرارداد",
    Icon: CalendarRange,
  },
] as const;

function parseProjectType(value: string | null): ProjectType | null {
  return value === "single" || value === "contract" ? value : null;
}

export default function PortalBriefForm() {
  const router = useRouter();
  const search = useSearchParams();
  const queryClient = useQueryClient();
  const [projectType, setProjectType] = useState<ProjectType | null>(() =>
    parseProjectType(search.get("type")),
  );
  const initialOpportunityId = search.get("opportunityId") || undefined;

  const { data: pending, isLoading } = useQuery({
    queryKey: ["pending-briefs"],
    queryFn: () => apiGet<PendingBrief[]>("/portal/pending-briefs"),
  });

  const { data: profile } = useQuery({
    queryKey: ["portal-profile"],
    queryFn: () => apiGet<ProjectBriefWizardProfile>("/portal/profile"),
  });

  const { data: formats } = useQuery({
    queryKey: ["formats"],
    queryFn: () =>
      apiGet<Array<{ id: string; name: string; ratio: string }>>("/public/formats"),
  });

  const { data: assets, refetch: refetchAssets } = useQuery({
    queryKey: ["portal-assets"],
    queryFn: () => apiGet<ClientAssetItem[]>("/portal/assets"),
  });

  const contractOpportunityId =
    pending?.find((order) => order.id === initialOpportunityId)?.id || pending?.[0]?.id;

  const emptyState = (
    <EmptyState
      title="سفارش تأییدشده‌ای برای فرم وجود ندارد"
      description="پس از تأیید سفارش و بیعانه توسط تیم فروش، می‌توانید فرم اطلاعات پروژه را تکمیل کنید."
      action={
        <Button asChild variant="outline">
          <Link href="/portal">بازگشت به داشبورد</Link>
        </Button>
      }
    />
  );

  const changeTypeButton = (
    <div className="mx-auto flex max-w-4xl justify-end">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="rounded-xl"
        onClick={() => setProjectType(null)}
      >
        تغییر نوع پروژه
      </Button>
    </div>
  );

  if (projectType !== "single") {
    if (isLoading || (projectType === "contract" && !profile)) {
      return (
        <div className="mx-auto max-w-4xl space-y-4">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      );
    }
    if (!pending?.length || !contractOpportunityId) return emptyState;
  }

  if (projectType === null) {
    return (
      <div dir="rtl" className="mx-auto max-w-4xl space-y-5">
        <PageHeader
          inline
          title="ایجاد پروژه جدید"
          subtitle="نوع پروژه را انتخاب کنید"
          subtitleClassName="hidden sm:block"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {PROJECT_TYPES.map(({ type, label, description, Icon }) => (
            <button
              key={type}
              type="button"
              className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-4 text-start shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:p-5"
              onClick={() => setProjectType(type)}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                <Icon className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="block text-base font-semibold">{label}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </span>
              <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5 group-hover:text-brand" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (projectType === "contract" && profile && contractOpportunityId) {
    return (
      <div dir="rtl" className="space-y-4">
        {changeTypeButton}
        <CreateContractForm
          variant="portal"
          opportunityId={contractOpportunityId}
          profile={profile}
          onCreated={(project) => {
            void queryClient.invalidateQueries({ queryKey: ["portal-dashboard"] });
            void queryClient.invalidateQueries({ queryKey: ["portal-contracts"] });
            void queryClient.invalidateQueries({ queryKey: ["pending-briefs"] });
            void queryClient.invalidateQueries({ queryKey: ["notifications"] });
            router.push(`/portal/contracts/${project.id}`);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pending?.length ? changeTypeButton : null}
      <ProjectBriefWizard
        mode="portal"
        isLoading={isLoading}
        pendingOrders={pending}
        initialOpportunityId={initialOpportunityId}
        profile={profile}
        formats={formats}
        assets={assets}
        onRefreshAssets={() => {
          void refetchAssets();
        }}
        emptyState={emptyState}
        onSubmit={async (payload: ProjectBriefSubmitPayload & { opportunityId?: string }) =>
          apiPost<{ id: string }>("/portal/brief", payload)
        }
        onSuccess={(project) => {
          void queryClient.invalidateQueries({ queryKey: ["portal-dashboard"] });
          void queryClient.invalidateQueries({ queryKey: ["portal-projects"] });
          void queryClient.invalidateQueries({ queryKey: ["pending-briefs"] });
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          router.push(`/portal/projects/${project.id}`);
        }}
      />
    </div>
  );
}
