"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  ProjectBriefWizard,
  type ProjectBriefSubmitPayload,
  type ProjectBriefWizardProfile,
} from "@/components/brief/project-brief-wizard";
import type { ClientAssetItem } from "@/components/brief/client-assets-uploader";

interface PendingBrief {
  id: string;
  service: { id: string; name: string } | null;
}

export default function PortalBriefForm() {
  const router = useRouter();
  const search = useSearchParams();
  const queryClient = useQueryClient();

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

  return (
    <ProjectBriefWizard
      mode="portal"
      isLoading={isLoading}
      pendingOrders={pending}
      initialOpportunityId={search.get("opportunityId") || undefined}
      profile={profile}
      formats={formats}
      assets={assets}
      onRefreshAssets={() => {
        void refetchAssets();
      }}
      emptyState={
        <EmptyState
          title="سفارش تأییدشده‌ای برای فرم وجود ندارد"
          description="پس از تأیید سفارش و بیعانه توسط تیم فروش، می‌توانید فرم اطلاعات پروژه را تکمیل کنید."
          action={
            <Button asChild variant="outline">
              <Link href="/portal">بازگشت به داشبورد</Link>
            </Button>
          }
        />
      }
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
  );
}
