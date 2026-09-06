"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Building2, Search, UserRound, X } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { getMe } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { cn, toEnglishDigits } from "@/lib/utils";
import { invalidateFinanceQueries } from "@/lib/finance-queries";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ProjectBriefWizard,
  type ProjectBriefSubmitPayload,
  type ProjectBriefWizardProfile,
} from "@/components/brief/project-brief-wizard";
import type { ClientAssetItem } from "@/components/brief/client-assets-uploader";

type CreateCustomerOption = {
  id: string;
  customerCode?: string | null;
  personName: string;
  companyName: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  whatsappRaw?: string | null;
  normalizedWhatsapp?: string | null;
  email?: string | null;
  city?: string | null;
  address?: string | null;
};

type CreateOptionsResponse = {
  customers: CreateCustomerOption[];
  services: Array<{ id: string; name: string; revisionCount?: number }>;
  formats: Array<{ id: string; name: string; ratio: string }>;
};

type CrmCustomerDetail = {
  id: string;
  personName: string;
  companyName: string | null;
  jobTitle: string | null;
  phone: string | null;
  whatsappRaw?: string | null;
  normalizedWhatsapp?: string | null;
  address: string | null;
  email: string | null;
  portalAccount?: { normalizedWhatsapp?: string | null } | null;
  opportunities?: Array<{
    id: string;
    projectId?: string | null;
    pipelineStage?: string | null;
    agreedPrice?: number | string | null;
    proposedPrice?: number | string | null;
    contractLocked?: boolean;
    serviceId?: string | null;
    service?: { id: string; name: string } | null;
    finance?: { projectTotal?: number; totalPaid?: number } | null;
  }>;
};

function customerLabel(c: CreateCustomerOption) {
  return c.companyName
    ? `${c.personName} — ${c.companyName}`
    : c.personName;
}

/** Open CRM cycle with contract data that can attach like portal submitBrief. */
function pickAttachableOpportunity(customer?: CrmCustomerDetail | null) {
  const opps = customer?.opportunities || [];
  return (
    opps.find((opp) => {
      if (opp.projectId) return false;
      if (opp.pipelineStage === "LOST_CANCELED") return false;
      const agreed = Number(opp.agreedPrice || opp.proposedPrice || 0);
      const fromFinance = Number(opp.finance?.projectTotal || 0);
      return (
        opp.contractLocked ||
        (Number.isFinite(agreed) && agreed > 0) ||
        (Number.isFinite(fromFinance) && fromFinance > 0)
      );
    }) || null
  );
}

export default function NewProjectPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);

  const [customerQuery, setCustomerQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] =
    useState<CreateCustomerOption | null>(null);

  const selectedCustomerId = selectedCustomer?.id ?? null;

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    retry: false,
  });

  const canCreate = hasPermission(
    me?.permissions,
    "projects.create",
    me?.role,
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(toEnglishDigits(customerQuery).trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  useEffect(() => {
    if (meLoading) return;
    if (!canCreate) {
      router.replace("/projects");
    }
  }, [meLoading, canCreate, router]);

  const optionsQuery = useQuery({
    queryKey: ["projects", "create-options", debouncedQuery],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("q", debouncedQuery);
      const qs = params.toString();
      return apiGet<CreateOptionsResponse>(
        qs ? `/projects/create-options?${qs}` : "/projects/create-options",
      );
    },
    enabled: canCreate,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const customers = optionsQuery.data?.customers || [];
  const services = optionsQuery.data?.services || [];
  const formatsFromOptions = optionsQuery.data?.formats;

  const { data: formatsPublic } = useQuery({
    queryKey: ["formats"],
    queryFn: () =>
      apiGet<Array<{ id: string; name: string; ratio: string }>>("/public/formats"),
    enabled: canCreate && !formatsFromOptions?.length,
  });

  const formats = formatsFromOptions?.length
    ? formatsFromOptions
    : formatsPublic;

  const customerDetailQuery = useQuery({
    queryKey: ["crm-customer", selectedCustomerId],
    queryFn: () =>
      apiGet<CrmCustomerDetail>(`/crm/customers/${selectedCustomerId}`),
    enabled: Boolean(selectedCustomerId) && canCreate,
  });

  const assetsQuery = useQuery({
    queryKey: ["crm-customer-assets", selectedCustomerId],
    queryFn: () =>
      apiGet<ClientAssetItem[]>(
        `/crm/customers/${selectedCustomerId}/assets`,
      ),
    enabled: Boolean(selectedCustomerId) && canCreate,
  });

  const selectedOption = selectedCustomer;

  const attachableOpp = useMemo(
    () => pickAttachableOpportunity(customerDetailQuery.data),
    [customerDetailQuery.data],
  );

  const initialAgreedPrice = useMemo(() => {
    if (!attachableOpp) return null;
    const fromOpp = Number(
      attachableOpp.agreedPrice || attachableOpp.proposedPrice || 0,
    );
    if (Number.isFinite(fromOpp) && fromOpp > 0) return fromOpp;
    const fromFinance = Number(attachableOpp.finance?.projectTotal || 0);
    return Number.isFinite(fromFinance) && fromFinance > 0 ? fromFinance : null;
  }, [attachableOpp]);

  const profile: ProjectBriefWizardProfile | null = useMemo(() => {
    const detail = customerDetailQuery.data;
    const fallback = selectedOption;
    if (!detail && !fallback) return null;
    return {
      personName: detail?.personName || fallback?.personName || "",
      companyName: detail?.companyName ?? fallback?.companyName ?? null,
      phone: detail?.phone ?? fallback?.phone ?? null,
      normalizedWhatsapp:
        detail?.normalizedWhatsapp ||
        detail?.portalAccount?.normalizedWhatsapp ||
        detail?.whatsappRaw ||
        fallback?.normalizedWhatsapp ||
        fallback?.whatsappRaw ||
        "",
      address: detail?.address ?? fallback?.address ?? null,
      email: detail?.email ?? fallback?.email ?? null,
      jobTitle: detail?.jobTitle ?? fallback?.jobTitle ?? null,
    };
  }, [customerDetailQuery.data, selectedOption]);

  const selectCustomer = (customer: CreateCustomerOption) => {
    setSelectedCustomer(customer);
    setCustomerQuery("");
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerQuery("");
    searchRef.current?.focus();
  };

  const optionsError =
    optionsQuery.error instanceof Error
      ? optionsQuery.error.message
      : optionsQuery.isError
        ? "بارگذاری فهرست مشتریان ناموفق بود"
        : null;

  if (meLoading || (!canCreate && me)) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    );
  }

  if (!canCreate) {
    return null;
  }

  return (
    <div className="min-w-0 space-y-5">
      {!selectedCustomerId ? (
        <>
          <PageHeader
            inline
            title="ایجاد پروژه جدید"
            subtitle="ابتدا مشتری را انتخاب کنید، سپس فرم اطلاعات پروژه را تکمیل کنید"
            actions={
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/projects")}
              >
                بازگشت به پروژه‌ها
              </Button>
            }
          />

          <Card className="border shadow-sm">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  انتخاب مشتری
                </div>
                {!optionsQuery.isLoading && !optionsError ? (
                  <span className="text-xs text-muted-foreground">
                    {customers.length} مشتری
                  </span>
                ) : null}
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="جستجوی مشتری با نام، شرکت یا کد..."
                  className="h-11 rounded-xl ps-9"
                  autoComplete="off"
                />
              </div>

              <div className="max-h-[min(28rem,55vh)] overflow-y-auto rounded-xl border border-border/60 bg-card">
                {optionsQuery.isLoading ? (
                  <div className="space-y-2 p-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full rounded-lg" />
                    ))}
                  </div>
                ) : optionsError ? (
                  <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                    <p className="text-sm text-destructive">{optionsError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void optionsQuery.refetch()}
                    >
                      تلاش دوباره
                    </Button>
                  </div>
                ) : customers.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
                    <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-brand-muted">
                      <UserRound className="h-6 w-6 text-brand" />
                    </div>
                    <p className="text-sm font-semibold">
                      {debouncedQuery
                        ? "مشتری‌ای با این جستجو یافت نشد"
                        : "هنوز مشتری‌ای ثبت نشده"}
                    </p>
                    <p className="max-w-sm text-xs text-muted-foreground">
                      {debouncedQuery
                        ? "عبارت جستجو را تغییر دهید یا از کد مشتری استفاده کنید."
                        : "ابتدا مشتری را از بخش CRM اضافه کنید، سپس اینجا انتخاب کنید."}
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border/50">
                    {customers.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-start gap-3 px-3 py-3 text-start transition-colors hover:bg-muted/50",
                            "focus-visible:bg-muted/60 focus-visible:outline-none",
                          )}
                          onClick={() => selectCustomer(c)}
                        >
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="truncate text-sm font-semibold">
                              {customerLabel(c)}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {[
                                c.customerCode,
                                c.phone || c.whatsappRaw,
                                c.city,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      ) : !profile ? (
        <div className="mx-auto max-w-4xl space-y-4">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-xl"
              onClick={() => router.push("/projects")}
            >
              بازگشت به پروژه‌ها
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={clearCustomer}
            >
              <X className="h-4 w-4" />
              تغییر مشتری
            </Button>
          </div>

          <ProjectBriefWizard
            key={selectedCustomerId}
            mode="internal"
            profile={profile}
            formats={formats}
            services={services}
            initialAgreedPrice={initialAgreedPrice}
            initialServiceId={
              attachableOpp?.serviceId || attachableOpp?.service?.id || null
            }
            contractPriceLocked={Boolean(
              attachableOpp && initialAgreedPrice && initialAgreedPrice > 0,
            )}
            assets={assetsQuery.data}
            onRefreshAssets={() => {
              void assetsQuery.refetch();
            }}
            assetsCreatePath={`/crm/customers/${selectedCustomerId}/assets`}
            assetsDeletePath={(id) =>
              `/crm/customers/${selectedCustomerId}/assets/${id}`
            }
            onSubmit={async (payload: ProjectBriefSubmitPayload) => {
              return apiPost<{ id: string }>("/projects", {
                crmCustomerId: selectedCustomerId,
                opportunityId: attachableOpp?.id || undefined,
                ...payload,
              });
            }}
            onSuccess={async (project) => {
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["projects"] }),
                queryClient.invalidateQueries({ queryKey: ["projects-home"] }),
                queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
                queryClient.invalidateQueries({ queryKey: ["crm-customers"] }),
                queryClient.invalidateQueries({ queryKey: ["crm-customer"] }),
                queryClient.invalidateQueries({ queryKey: ["notifications"] }),
                invalidateFinanceQueries(queryClient),
              ]);
              router.push(`/projects/${project.id}`);
            }}
          />
        </div>
      )}
    </div>
  );
}
