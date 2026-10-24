"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { useMeQuery } from "@/lib/permissions";
import {
  canManagePortalInvite,
  canViewPortalCredentials,
} from "@/lib/rbac";
import {
  openWhatsAppChat,
  resolveWhatsAppContactSource,
} from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { CustomerDetailsForm } from "../_components/customer-details-form";
import { PaymentHistoryPanel } from "../_components/payment-history-panel";
import { CustomerProfileHeader } from "../_components/customer-profile-header";
import { PortalInviteSection } from "../_components/portal-invite-section";
import { CustomerDetailSkeleton } from "../_components/customer-detail-skeleton";
import { CustomerSalesAssistantCard } from "../_components/customer-sales-assistant-card";
import {
  CustomerDetailTabsNav,
  type CrmDetailTabValue,
} from "../_components/customer-detail-tabs";
import type { PortalCredentials } from "@/lib/portal-invites";
import type { CrmContractSummary } from "../_components/types";
import { cn } from "@/lib/utils";

interface Opportunity {
  id: string;
  title: string;
  createdAt?: string;
  proposedPrice: string | null;
  agreedPrice: string | null;
  advancePayment?: string | null;
  agreedTerms: string | null;
  projectId: string | null;
  project?: {
    id: string;
    code: string;
    title: string;
    status: string;
    kind: string;
  } | null;
  contractLocked?: boolean | null;
  contractLockedAt?: string | null;
  finance?: {
    projectTotal: number;
    totalPaid: number;
    remainingBalance: number;
    customerDebt: number;
  } | null;
  contract?: CrmContractSummary | null;
}

interface CrmCustomerDetail {
  id: string;
  personName: string;
  companyName: string | null;
  jobTitle: string | null;
  phone: string | null;
  whatsappRaw: string;
  email: string | null;
  city: string | null;
  address: string | null;
  source: string | null;
  portalStatus: string;
  notes: string | null;
  nextFollowUpAt: string | null;
  salesOwner: { fullName: string } | null;
  portalCredentials?: PortalCredentials | null;
  opportunities: Opportunity[];
  projects: Array<{ id: string; code: string; title: string; status: string }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    total: string;
    status: string;
    opportunityId?: string | null;
  }>;
  payments: Array<{
    id: string;
    amount: string;
    verification: string;
    invoiceId: string | null;
    opportunityId?: string | null;
    createdAt: string;
    paidAt?: string;
    reference?: string | null;
    method?: string | null;
    methodLabel?: string | null;
    recordedBy?: { id: string; fullName: string } | null;
    invoice?: {
      id: string;
      invoiceNumber: string;
      opportunityId?: string | null;
      projectId?: string | null;
    } | null;
  }>;
}

/** Payment belongs to the selected project/contract cycle only. */
function paymentBelongsToOpportunity(
  payment: CrmCustomerDetail["payments"][number],
  opportunityId: string,
) {
  if (payment.opportunityId === opportunityId) return true;
  if (payment.invoice?.opportunityId === opportunityId) return true;
  return false;
}

interface InviteEligibility {
  eligible: boolean;
  gates: Record<string, boolean>;
  hasExistingPortal: boolean;
}

export default function CrmDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { data: me } = useMeQuery();
  const canInvite = canManagePortalInvite(me?.permissions, me?.role);
  const canSeePortalCredentials = canViewPortalCredentials(
    me?.permissions,
    me?.role,
  );
  const [inviteUrl, setInviteUrl] = useState("");
  const [activeTab, setActiveTab] = useState<CrmDetailTabValue>("details");
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const receipt = searchParams.get("receipt");
    if (tab === "history" || tab === "details") {
      setActiveTab(tab);
    } else if (tab === "portal" && canInvite) {
      setActiveTab("portal");
    }
    if (receipt) {
      setActiveTab("history");
      setReceiptPaymentId(receipt);
    }
  }, [searchParams, canInvite]);

  const clearReceiptHandoff = useCallback(() => {
    setReceiptPaymentId(null);
    const params = new URLSearchParams(searchParams.toString());
    if (params.has("receipt") || params.has("tab")) {
      params.delete("receipt");
      // Keep history tab visible after handoff without sticky query noise.
      if (params.get("tab") === "history") params.delete("tab");
      const qs = params.toString();
      router.replace(qs ? `/crm/${id}?${qs}` : `/crm/${id}`, { scroll: false });
    }
  }, [id, router, searchParams]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["crm-customer", id],
    queryFn: () => apiGet<CrmCustomerDetail>(`/crm/customers/${id}`),
    refetchInterval: (query) => {
      const customer = query.state.data;
      if (!customer) return false;
      if (customer.portalCredentials?.isRegistered) return false;
      if (
        customer.portalStatus === "INVITED" ||
        customer.portalCredentials?.status === "INVITED"
      ) {
        return 8000;
      }
      return false;
    },
  });

  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);

  // Every opportunity is its own commercial cycle (one price per project).
  // Prefer an open sales cycle, otherwise the newest opportunity.
  const oppChoices = useMemo(() => {
    const opportunities = data?.opportunities ?? [];
    if (!opportunities.length) return [];
    return [...opportunities].sort((a, b) => {
      const aOpen = a.projectId ? 1 : 0;
      const bOpen = b.projectId ? 1 : 0;
      if (aOpen !== bOpen) return aOpen - bOpen;
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [data]);

  const opp = useMemo(
    () =>
      oppChoices.find((o) => o.id === selectedOppId) ?? oppChoices[0] ?? null,
    [oppChoices, selectedOppId],
  );

  useEffect(() => {
    if (!oppChoices.length) {
      setSelectedOppId(null);
      return;
    }
    if (selectedOppId && oppChoices.some((o) => o.id === selectedOppId)) {
      return;
    }
    setSelectedOppId(oppChoices[0]?.id ?? null);
  }, [oppChoices, selectedOppId]);

  const cyclePayments = useMemo(() => {
    if (!opp?.id) return [];
    return (data?.payments ?? []).filter((p) =>
      paymentBelongsToOpportunity(p, opp.id),
    );
  }, [data?.payments, opp?.id]);

  const cycleInvoices = useMemo(() => {
    if (!opp?.id) return [];
    return (data?.invoices ?? []).filter(
      (inv) => inv.opportunityId === opp.id,
    );
  }, [data?.invoices, opp?.id]);

  const { data: eligibility } = useQuery({
    queryKey: ["invite-eligibility", opp?.id],
    queryFn: () =>
      apiGet<InviteEligibility>(
        `/crm/opportunities/${opp!.id}/invite-eligibility`,
      ),
    enabled: canInvite && !!opp?.id,
    refetchInterval: () => {
      if (data?.portalCredentials?.isRegistered) return false;
      if (
        data?.portalStatus === "INVITED" ||
        data?.portalCredentials?.status === "INVITED"
      ) {
        return 8000;
      }
      return false;
    },
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["crm-customer", id] });
    await qc.refetchQueries({ queryKey: ["crm-customer", id] });
    if (opp?.id) {
      await qc.invalidateQueries({ queryKey: ["invite-eligibility", opp.id] });
      await qc.invalidateQueries({ queryKey: ["portal-invites", opp.id] });
    }
    // Keep project / portal panels in sync with payment changes.
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["projects"] }),
      qc.invalidateQueries({ queryKey: ["project"] }),
      qc.invalidateQueries({ queryKey: ["portal-dashboard"] }),
      qc.invalidateQueries({ queryKey: ["portal-projects"] }),
      qc.invalidateQueries({ queryKey: ["portal-project"] }),
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      qc.invalidateQueries({ queryKey: ["crm-customers"] }),
      qc.invalidateQueries({ queryKey: ["crm-dashboard"] }),
    ]);
  };

  const handlePaymentCreated = async (payment: {
    id: string;
    isFirstPayment?: boolean;
    portalInviteUnlocked?: boolean;
    receiptGenerated?: boolean;
  }) => {
    await invalidate();
    setActiveTab("history");
    setReceiptPaymentId(payment.id);
  };

  if (isLoading) {
    return <CustomerDetailSkeleton />;
  }

  if (error || !data) {
    return (
      <EmptyState
        title="مشتری یافت نشد"
        action={
          <Button variant="outline" asChild>
            <Link href="/crm">
              <ArrowRight className="h-4 w-4" />
              بازگشت
            </Link>
          </Button>
        }
      />
    );
  }

  const displayPhone = data.phone || data.whatsappRaw;
  const whatsappSource = resolveWhatsAppContactSource(data);
  const hasValidWhatsapp = Boolean(whatsappSource);

  const handleWhatsAppClick = () => {
    if (!openWhatsAppChat(data)) {
      toast.error("شماره تماس معتبر برای این مشتری موجود نیست.");
    }
  };

  const handleTabChange = (value: string) => {
    if (value === "portal" && !canInvite) {
      setActiveTab("details");
      return;
    }
    setActiveTab(value as CrmDetailTabValue);
  };

  return (
    <div
      dir="rtl"
      className="mx-auto max-w-7xl space-y-4 overflow-x-hidden pb-10"
    >
      {/* Compact profile header */}
      <CustomerProfileHeader
        compact
        personName={data.personName}
        companyName={data.companyName}
        jobTitle={data.jobTitle}
        displayPhone={displayPhone}
        email={data.email}
        city={data.city}
        source={data.source}
        salesOwnerName={data.salesOwner?.fullName ?? null}
        hasValidWhatsapp={hasValidWhatsapp}
        onWhatsAppClick={handleWhatsAppClick}
      />

      <CustomerSalesAssistantCard customerId={id} />

      {/* Tabs: remaining sections only */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full space-y-4"
        dir="rtl"
      >
        <div className="sticky top-0 z-20 -mx-1 bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <CustomerDetailTabsNav
            hasOpportunity={!!opp}
            showPortalTab={canInvite}
          />
        </div>

        {oppChoices.length > 1 && opp ? (
          <div
            role="radiogroup"
            aria-label="انتخاب پروژه یا قرارداد"
            className="flex flex-wrap items-center gap-2"
          >
            {oppChoices.map((choice) => {
              const active = choice.id === opp.id;
              const code =
                choice.contract?.code || choice.project?.code || null;
              const kindLabel = choice.contract
                ? "قرارداد"
                : choice.project
                  ? "پروژه"
                  : choice.projectId
                    ? "پروژه متصل"
                    : "فرصت فروش";
              return (
                <button
                  key={choice.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelectedOppId(choice.id)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                    active
                      ? "border-brand/40 bg-brand-muted text-brand"
                      : "border-border/80 bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {kindLabel}
                  {code ? (
                    <>
                      {" "}
                      <span dir="ltr" className="tabular-nums">
                        {code}
                      </span>
                    </>
                  ) : !choice.projectId ? (
                    <span className="text-[10px] font-medium opacity-80">
                      {" "}
                      (بدون پروژه)
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        <TabsContent
          value="details"
          className="mt-0 focus-visible:outline-none"
        >
          {opp ? (
            <CustomerDetailsForm
              opportunity={opp}
              paymentCount={cyclePayments.length}
              onSaved={invalidate}
              onPaymentCreated={handlePaymentCreated}
            />
          ) : (
            <EmptyOpportunityState />
          )}
        </TabsContent>

        <TabsContent
          value="history"
          className="mt-0 focus-visible:outline-none"
        >
          {opp ? (
            <PaymentHistoryPanel
              invoices={cycleInvoices}
              payments={cyclePayments}
              onChanged={invalidate}
              initialReceiptPaymentId={receiptPaymentId}
              onInitialReceiptHandled={clearReceiptHandoff}
            />
          ) : (
            <EmptyOpportunityState />
          )}
        </TabsContent>

        {canInvite ? (
          <TabsContent
            value="portal"
            className="mt-0 focus-visible:outline-none"
          >
            {opp ? (
              <PortalInviteSection
                opportunityId={opp.id}
                customerId={data.id}
                eligibility={eligibility}
                portalCredentials={
                  canSeePortalCredentials ? data.portalCredentials : null
                }
                inviteUrl={inviteUrl}
                onInviteUrlChange={setInviteUrl}
                onChanged={invalidate}
              />
            ) : (
              <EmptyOpportunityState />
            )}
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function EmptyOpportunityState() {
  return (
    <Card dir="rtl" className="border-border/50 shadow-sm">
      <CardContent className="py-14 text-center">
        <p className="text-sm font-semibold text-muted-foreground">
          هنوز فرصت فروشی برای این مشتری ثبت نشده است.
        </p>
      </CardContent>
    </Card>
  );
}
