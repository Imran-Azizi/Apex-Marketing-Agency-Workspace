"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  BadgeCheck,
  CircleDollarSign,
  FileText,
  Lock,
  Save,
  ScrollText,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { apiPatch } from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CrmCurrencyField } from "./crm-ui";
import {
  NewPaymentDialog,
  type OpportunityFinance,
  type RecordedPayment,
} from "./new-payment-dialog";

export type { OpportunityFinance };

export type OpportunityDetails = {
  id: string;
  agreedPrice: string | null;
  advancePayment?: string | null;
  agreedTerms: string | null;
  contractLocked?: boolean | null;
  contractLockedAt?: string | null;
  finance?: OpportunityFinance | null;
};

type FormState = {
  agreedPrice: string;
  agreedTerms: string;
};

function toFormState(opp: OpportunityDetails): FormState {
  return {
    agreedPrice: opp.agreedPrice ? String(Number(opp.agreedPrice)) : "",
    agreedTerms: opp.agreedTerms || "",
  };
}

function parseMoney(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isValidMoneyInput(value: string): boolean {
  if (!value.trim()) return true;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

function resolveFinance(
  opportunity: OpportunityDetails,
  draftAgreedPrice: string,
  locked: boolean,
): OpportunityFinance {
  const totalPaid = opportunity.finance
    ? Math.max(0, Number(opportunity.finance.totalPaid) || 0)
    : Math.max(
        0,
        opportunity.advancePayment ? Number(opportunity.advancePayment) : 0,
      );

  const projectTotal = locked
    ? Math.max(
        0,
        Number(opportunity.finance?.projectTotal ?? opportunity.agreedPrice) || 0,
      )
    : draftAgreedPrice.trim() !== ""
      ? Math.max(0, parseMoney(draftAgreedPrice))
      : Math.max(
          0,
          Number(opportunity.finance?.projectTotal ?? opportunity.agreedPrice) ||
            0,
        );

  const remainingBalance = Math.max(0, projectTotal - totalPaid);
  const pendingApprovalTotal = Math.max(
    0,
    Number(opportunity.finance?.pendingApprovalTotal) || 0,
  );
  const reservedPaid = Math.max(
    0,
    Number(opportunity.finance?.reservedPaid) || totalPaid + pendingApprovalTotal,
  );
  const availableToRecord = Math.max(
    0,
    opportunity.finance?.availableToRecord != null
      ? Number(opportunity.finance.availableToRecord)
      : projectTotal - reservedPaid,
  );

  return {
    projectTotal,
    totalPaid,
    remainingBalance,
    customerDebt: remainingBalance,
    reservedPaid,
    pendingApprovalTotal,
    availableToRecord,
  };
}

function FinanceMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  featured = false,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof CircleDollarSign;
  tone?: "default" | "brand" | "warning" | "success";
  featured?: boolean;
}) {
  return (
    <div
      dir="rtl"
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card p-4 transition-all duration-300",
        "hover:-translate-y-0.5 hover:shadow-md dark:hover:shadow-black/40",
        featured && "sm:col-span-1 lg:scale-[1.01]",
        tone === "default" && "border-border/90",
        tone === "brand" &&
          "border-brand/25 bg-gradient-to-bl from-brand-muted/80 to-card",
        tone === "warning" &&
          "border-amber-500/40 bg-gradient-to-bl from-amber-500/10 to-card ring-1 ring-amber-500/20 dark:from-amber-500/15",
        tone === "success" &&
          "border-emerald-500/30 bg-gradient-to-bl from-emerald-500/10 to-card dark:from-emerald-500/15",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-start">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            dir="ltr"
            className={cn(
              "mt-2 text-right text-[22px] font-black tabular-nums tracking-tight text-foreground [unicode-bidi:isolate]",
              tone === "brand" && "text-brand",
              tone === "warning" &&
                "text-amber-700 dark:text-amber-400",
              tone === "success" &&
                "text-emerald-700 dark:text-emerald-400",
            )}
          >
            {value}
          </p>
        </div>
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
            tone === "brand" && "bg-brand/10 text-brand",
            tone === "warning" &&
              "bg-amber-500/10 text-amber-700 dark:text-amber-400",
            tone === "success" &&
              "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
            tone === "default" && "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-[18px]" strokeWidth={1.75} />
        </span>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground text-start">
        {hint}
      </p>
      {featured && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-l from-amber-500 via-amber-400 to-transparent" />
      )}
    </div>
  );
}

interface CustomerDetailsFormProps {
  opportunity: OpportunityDetails;
  paymentCount?: number;
  onSaved: () => void | Promise<void>;
  onPaymentCreated?: (payment: RecordedPayment) => void | Promise<void>;
}

export function CustomerDetailsForm({
  opportunity,
  paymentCount = 0,
  onSaved,
  onPaymentCreated,
}: CustomerDetailsFormProps) {
  const locked = !!opportunity.contractLocked;
  const baseline = useMemo(() => toFormState(opportunity), [opportunity]);
  const [form, setForm] = useState<FormState>(baseline);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    agreedPrice?: string;
    agreedTerms?: string;
  }>({});

  useEffect(() => {
    setForm(toFormState(opportunity));
    setFieldErrors({});
  }, [opportunity]);

  const finance = useMemo(
    () => resolveFinance(opportunity, form.agreedPrice, locked),
    [opportunity, form.agreedPrice, locked],
  );

  const canSave =
    !locked &&
    form.agreedPrice.trim() !== "" &&
    parseMoney(form.agreedPrice) > 0 &&
    form.agreedTerms.trim() !== "";

  const saveMut = useMutation({
    mutationFn: () =>
      apiPatch(`/crm/opportunities/${opportunity.id}/details`, {
        agreedPrice: Number(form.agreedPrice),
        agreedTerms: form.agreedTerms.trim(),
      }),
    onSuccess: async () => {
      toast.success("قرارداد ذخیره و قفل شد");
      await onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا"),
  });

  const handleSave = () => {
    const errors: { agreedPrice?: string; agreedTerms?: string } = {};
    if (!form.agreedPrice.trim() || !isValidMoneyInput(form.agreedPrice) || parseMoney(form.agreedPrice) <= 0) {
      errors.agreedPrice = "قیمت مجموعی پروژه الزامی و باید بیشتر از صفر باشد.";
    }
    if (!form.agreedTerms.trim()) {
      errors.agreedTerms = "شرایط توافق‌شده الزامی است.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      toast.error("لطفاً فیلدهای الزامی را تکمیل کنید.");
      return;
    }
    saveMut.mutate();
  };

  const openPaymentModal = () => {
    setPaymentOpen(true);
  };

  return (
    <section
      dir="rtl"
      className={cn(
        "overflow-hidden rounded-[24px] border border-border/80 bg-card",
        "shadow-sm dark:shadow-black/30",
      )}
    >
      {/* Premium header */}
      <header className="relative border-b border-border/60 bg-gradient-to-l from-brand-muted/90 via-card to-card px-5 py-5 sm:px-7 sm:py-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-brand/40 to-transparent" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3.5 text-start">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-lg shadow-brand/25">
              <ScrollText className="size-5" strokeWidth={1.7} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-foreground sm:text-xl">
                  جزئیات قرارداد
                </h2>
                {locked ? (
                  <Badge className="rounded-full border-brand/25 bg-brand-muted text-brand hover:bg-brand-muted">
                    <Lock className="size-3" />
                    قفل‌شده
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="rounded-full font-medium"
                  >
                    پیش‌نویس
                  </Badge>
                )}
              </div>
              <p className="mt-1.5 hidden max-w-xl text-[13px] leading-relaxed text-muted-foreground sm:block">
                قیمت پروژه و شرایط تجاری را مدیریت کنید
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="brand"
            onClick={openPaymentModal}
            disabled={!locked}
            title={
              locked
                ? "ثبت پرداخت جدید"
                : "ابتدا قرارداد را ذخیره کنید"
            }
            className="w-full rounded-xl shadow-md shadow-brand/20 transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 sm:w-auto"
          >
            <Wallet className="h-4 w-4" />
            پرداخت جدید
          </Button>
        </div>
      </header>

      <div className="space-y-6 p-5 sm:p-7">
        {/* Financial summary */}
        <section className="space-y-3.5">
          <div className="flex items-center gap-2.5 text-start">
            <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
              <CircleDollarSign className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                خلاصه پرداخت قرارداد
              </h3>
              <p className="text-[11px] text-muted-foreground">
                قیمت مجموعی − مجموع پرداخت‌ها = باقی‌مانده
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {locked ? (
              <FinanceMetricCard
                label="قیمت مجموعی پروژه"
                value={formatCurrency(finance.projectTotal)}
                hint="مبلغ کل قرارداد — پس از ذخیره قابل تغییر نیست"
                icon={BadgeCheck}
                tone="default"
              />
            ) : (
              <div className="rounded-2xl border border-border/90 bg-card p-4 transition-shadow hover:shadow-md dark:hover:shadow-black/40">
                <CrmCurrencyField
                  id="agreed-price"
                  label="قیمت مجموعی پروژه *"
                  value={form.agreedPrice}
                  onChange={(v) => {
                    setForm((prev) => ({ ...prev, agreedPrice: v }));
                    if (fieldErrors.agreedPrice) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        agreedPrice: undefined,
                      }));
                    }
                  }}
                  hint="مبلغ کل قرارداد / پروژه"
                />
                {fieldErrors.agreedPrice && (
                  <p className="mt-1.5 text-xs text-destructive text-start">
                    {fieldErrors.agreedPrice}
                  </p>
                )}
              </div>
            )}

            <FinanceMetricCard
              label="مجموع پرداخت‌شده"
              value={formatCurrency(finance.totalPaid)}
              hint="جمع خودکار پرداخت‌های فعال"
              icon={Wallet}
              tone="brand"
            />

            <FinanceMetricCard
              label="باقی‌مانده پرداخت"
              value={formatCurrency(finance.remainingBalance)}
              hint="بدهی مشتری نسبت به قرارداد"
              icon={ShieldCheck}
              tone={finance.remainingBalance > 0 ? "warning" : "success"}
              featured
            />
          </div>
        </section>

        {/* Contract terms */}
        <section className="space-y-3">
          <Label
            htmlFor="agreed-terms"
            className="flex items-center gap-1.5 text-sm font-bold text-foreground"
          >
            <FileText className="h-4 w-4 text-brand" />
            شرایط توافق‌شده{!locked && " *"}
          </Label>

          {locked ? (
            <div className="overflow-hidden rounded-2xl border border-border/90 bg-muted/40">
              <div className="flex items-start gap-2.5 border-b border-border/80 bg-brand-muted/50 px-4 py-3 text-start">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-brand shadow-sm ring-1 ring-brand/15">
                  <Lock className="size-3.5" />
                </span>
                <p className="text-[12.5px] leading-6 text-muted-foreground">
                  این شرایط ذخیره شده و دیگر قابل ویرایش نمی‌باشد.
                </p>
              </div>
              <div className="whitespace-pre-wrap px-4 py-4 text-[13.5px] leading-7 text-foreground text-start">
                {form.agreedTerms || "—"}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea
                id="agreed-terms"
                rows={6}
                dir="rtl"
                className={cn(
                  "min-h-[150px] resize-y rounded-2xl border-input bg-background px-4 py-3 text-[13.5px] leading-7 shadow-sm",
                  "transition-all focus-visible:border-brand/40 focus-visible:ring-brand/20",
                )}
                placeholder="شرایط پرداخت، زمان‌بندی تحویل، تعهدات طرفین و سایر توافق‌های تجاری را وارد کنید..."
                value={form.agreedTerms}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, agreedTerms: e.target.value }));
                  if (fieldErrors.agreedTerms) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      agreedTerms: undefined,
                    }));
                  }
                }}
              />
              {fieldErrors.agreedTerms && (
                <p className="text-xs text-destructive text-start">
                  {fieldErrors.agreedTerms}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Centered save — only while unlocked */}
        {!locked && (
          <div className="flex flex-col items-center gap-2 pt-1 pb-1">
            <Button
              type="button"
              variant="brand"
              onClick={handleSave}
              disabled={!canSave}
              isLoading={saveMut.isPending}
              loadingText="در حال ذخیره..."
              className={cn(
                "min-w-[180px] rounded-xl px-8 py-5 text-[15px] font-bold shadow-lg shadow-brand/25",
                "transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0",
              )}
            >
              <Save className="h-4 w-4" />
              ذخیره
            </Button>
            <p className="text-[11px] text-muted-foreground">
              پس از ذخیره، قیمت و شرایط قرارداد قفل می‌شوند
            </p>
          </div>
        )}

        {locked && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-brand/20 bg-brand-muted/40 px-4 py-3 text-[12px] text-brand">
            <Lock className="size-3.5 shrink-0" />
            قرارداد نهایی شده است — فقط ثبت پرداخت امکان‌پذیر است
          </div>
        )}
      </div>

      <NewPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        opportunityId={opportunity.id}
        finance={finance}
        contractLocked={locked}
        paymentCount={paymentCount}
        onCreated={async (payment) => {
          if (onPaymentCreated) {
            await onPaymentCreated(payment);
          } else {
            await onSaved();
          }
        }}
      />
    </section>
  );
}
