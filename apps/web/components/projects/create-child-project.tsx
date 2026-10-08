"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { useMeQuery } from "@/lib/permissions";
import { invalidateFinanceQueries } from "@/lib/finance-queries";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  ProjectBriefWizard,
  type ProjectBriefSubmitPayload,
  type ProjectBriefWizardProfile,
} from "@/components/brief/project-brief-wizard";
import type { ClientAssetItem } from "@/components/brief/client-assets-uploader";

type ParentProject = {
  id: string;
  code: string;
  title: string;
  kind?: string;
  brief?: Record<string, unknown> | null;
  crmCustomer: {
    id: string;
    personName: string;
    companyName: string | null;
    jobTitle?: string | null;
    phone?: string | null;
    whatsappRaw?: string | null;
    normalizedWhatsapp?: string | null;
    address?: string | null;
    email?: string | null;
  };
};

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function CreateChildProject({ parentId }: { parentId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me, isLoading: meLoading } = useMeQuery();
  const canCreate = hasPermission(me?.permissions, "projects.create", me?.role);

  const parentQuery = useQuery({
    queryKey: ["project", parentId],
    queryFn: () => apiGet<ParentProject>(`/projects/${parentId}`),
    enabled: canCreate,
  });

  const parent = parentQuery.data;
  const customerId = parent?.kind === "CONTRACT" ? parent.crmCustomer.id : null;

  const formatsQuery = useQuery({
    queryKey: ["formats"],
    queryFn: () =>
      apiGet<Array<{ id: string; name: string; ratio: string }>>("/public/formats"),
    enabled: Boolean(customerId),
  });

  const assetsQuery = useQuery({
    queryKey: ["crm-customer-assets", customerId],
    queryFn: () =>
      apiGet<ClientAssetItem[]>(`/crm/customers/${customerId}/assets`),
    enabled: Boolean(customerId),
  });

  const profile: ProjectBriefWizardProfile | null = useMemo(() => {
    if (!parent || parent.kind !== "CONTRACT") return null;
    const brief = parent.brief || {};
    const customer = parent.crmCustomer;
    return {
      personName: textValue(brief.personName) || customer.personName,
      companyName: textValue(brief.companyName) || customer.companyName,
      phone: textValue(brief.phone) || customer.phone || null,
      normalizedWhatsapp:
        textValue(brief.whatsapp) ||
        customer.normalizedWhatsapp ||
        customer.whatsappRaw ||
        "",
      address: textValue(brief.address) || customer.address || null,
      email: textValue(brief.email) || customer.email || null,
      jobTitle: textValue(brief.jobTitle) || customer.jobTitle || null,
    };
  }, [parent]);

  if (meLoading || parentQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (!canCreate) {
    return (
      <EmptyState
        title="اجازه ایجاد پروژه ندارید"
        action={
          <Button variant="outline" onClick={() => router.push("/projects")}>
            بازگشت
          </Button>
        }
      />
    );
  }

  if (parentQuery.error || !parent || parent.kind !== "CONTRACT" || !profile || !customerId) {
    return (
      <EmptyState
        title="قرارداد یافت نشد"
        description="ویدیو فقط داخل یک قرارداد چندویدیویی ساخته می‌شود."
        action={
          <Button variant="outline" onClick={() => router.push("/projects")}>
            بازگشت به پروژه‌ها
          </Button>
        }
      />
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-xl"
          onClick={() => router.push(`/projects/${parent.id}`)}
        >
          بازگشت به قرارداد
        </Button>
        <p className="text-xs text-muted-foreground">{parent.title}</p>
      </div>
      <ProjectBriefWizard
        key={parent.id}
        mode="internal"
        inheritCustomer
        requirePricing
        profile={profile}
        formats={formatsQuery.data}
        assets={assetsQuery.data}
        onRefreshAssets={() => {
          void assetsQuery.refetch();
        }}
        assetsCreatePath={`/crm/customers/${customerId}/assets`}
        assetsDeletePath={(id) => `/crm/customers/${customerId}/assets/${id}`}
        onSubmit={async (payload: ProjectBriefSubmitPayload) =>
          apiPost<{ id: string }>("/projects", {
            crmCustomerId: customerId,
            parentProjectId: parent.id,
            ...payload,
          })
        }
        onSuccess={async (project) => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["projects"] }),
            queryClient.invalidateQueries({ queryKey: ["project", parent.id] }),
            queryClient.invalidateQueries({ queryKey: ["projects-home"] }),
            queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
            queryClient.invalidateQueries({ queryKey: ["notifications"] }),
            invalidateFinanceQueries(queryClient),
          ]);
          router.push(`/projects/${project.id}`);
        }}
      />
    </div>
  );
}
