"use client";

import { use, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { buildWhatsAppChatUrl, toWhatsAppDigits } from "@/lib/utils";
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
import {
  CustomerDetailTabsNav,
  type CrmDetailTabValue,
} from "../_components/customer-detail-tabs";

interface Opportunity {
  id: string;
  title: string;
  proposedPrice: string | null;
  agreedPrice: string | null;
  advancePayment?: string | null;
  agreedTerms: string | null;
  projectId: string | null;
  contractLocked?: boolean | null;
  contractLockedAt?: string | null;
  finance?: {
    projectTotal: number;
    totalPaid: number;
    remainingBalance: number;
    customerDebt: number;
  } | null;
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
    createdAt: string;
    paidAt?: string;
    reference?: string | null;
    method?: string | null;
    methodLabel?: string | null;
    recordedBy?: { id: string; fullName: string } | null;
    invoice?: { id: string; invoiceNumber: string } | null;
  }>;
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
  const qc = useQueryClient();
  const [inviteUrl, setInviteUrl] = useState("");
  const [activeTab, setActiveTab] = useState<CrmDetailTabValue>("details");
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["crm-customer", id],
    queryFn: () => apiGet<CrmCustomerDetail>(`/crm/customers/${id}`),
  });

  const opp = useMemo(() => {
    if (!data?.opportunities?.length) return null;
    return (
      data.opportunities.find((o) => !o.projectId) || data.opportunities[0]
    );
  }, [data]);

  const { data: eligibility } = useQuery({
    queryKey: ["invite-eligibility", opp?.id],
    queryFn: () =>
      apiGet<InviteEligibility>(
        `/crm/opportunities/${opp!.id}/invite-eligibility`,
      ),
    enabled: !!opp?.id,
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["crm-customer", id] });
    await qc.refetchQueries({ queryKey: ["crm-customer", id] });
    if (opp?.id) {
      await qc.invalidateQueries({ queryKey: ["invite-eligibility", opp.id] });
    }
    // Keep project / portal panels in sync with payment changes.
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["projects"] }),
      qc.invalidateQueries({ queryKey: ["project"] }),
      qc.invalidateQueries({ queryKey: ["portal-dashboard"] }),
      qc.invalidateQueries({ queryKey: ["portal-projects"] }),
      qc.invalidateQueries({ queryKey: ["portal-project"] }),
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] }),
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

  const clearReceiptHandoff = useCallback(() => {
    setReceiptPaymentId(null);
  }, []);

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
  const whatsappSource = data.whatsappRaw || data.phone;
  const whatsappDigits = toWhatsAppDigits(whatsappSource);
  const whatsappUrl = buildWhatsAppChatUrl(whatsappSource);
  const hasValidWhatsapp = Boolean(whatsappUrl && whatsappDigits);

  const openWhatsAppChat = () => {
    if (!whatsappUrl) {
      toast.error("شماره تماس معتبر برای این مشتری موجود نیست.");
      return;
    }
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const handleTabChange = (value: string) => {
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
        onWhatsAppClick={openWhatsAppChat}
      />

      {/* Tabs: remaining sections only */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full space-y-4"
        dir="rtl"
      >
        <div className="sticky top-0 z-20 -mx-1 bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <CustomerDetailTabsNav hasOpportunity={!!opp} />
        </div>

        <TabsContent
          value="details"
          className="mt-0 focus-visible:outline-none"
        >
          {opp ? (
            <CustomerDetailsForm
              opportunity={opp}
              paymentCount={data.payments?.length ?? 0}
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
              invoices={data.invoices}
              payments={data.payments}
              onChanged={invalidate}
              initialReceiptPaymentId={receiptPaymentId}
              onInitialReceiptHandled={clearReceiptHandoff}
            />
          ) : (
            <EmptyOpportunityState />
          )}
        </TabsContent>

        <TabsContent
          value="portal"
          className="mt-0 focus-visible:outline-none"
        >
          {opp ? (
            <PortalInviteSection
              opportunityId={opp.id}
              eligibility={eligibility}
              inviteUrl={inviteUrl}
              onInviteUrlChange={setInviteUrl}
              onChanged={invalidate}
            />
          ) : (
            <EmptyOpportunityState />
          )}
        </TabsContent>
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
