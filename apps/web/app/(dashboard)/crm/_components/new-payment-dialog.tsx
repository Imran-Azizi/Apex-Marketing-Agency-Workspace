"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Wallet } from "lucide-react";
import { apiPost } from "@/lib/api";
import { invalidateFinanceQueries } from "@/lib/finance-queries";
import { useHasPermission } from "@/lib/permissions";
import {
  CUSTOMER_PAYMENT_METHODS,
  type CustomerPaymentMethod,
} from "@/lib/payment-methods";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
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
import { CrmCurrencyField } from "./crm-ui";

export type OpportunityFinance = {
  projectTotal: number;
  totalPaid: number;
  remainingBalance: number;
  customerDebt: number;
  reservedPaid?: number;
  pendingApprovalTotal?: number;
  availableToRecord?: number;
};

export type RecordedPayment = {
  id: string;
  isFirstPayment?: boolean;
  customerConverted?: boolean;
  portalInviteUnlocked?: boolean;
  receiptGenerated?: boolean;
  paymentNumber?: string;
  awaitingApproval?: boolean;
  approvalStatus?: string;
  method?: CustomerPaymentMethod;
  methodLabel?: string;
  finance?: OpportunityFinance;
};

export function emptyPaymentFinance(): OpportunityFinance {
  return {
    projectTotal: 0,
    totalPaid: 0,
    remainingBalance: 0,
    customerDebt: 0,
    reservedPaid: 0,
    pendingApprovalTotal: 0,
    availableToRecord: 0,
  };
}

interface NewPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string | null | undefined;
  finance: OpportunityFinance;
  contractLocked: boolean;
  paymentCount?: number;
  onCreated?: (payment: RecordedPayment) => void | Promise<void>;
}

export function NewPaymentDialog({
  open,
  onOpenChange,
  opportunityId,
  finance,
  contractLocked,
  paymentCount = 0,
  onCreated,
}: NewPaymentDialogProps) {
  const queryClient = useQueryClient();
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<CustomerPaymentMethod | null>(null);
  const [hesabPayAccount, setHesabPayAccount] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [responsiblePhone, setResponsiblePhone] = useState("");
  const [bankCardNumber, setBankCardNumber] = useState("");
  const [bankInfo, setBankInfo] = useState("");
  const [paymentMethodError, setPaymentMethodError] = useState("");
  const [paymentMetaError, setPaymentMetaError] = useState("");
  const [paymentError, setPaymentError] = useState("");

  const resetForm = () => {
    setPaymentAmount("");
    setPaymentMethod(null);
    setHesabPayAccount("");
    setOfficeAddress("");
    setResponsiblePhone("");
    setBankCardNumber("");
    setBankInfo("");
    setPaymentMethodError("");
    setPaymentMetaError("");
    setPaymentError("");
  };

  const paymentMut = useMutation({
    mutationFn: () =>
      apiPost<RecordedPayment>(`/crm/payments`, {
        opportunityId,
        amount: Number(paymentAmount),
        method: paymentMethod,
        paymentMethodMeta: {
          hesabPayAccount: hesabPayAccount.trim() || undefined,
          officeAddress: officeAddress.trim() || undefined,
          responsiblePhone: responsiblePhone.trim() || undefined,
          bankCardNumber: bankCardNumber.trim() || undefined,
          bankInfo: bankInfo.trim() || undefined,
        },
      }),
    onSuccess: async (res) => {
      const unlocked =
        res?.portalInviteUnlocked === true ||
        res?.isFirstPayment === true ||
        paymentCount === 0;
      if (res?.awaitingApproval) {
        toast.success("پرداخت ثبت شد — در انتظار تایید مدیر");
      } else if (unlocked) {
        toast.success("پرداخت ثبت شد — دعوت پورتال و رسید پرداخت آماده شد");
      } else {
        toast.success("پرداخت ثبت شد و رسید پرداخت ساخته شد");
      }
      resetForm();
      onOpenChange(false);
      await Promise.all([
        invalidateFinanceQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ["project"] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-customer"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-customers"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["portal-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["portal-projects"] }),
        queryClient.invalidateQueries({ queryKey: ["portal-project"] }),
      ]);
      if (onCreated) await onCreated(res);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا"),
  });

  const submitPayment = () => {
    if (!opportunityId) {
      setPaymentError("قرارداد این پروژه یافت نشد.");
      return;
    }
    if (!paymentMethod) {
      setPaymentMethodError("لطفاً روش پرداخت را انتخاب کنید.");
      return;
    }
    setPaymentMethodError("");
    setPaymentMetaError("");

    if (paymentMethod === "HESAB_PAY" && !hesabPayAccount.trim()) {
      setPaymentMetaError("شماره حساب پی الزامی است.");
      return;
    }
    if (paymentMethod === "CASH") {
      if (!officeAddress.trim()) {
        setPaymentMetaError("آدرس دفتر الزامی است.");
        return;
      }
      if (!responsiblePhone.trim()) {
        setPaymentMetaError("شماره تماس مسئول دفتر الزامی است.");
        return;
      }
    }
    if (paymentMethod === "BANK_TRANSFER" && !bankCardNumber.trim()) {
      setPaymentMetaError("شماره کارت بانکی الزامی است.");
      return;
    }
    const amt = Number(paymentAmount);
    if (!paymentAmount.trim() || Number.isNaN(amt) || amt <= 0) {
      setPaymentError("لطفاً یک مبلغ معتبر و مثبت وارد کنید.");
      return;
    }
    if (finance.projectTotal <= 0 || !contractLocked) {
      setPaymentError("ابتدا قیمت و شرایط قرارداد را ذخیره کنید.");
      return;
    }
    if (amt > (finance.availableToRecord ?? finance.remainingBalance) + 0.009) {
      setPaymentError(
        "مبلغ پرداخت نمی‌تواند بیشتر از باقی‌مانده پرداخت باشد.",
      );
      return;
    }
    setPaymentError("");
    paymentMut.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (paymentMut.isPending) return;
        onOpenChange(next);
        if (!next) resetForm();
      }}
    >
      <DialogContent dir="rtl" className="gap-5 rounded-2xl sm:max-w-md">
        <DialogHeader className="text-start">
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <CreditCard className="h-5 w-5" />
          </div>
          <DialogTitle className="text-start text-lg">پرداخت جدید</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/50 bg-muted/20 p-3">
          <div className="text-start">
            <p className="text-[11px] text-muted-foreground">باقی‌مانده پرداخت</p>
            <p className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">
              {formatCurrency(
                finance.availableToRecord ?? finance.remainingBalance,
              )}
            </p>
          </div>
          <div className="text-start">
            <p className="text-[11px] text-muted-foreground">مجموع پرداخت‌شده</p>
            <p className="text-sm font-bold tabular-nums text-brand">
              {formatCurrency(finance.totalPaid)}
            </p>
          </div>
          {(finance.pendingApprovalTotal || 0) > 0 ? (
            <div className="col-span-2 text-start">
              <p className="text-[11px] text-muted-foreground">
                در انتظار تایید مدیر
              </p>
              <p className="text-sm font-semibold tabular-nums text-amber-800 dark:text-amber-400">
                {formatCurrency(finance.pendingApprovalTotal || 0)}
              </p>
            </div>
          ) : null}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">
            روش پرداخت <span className="text-destructive">*</span>
          </legend>
          <div
            role="radiogroup"
            aria-label="روش پرداخت"
            aria-invalid={!!paymentMethodError}
            aria-describedby={
              paymentMethodError ? "payment-method-error" : undefined
            }
            className="grid grid-cols-2 gap-1.5 rounded-xl border border-border/70 bg-muted/30 p-1.5 sm:grid-cols-4"
          >
            {CUSTOMER_PAYMENT_METHODS.map((option) => {
              const selected = paymentMethod === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "relative flex min-h-10 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-semibold transition-all",
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
                    selected
                      ? "bg-card text-brand shadow-sm ring-1 ring-brand/25"
                      : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                    paymentMut.isPending && "pointer-events-none opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    value={option.value}
                    checked={selected}
                    disabled={paymentMut.isPending}
                    onChange={() => {
                      setPaymentMethod(option.value);
                      setPaymentMethodError("");
                      setPaymentMetaError("");
                    }}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
          {paymentMethodError ? (
            <p
              id="payment-method-error"
              className="text-xs text-destructive"
              role="alert"
            >
              {paymentMethodError}
            </p>
          ) : null}
        </fieldset>

        {paymentMethod === "HESAB_PAY" ? (
          <div className="space-y-1.5">
            <Label htmlFor="payment-hesab" className="text-xs">
              شماره حساب پی <span className="text-destructive">*</span>
            </Label>
            <Input
              id="payment-hesab"
              dir="ltr"
              disabled={paymentMut.isPending}
              className="h-11 rounded-xl text-end"
              value={hesabPayAccount}
              onChange={(e) => {
                setHesabPayAccount(e.target.value);
                setPaymentMetaError("");
              }}
            />
          </div>
        ) : null}

        {paymentMethod === "CASH" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="payment-office" className="text-xs">
                آدرس دفتر <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="payment-office"
                disabled={paymentMut.isPending}
                className="min-h-[4rem] resize-none rounded-xl"
                value={officeAddress}
                onChange={(e) => {
                  setOfficeAddress(e.target.value);
                  setPaymentMetaError("");
                }}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-rep-phone" className="text-xs">
                شماره تماس مسئول دفتر{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="payment-rep-phone"
                dir="ltr"
                disabled={paymentMut.isPending}
                className="h-11 rounded-xl text-end"
                value={responsiblePhone}
                onChange={(e) => {
                  setResponsiblePhone(e.target.value);
                  setPaymentMetaError("");
                }}
              />
            </div>
          </div>
        ) : null}

        {paymentMethod === "BANK_TRANSFER" ? (
          <div className="space-y-1.5">
            <Label htmlFor="payment-card" className="text-xs">
              شماره کارت بانکی <span className="text-destructive">*</span>
            </Label>
            <Input
              id="payment-card"
              dir="ltr"
              disabled={paymentMut.isPending}
              className="h-11 rounded-xl text-end"
              value={bankCardNumber}
              onChange={(e) => {
                setBankCardNumber(e.target.value);
                setPaymentMetaError("");
              }}
            />
          </div>
        ) : null}

        {paymentMethod === "HAWALA" ? (
          <div className="space-y-1.5">
            <Label htmlFor="payment-hawala" className="text-xs">
              جزئیات حواله
            </Label>
            <Textarea
              id="payment-hawala"
              disabled={paymentMut.isPending}
              className="min-h-[4rem] resize-none rounded-xl"
              placeholder="نام صرافی، شماره حواله یا سایر جزئیات"
              value={bankInfo}
              onChange={(e) => {
                setBankInfo(e.target.value);
                setPaymentMetaError("");
              }}
              rows={2}
            />
          </div>
        ) : null}

        {paymentMetaError ? (
          <p className="text-xs text-destructive" role="alert">
            {paymentMetaError}
          </p>
        ) : null}

        <div className="space-y-2">
          <CrmCurrencyField
            id="new-payment-amount"
            label="مقدار *"
            value={paymentAmount}
            onChange={(v) => {
              setPaymentAmount(v);
              if (paymentError) setPaymentError("");
            }}
            placeholder="0"
            hint={`حداکثر مجاز: ${formatCurrency(finance.availableToRecord ?? finance.remainingBalance)}`}
          />
          {paymentError && (
            <p className="text-xs text-destructive">{paymentError}</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={paymentMut.isPending}
            onClick={() => onOpenChange(false)}
          >
            انصراف
          </Button>
          <Button
            type="button"
            variant="brand"
            className="rounded-xl shadow-md shadow-brand/20"
            isLoading={paymentMut.isPending}
            loadingText="در حال ثبت..."
            onClick={submitPayment}
          >
            <Wallet className="h-4 w-4" />
            ثبت پرداخت
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface NewPaymentButtonProps {
  opportunityId: string | null | undefined;
  finance: OpportunityFinance;
  contractLocked: boolean;
  paymentCount?: number;
  className?: string;
  onCreated?: (payment: RecordedPayment) => void | Promise<void>;
}

export function NewPaymentButton({
  opportunityId,
  finance,
  contractLocked,
  paymentCount = 0,
  className,
  onCreated,
}: NewPaymentButtonProps) {
  const [open, setOpen] = useState(false);
  const canCreate = useHasPermission(["finance.create", "crm.opportunity"]);

  if (!canCreate) return null;

  const disabled = !opportunityId || !contractLocked;
  const title = !opportunityId
    ? "قرارداد این پروژه یافت نشد"
    : contractLocked
      ? "ثبت پرداخت جدید"
      : "ابتدا قرارداد را ذخیره کنید";

  return (
    <>
      <Button
        type="button"
        variant="brand"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={title}
        className={cn(
          "w-full rounded-xl shadow-md shadow-brand/20 transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 sm:w-auto",
          className,
        )}
      >
        <Wallet className="h-4 w-4" />
        پرداخت جدید
      </Button>
      <NewPaymentDialog
        open={open}
        onOpenChange={setOpen}
        opportunityId={opportunityId}
        finance={finance}
        contractLocked={contractLocked}
        paymentCount={paymentCount}
        onCreated={onCreated}
      />
    </>
  );
}
