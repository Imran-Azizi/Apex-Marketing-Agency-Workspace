"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Banknote,
  Building2,
  Check,
  CircleDollarSign,
  CreditCard,
  FileText,
  Hash,
  ScrollText,
  UserRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { apiPost, ApiError } from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CrmCurrencyField } from "@/app/(dashboard)/crm/_components/crm-ui";
import { crmSalesText } from "./copy";
import type { CrmCustomer } from "./types";

type InvoiceMethod = "HESAB_PAY" | "CASH" | "BANK_TRANSFER";
type FieldKey =
  | "videoCount"
  | "totalAmount"
  | "paidAmount"
  | "method"
  | "hesabPayAccount"
  | "officeAddress"
  | "responsiblePhone"
  | "bankCardNumber";

const METHOD_OPTIONS: Array<{
  value: InvoiceMethod;
  labelKey: "methodHesabPay" | "methodCash" | "methodBankTransfer";
  icon: typeof Wallet;
}> = [
  { value: "HESAB_PAY", labelKey: "methodHesabPay", icon: Wallet },
  { value: "CASH", labelKey: "methodCash", icon: Banknote },
  { value: "BANK_TRANSFER", labelKey: "methodBankTransfer", icon: CreditCard },
];

interface InvoiceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CrmCustomer | null;
}

function parseMoney(value: string): number {
  const n = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
}

class InvoiceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceValidationError";
  }
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-[11px] leading-relaxed text-destructive">
      {message}
    </p>
  );
}

function RequiredMark() {
  return (
    <span className="ms-0.5 text-destructive" aria-hidden>
      *
    </span>
  );
}

function SectionHeading({
  id,
  icon: Icon,
  title,
}: {
  id?: string;
  icon: typeof FileText;
  title: string;
}) {
  return (
    <div id={id} className="flex items-center gap-2 text-start">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground ring-1 ring-border/50">
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
    </div>
  );
}

function CustomerFact({
  icon: Icon,
  label,
  value,
  dir = "rtl",
  mono = false,
}: {
  icon: typeof Hash;
  label: string;
  value: string;
  dir?: "ltr" | "rtl";
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1 px-3 py-2.5 text-start sm:px-4 sm:py-3">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 shrink-0 text-muted-foreground/70" strokeWidth={2} />
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <p
        dir={dir}
        title={value}
        className={cn(
          "mt-1 truncate text-sm font-medium text-foreground/90",
          mono && "font-mono text-xs tabular-nums tracking-wide [unicode-bidi:isolate]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function InvoiceCreateDialog({
  open,
  onOpenChange,
  customer,
}: InvoiceCreateDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [videoCount, setVideoCount] = useState("1");
  const [totalAmount, setTotalAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("0");
  const [method, setMethod] = useState<InvoiceMethod | "">("");
  const [hesabPayAccount, setHesabPayAccount] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [responsiblePhone, setResponsiblePhone] = useState("");
  const [bankCardNumber, setBankCardNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});

  useEffect(() => {
    if (!open) return;
    setVideoCount("1");
    setTotalAmount("");
    setPaidAmount("0");
    setMethod("");
    setHesabPayAccount("");
    setOfficeAddress("");
    setResponsiblePhone("");
    setBankCardNumber("");
    setNotes("");
    setFieldError("");
    setErrors({});
  }, [open, customer?.id]);

  const remaining = useMemo(() => {
    const total = parseMoney(totalAmount);
    const paid = parseMoney(paidAmount || "0");
    if (!Number.isFinite(total) || total < 0) return 0;
    const safePaid = Number.isFinite(paid) && paid > 0 ? paid : 0;
    return Math.max(0, total - safePaid);
  }, [totalAmount, paidAmount]);

  const hasTotal = useMemo(() => {
    const total = parseMoney(totalAmount);
    return Number.isFinite(total) && total > 0;
  }, [totalAmount]);

  const clearField = (key: FieldKey) => {
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    if (fieldError) setFieldError("");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!customer) throw new Error(crmSalesText("invoiceCreateFailed"));
      const nextErrors: Partial<Record<FieldKey, string>> = {};
      const videos = Number(videoCount);
      if (!Number.isInteger(videos) || videos < 1) {
        nextErrors.videoCount = crmSalesText("invoiceVideoRequired");
      }
      const total = parseMoney(totalAmount);
      if (!(total > 0)) {
        nextErrors.totalAmount = crmSalesText("invoiceTotalRequired");
      }
      const paid = parseMoney(paidAmount || "0");
      const paidSafe = Number.isFinite(paid) && paid > 0 ? paid : 0;
      if (Number.isFinite(total) && total > 0 && paidSafe > total) {
        nextErrors.paidAmount = crmSalesText("invoicePaidExceedsTotal");
      }
      if (!method) {
        nextErrors.method = crmSalesText("invoiceMethodRequired");
      }

      const paymentMethodMeta: Record<string, string> = {};
      if (method === "HESAB_PAY") {
        if (!hesabPayAccount.trim()) nextErrors.hesabPayAccount = crmSalesText("invoiceHesabRequired");
        else paymentMethodMeta.hesabPayAccount = hesabPayAccount.trim();
      }
      if (method === "CASH") {
        if (!officeAddress.trim()) nextErrors.officeAddress = crmSalesText("invoiceAddressRequired");
        else paymentMethodMeta.officeAddress = officeAddress.trim();
        if (!responsiblePhone.trim()) nextErrors.responsiblePhone = crmSalesText("invoicePhoneRequired");
        else paymentMethodMeta.responsiblePhone = responsiblePhone.trim();
      }
      if (method === "BANK_TRANSFER") {
        if (!bankCardNumber.trim()) nextErrors.bankCardNumber = crmSalesText("invoiceCardRequired");
        else paymentMethodMeta.bankCardNumber = bankCardNumber.trim();
      }

      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        const first = Object.values(nextErrors)[0];
        throw new InvoiceValidationError(first || crmSalesText("invoiceCreateFailed"));
      }

      return apiPost<{
        id: string;
        invoiceNumber?: string;
        customerConverted?: boolean;
        customerId?: string;
        paymentId?: string | null;
      }>(
        `/crm/customers/${customer.id}/invoices`,
        {
          videoCount: videos,
          totalAmount: total,
          paidAmount: paidSafe,
          paymentMethod: method,
          paymentMethodMeta,
          notes: notes.trim() || undefined,
        },
      );
    },
    onSuccess: async (invoice) => {
      toast.success(crmSalesText("invoiceCreated"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crm-customers"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-customer", customer?.id] }),
      ]);
      onOpenChange(false);

      const customerId = invoice?.customerId || customer?.id;
      if (!customerId) return;

      const params = new URLSearchParams();
      params.set("tab", "history");
      if (invoice?.paymentId) {
        params.set("receipt", invoice.paymentId);
      }
      router.push(`/crm/${customerId}?${params.toString()}`);
    },
    onError: (err) => {
      if (err instanceof InvoiceValidationError) return;
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : crmSalesText("invoiceCreateFailed");
      setFieldError(message);
      toast.error(message || crmSalesText("invoiceCreateFailed"));
    },
  });

  const pending = mutation.isPending;
  const canSubmit = Boolean(customer) && !pending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent
        dir="rtl"
        overlayClassName="bg-black/50 backdrop-blur-[2px]"
        closeClassName="end-4 top-4 h-9 w-9 rounded-xl hover:bg-muted/80 focus:ring-brand/30"
        className="flex max-h-[min(92dvh,44rem)] w-[calc(100%-1.5rem)] max-w-xl flex-col gap-0 overflow-hidden border-border/60 p-0 shadow-2xl sm:rounded-2xl"
        onPointerDownOutside={(event) => {
          if (pending) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        {/* Fixed header */}
        <DialogHeader className="shrink-0 border-b border-border/50 bg-card px-5 pb-4 pe-14 pt-5 text-start sm:px-6">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-sm">
              <FileText className="h-[18px] w-[18px]" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="text-base font-bold tracking-tight sm:text-lg">
                {crmSalesText("invoiceTitle")}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            setFieldError("");
            mutation.mutate();
          }}
        >
          {/* Scrollable body */}
          <div
            className={cn(
              "min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6",
              "[scrollbar-width:thin] [scrollbar-color:hsl(var(--border))_transparent]",
              "[&::-webkit-scrollbar]:w-1.5",
              "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/80",
              "[&::-webkit-scrollbar-track]:bg-transparent",
            )}
          >
            {/* Customer — light, compact */}
            <section aria-labelledby="invoice-customer-heading" className="space-y-2.5">
              <SectionHeading
                id="invoice-customer-heading"
                icon={UserRound}
                title={crmSalesText("invoiceCustomerSection")}
              />
              <div className="flex flex-col divide-y divide-border/50 overflow-hidden rounded-xl border border-border/40 bg-muted/20 sm:flex-row sm:divide-x sm:divide-y-0 sm:divide-x-reverse">
                <CustomerFact
                  icon={Hash}
                  label={crmSalesText("invoiceCustomerId")}
                  value={customer?.customerCode || "—"}
                  dir="ltr"
                  mono
                />
                <CustomerFact
                  icon={UserRound}
                  label={crmSalesText("invoiceCustomerName")}
                  value={customer?.personName || "—"}
                />
                <CustomerFact
                  icon={Building2}
                  label={crmSalesText("invoiceCompanyName")}
                  value={customer?.companyName || "—"}
                />
              </div>
            </section>

            {/* Financial — primary focus */}
            <section aria-labelledby="invoice-finance-heading" className="space-y-3">
              <SectionHeading
                id="invoice-finance-heading"
                icon={CircleDollarSign}
                title={crmSalesText("invoiceFinanceSection")}
              />

              {/* Remaining — featured */}
              <div
                aria-live="polite"
                className={cn(
                  "relative overflow-hidden rounded-xl border px-4 py-3.5 sm:px-5 sm:py-4",
                  remaining > 0
                    ? "border-amber-500/30 bg-gradient-to-l from-amber-500/[0.08] via-card to-card dark:from-amber-500/10"
                    : hasTotal
                      ? "border-emerald-500/25 bg-gradient-to-l from-emerald-500/[0.06] via-card to-card dark:from-emerald-500/10"
                      : "border-border/50 bg-muted/15",
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 text-start">
                    <p className="text-xs font-medium text-muted-foreground">
                      {crmSalesText("invoiceRemaining")}
                    </p>
                  </div>
                  <p
                    dir="ltr"
                    aria-readonly="true"
                    className={cn(
                      "shrink-0 text-right text-2xl font-black tabular-nums tracking-tight [unicode-bidi:isolate] sm:text-[1.65rem]",
                      remaining > 0
                        ? "text-amber-700 dark:text-amber-400"
                        : hasTotal
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-foreground",
                    )}
                  >
                    {formatCurrency(remaining)}
                  </p>
                </div>
              </div>

              {/* Inputs row */}
              <div className="grid gap-3 sm:grid-cols-[5.5rem_1fr_1fr]">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="invoice-video-count"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {crmSalesText("invoiceVideoCount")}
                    <RequiredMark />
                  </Label>
                  <Input
                    id="invoice-video-count"
                    dir="ltr"
                    inputMode="numeric"
                    disabled={pending}
                    aria-invalid={Boolean(errors.videoCount)}
                    aria-describedby={errors.videoCount ? "invoice-video-error" : undefined}
                    className={cn(
                      "h-10 rounded-lg text-center text-base font-semibold tabular-nums shadow-sm",
                      errors.videoCount && "border-destructive focus-visible:ring-destructive",
                    )}
                    value={videoCount}
                    onChange={(e) => {
                      setVideoCount(e.target.value);
                      clearField("videoCount");
                    }}
                    required
                  />
                  <FieldError id="invoice-video-error" message={errors.videoCount} />
                </div>

                <div className="space-y-1.5">
                  <CrmCurrencyField
                    id="invoice-total"
                    label={`${crmSalesText("invoiceTotalAmount")} *`}
                    value={totalAmount}
                    disabled={pending}
                    invalid={Boolean(errors.totalAmount)}
                    onChange={(value) => {
                      setTotalAmount(value);
                      clearField("totalAmount");
                      clearField("paidAmount");
                    }}
                  />
                  <FieldError message={errors.totalAmount} />
                </div>

                <div className="space-y-1.5">
                  <CrmCurrencyField
                    id="invoice-paid"
                    label={crmSalesText("invoicePaidAmount")}
                    value={paidAmount}
                    disabled={pending}
                    invalid={Boolean(errors.paidAmount)}
                    onChange={(value) => {
                      setPaidAmount(value);
                      clearField("paidAmount");
                    }}
                  />
                  <FieldError message={errors.paidAmount} />
                </div>
              </div>
            </section>

            {/* Payment — secondary to finance */}
            <section aria-labelledby="invoice-payment-heading" className="space-y-3">
              <SectionHeading
                id="invoice-payment-heading"
                icon={Wallet}
                title={crmSalesText("invoicePaymentSection")}
              />

              <fieldset disabled={pending} className="space-y-3">
                <legend className="sr-only">{crmSalesText("invoicePaymentMethod")}</legend>
                <p className="text-xs text-muted-foreground">
                  {crmSalesText("invoicePaymentMethod")}
                  <RequiredMark />
                </p>

                <div
                  role="radiogroup"
                  aria-label={crmSalesText("invoicePaymentMethod")}
                  aria-invalid={Boolean(errors.method)}
                  aria-describedby={errors.method ? "invoice-method-error" : undefined}
                  className="grid gap-2 sm:grid-cols-3"
                >
                  {METHOD_OPTIONS.map((option) => {
                    const selected = method === option.value;
                    const Icon = option.icon;
                    return (
                      <label
                        key={option.value}
                        className={cn(
                          "group relative flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition-all duration-150",
                          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/35 has-[:focus-visible]:ring-offset-1 has-[:focus-visible]:ring-offset-background",
                          selected
                            ? "border-brand/50 bg-brand/[0.06] shadow-sm"
                            : "border-border/50 bg-card hover:border-border hover:bg-muted/30",
                          pending && "pointer-events-none opacity-60",
                          errors.method && !selected && "border-destructive/35",
                        )}
                      >
                        <input
                          type="radio"
                          name="invoice-payment-method"
                          value={option.value}
                          checked={selected}
                          disabled={pending}
                          onChange={() => {
                            setMethod(option.value);
                            clearField("method");
                            setFieldError("");
                          }}
                          className="sr-only"
                        />
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                            selected
                              ? "bg-brand/15 text-brand"
                              : "bg-muted/60 text-muted-foreground group-hover:bg-muted",
                          )}
                        >
                          <Icon className="h-4 w-4" strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold leading-tight">
                              {crmSalesText(option.labelKey)}
                            </span>
                            {selected ? (
                              <Check className="h-3.5 w-3.5 shrink-0 text-brand" strokeWidth={2.5} />
                            ) : null}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <FieldError id="invoice-method-error" message={errors.method} />

                {method ? (
                  <div className="space-y-3 rounded-xl border border-border/40 bg-muted/15 p-3.5 sm:p-4">
                    <p className="text-xs font-semibold text-foreground">
                      {crmSalesText("invoicePaymentDetails")}
                    </p>
                    {method === "HESAB_PAY" ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="invoice-hesab" className="text-xs font-medium">
                          {crmSalesText("invoiceHesabPayAccount")}
                          <RequiredMark />
                        </Label>
                        <Input
                          id="invoice-hesab"
                          dir="ltr"
                          disabled={pending}
                          aria-invalid={Boolean(errors.hesabPayAccount)}
                          className={cn(
                            "h-10 rounded-lg text-right shadow-sm",
                            errors.hesabPayAccount && "border-destructive",
                          )}
                          value={hesabPayAccount}
                          onChange={(e) => {
                            setHesabPayAccount(e.target.value);
                            clearField("hesabPayAccount");
                          }}
                        />
                        <FieldError message={errors.hesabPayAccount} />
                      </div>
                    ) : null}
                    {method === "CASH" ? (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="invoice-office" className="text-xs font-medium">
                            {crmSalesText("invoiceOfficeAddress")}
                            <RequiredMark />
                          </Label>
                          <Textarea
                            id="invoice-office"
                            disabled={pending}
                            aria-invalid={Boolean(errors.officeAddress)}
                            className={cn(
                              "min-h-[4rem] resize-none rounded-lg shadow-sm",
                              errors.officeAddress && "border-destructive",
                            )}
                            value={officeAddress}
                            onChange={(e) => {
                              setOfficeAddress(e.target.value);
                              clearField("officeAddress");
                            }}
                            rows={2}
                          />
                          <FieldError message={errors.officeAddress} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="invoice-rep-phone" className="text-xs font-medium">
                            {crmSalesText("invoiceResponsiblePhone")}
                            <RequiredMark />
                          </Label>
                          <Input
                            id="invoice-rep-phone"
                            dir="ltr"
                            disabled={pending}
                            aria-invalid={Boolean(errors.responsiblePhone)}
                            className={cn(
                              "h-10 rounded-lg text-right shadow-sm",
                              errors.responsiblePhone && "border-destructive",
                            )}
                            value={responsiblePhone}
                            onChange={(e) => {
                              setResponsiblePhone(e.target.value);
                              clearField("responsiblePhone");
                            }}
                          />
                          <FieldError message={errors.responsiblePhone} />
                        </div>
                      </div>
                    ) : null}
                    {method === "BANK_TRANSFER" ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="invoice-card" className="text-xs font-medium">
                          {crmSalesText("invoiceBankCard")}
                          <RequiredMark />
                        </Label>
                        <Input
                          id="invoice-card"
                          dir="ltr"
                          disabled={pending}
                          aria-invalid={Boolean(errors.bankCardNumber)}
                          className={cn(
                            "h-10 rounded-lg text-right shadow-sm",
                            errors.bankCardNumber && "border-destructive",
                          )}
                          value={bankCardNumber}
                          onChange={(e) => {
                            setBankCardNumber(e.target.value);
                            clearField("bankCardNumber");
                          }}
                        />
                        <FieldError message={errors.bankCardNumber} />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </fieldset>
            </section>

            {/* Notes */}
            <section aria-labelledby="invoice-notes-heading" className="space-y-2.5">
              <SectionHeading
                id="invoice-notes-heading"
                icon={ScrollText}
                title={crmSalesText("invoiceNotesSection")}
              />
              <div className="space-y-1.5">
                <Label htmlFor="invoice-notes" className="sr-only">
                  {crmSalesText("invoiceNotes")}
                </Label>
                <Textarea
                  id="invoice-notes"
                  disabled={pending}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={crmSalesText("invoiceNotesHint")}
                  className="min-h-[4.5rem] resize-none rounded-xl border-border/50 shadow-sm"
                  rows={2}
                />
              </div>
            </section>

            {fieldError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{fieldError}</p>
              </div>
            ) : null}
          </div>

          {/* Sticky footer */}
          <DialogFooter className="shrink-0 gap-2 border-t border-border/50 bg-card/95 px-5 py-3.5 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:space-x-0 sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="h-10 min-w-[5.5rem] rounded-lg border-border/60 font-medium"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              {crmSalesText("cancel")}
            </Button>
            <Button
              type="submit"
              variant="brand"
              className="h-10 min-w-[8.5rem] rounded-lg font-bold shadow-sm"
              disabled={!canSubmit}
              isLoading={pending}
              loadingText={crmSalesText("invoiceCreating")}
            >
              <FileText className="h-4 w-4" />
              {crmSalesText("invoiceSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
