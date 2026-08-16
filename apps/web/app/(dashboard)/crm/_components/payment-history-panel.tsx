"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { useMeQuery } from "@/lib/permissions";
import { hasPermission } from "@/lib/rbac";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { toast } from "sonner";
import { HorizontalScroll } from "@/components/shared/horizontal-scroll";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, History, X } from "lucide-react";
import { CrmSectionHeader } from "./crm-ui";
import type { CustomerInvoice, CustomerPayment } from "./payment-types";
import {
  PaymentReceiptActions,
  PaymentReceiptDialog,
} from "./payment-receipt-dialog";

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار تایید مدیر",
  VERIFIED: "تایید شده",
  REJECTED: "رد شده",
};

const PAYMENT_STATUS_VARIANTS: Record<
  string,
  "warning" | "success" | "destructive" | "secondary"
> = {
  PENDING: "warning",
  VERIFIED: "success",
  REJECTED: "destructive",
};

interface PaymentHistoryPanelProps {
  invoices: CustomerInvoice[];
  payments: CustomerPayment[];
  onChanged: () => void | Promise<void>;
  /** Open this receipt immediately after a new payment is created. */
  initialReceiptPaymentId?: string | null;
  onInitialReceiptHandled?: () => void;
}

export function PaymentHistoryPanel({
  invoices,
  payments,
  onChanged,
  initialReceiptPaymentId = null,
  onInitialReceiptHandled,
}: PaymentHistoryPanelProps) {
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<CustomerPayment | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const me = useMeQuery();
  const canApprove = hasPermission(
    me.data?.permissions,
    "finance.approve",
    me.data?.role,
  );

  useEffect(() => {
    if (!initialReceiptPaymentId) return;
    setReceiptPaymentId(initialReceiptPaymentId);
    setReceiptOpen(true);
    onInitialReceiptHandled?.();
  }, [initialReceiptPaymentId, onInitialReceiptHandled]);

  const invoiceById = useMemo(() => {
    const map = new Map<string, CustomerInvoice>();
    for (const inv of invoices) map.set(inv.id, inv);
    return map;
  }, [invoices]);

  const sortedPayments = useMemo(() => {
    return [...payments].sort((a, b) => {
      const ta = new Date(a.paidAt || a.createdAt).getTime();
      const tb = new Date(b.paidAt || b.createdAt).getTime();
      return tb - ta;
    });
  }, [payments]);

  const verifiedTotal = useMemo(
    () =>
      sortedPayments
        .filter((p) => p.verification === "VERIFIED")
        .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [sortedPayments],
  );

  /** Only approved payments affect contract finance. */
  const approvedTotal = verifiedTotal;

  const pendingCount = useMemo(
    () => sortedPayments.filter((p) => p.verification === "PENDING").length,
    [sortedPayments],
  );

  const verifyMut = useMutation({
    mutationFn: (paymentId: string) =>
      apiPost(`/crm/payments/${paymentId}/verify`),
    onSuccess: async () => {
      toast.success("پرداخت تأیید شد و در محاسبات مالی اعمال گردید");
      await onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا"),
  });

  const rejectMut = useMutation({
    mutationFn: ({
      paymentId,
      rejectionReason,
    }: {
      paymentId: string;
      rejectionReason: string;
    }) => apiPost(`/crm/payments/${paymentId}/reject`, { rejectionReason }),
    onSuccess: async () => {
      toast.success("پرداخت رد شد");
      setRejectTarget(null);
      setRejectReason("");
      await onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا"),
  });

  const openReceipt = (paymentId: string) => {
    setReceiptPaymentId(paymentId);
    setReceiptOpen(true);
  };

  const busy = verifyMut.isPending || rejectMut.isPending;

  return (
    <section
      dir="rtl"
      className="rounded-2xl border border-border/50 bg-card p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:p-6"
    >
      <CrmSectionHeader
        icon={History}
        title="سوابق پرداخت"
        description="پرداخت‌ها پس از تأیید مدیر در محاسبات مالی پروژه لحاظ می‌شوند"
        className="mb-5"
        action={
          <div className="flex flex-wrap justify-start gap-2">
            <Badge variant="secondary" className="rounded-full font-normal">
              {sortedPayments.length.toLocaleString("fa-AF", {
                numberingSystem: "latn",
              })}{" "}
              پرداخت
            </Badge>
            {pendingCount > 0 && (
              <Badge variant="warning" className="rounded-full font-normal">
                {pendingCount.toLocaleString("fa-AF", {
                  numberingSystem: "latn",
                })}{" "}
                در انتظار تایید
              </Badge>
            )}
            <Badge variant="success" className="rounded-full font-normal">
              مجموع پرداخت‌شده: {formatCurrency(approvedTotal)}
            </Badge>
          </div>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-border/50 bg-background">
        {sortedPayments.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/70">
              <History className="h-8 w-8 text-muted-foreground/45" />
            </div>
            <p className="text-sm font-bold">هنوز پرداختی ثبت نشده است</p>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
              پس از دریافت وجه از مشتری، پرداخت را از بخش «جزئیات قرارداد» با دکمه
              «پرداخت جدید» ثبت کنید. تا قبل از تأیید مدیر، مبلغ در مانده پروژه
              لحاظ نمی‌شود.
            </p>
          </div>
        ) : (
          <>
            <HorizontalScroll bordered={false} className="hidden lg:block">
              <Table className="min-w-[54rem]">
                <TableHeader>
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableHead className="text-start">شماره پرداخت</TableHead>
                    <TableHead className="text-start">مبلغ پرداختی</TableHead>
                    <TableHead className="text-start">تاریخ پرداخت</TableHead>
                    <TableHead className="text-start">زمان پرداخت</TableHead>
                    <TableHead className="text-start">روش پرداخت</TableHead>
                    <TableHead className="text-start">ثبت‌کننده</TableHead>
                    <TableHead className="text-start">وضعیت</TableHead>
                    <TableHead className="min-w-[220px] text-start">
                      عملیات
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPayments.map((p) => {
                    const paidAt = p.paidAt || p.createdAt;
                    const paymentNumber =
                      p.reference ||
                      p.invoice?.invoiceNumber ||
                      (p.invoiceId
                        ? invoiceById.get(p.invoiceId)?.invoiceNumber
                        : null) ||
                      `PAY-${p.id.slice(-8).toUpperCase()}`;

                    return (
                      <TableRow
                        key={p.id}
                        className="transition-colors hover:bg-muted/15"
                      >
                        <TableCell className="text-start">
                          <span
                            className="font-medium tabular-nums [unicode-bidi:isolate]"
                            dir="ltr"
                          >
                            {paymentNumber}
                          </span>
                        </TableCell>
                        <TableCell className="text-start font-semibold tabular-nums">
                          {formatCurrency(Number(p.amount))}
                        </TableCell>
                        <TableCell className="text-start text-sm text-muted-foreground">
                          {formatDate(paidAt)}
                        </TableCell>
                        <TableCell className="text-start text-sm text-muted-foreground tabular-nums">
                          {formatTime(paidAt)}
                        </TableCell>
                        <TableCell className="text-start">
                          <Badge
                            variant="outline"
                            className="rounded-full font-normal"
                          >
                            {p.methodLabel || paymentMethodLabel(p.method)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-start text-sm">
                          {p.recordedBy?.fullName || "—"}
                        </TableCell>
                        <TableCell className="text-start">
                          <Badge
                            variant={
                              PAYMENT_STATUS_VARIANTS[p.verification] ||
                              "secondary"
                            }
                            className="rounded-full"
                          >
                            {PAYMENT_STATUS_LABELS[p.verification] ||
                              p.verification}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-start">
                          <div className="flex flex-wrap items-center gap-2">
                            <PaymentReceiptActions
                              paymentId={p.id}
                              onView={() => openReceipt(p.id)}
                            />
                            {canApprove && p.verification === "PENDING" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => verifyMut.mutate(p.id)}
                                  disabled={busy}
                                  className="rounded-lg hover:border-brand/40 hover:bg-brand/5"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  تأیید
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setRejectReason("");
                                    setRejectTarget(p);
                                  }}
                                  disabled={busy}
                                  className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  رد
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </HorizontalScroll>

            <div className="space-y-3 p-3 lg:hidden">
              {sortedPayments.map((p) => {
                const paidAt = p.paidAt || p.createdAt;
                const paymentNumber =
                  p.reference ||
                  `PAY-${p.id.slice(-8).toUpperCase()}`;
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-border/50 bg-muted/10 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-start">
                        <p className="font-bold tabular-nums">
                          {formatCurrency(Number(p.amount))}
                        </p>
                        <p
                          className="mt-0.5 text-xs text-muted-foreground [unicode-bidi:isolate]"
                          dir="ltr"
                        >
                          {paymentNumber}
                        </p>
                      </div>
                      <Badge
                        variant={
                          PAYMENT_STATUS_VARIANTS[p.verification] || "secondary"
                        }
                        className="rounded-full"
                      >
                        {PAYMENT_STATUS_LABELS[p.verification] ||
                          p.verification}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/40 pt-3 text-xs text-muted-foreground">
                      <p>
                        تاریخ:{" "}
                        <span className="text-foreground">
                          {formatDate(paidAt)}
                        </span>
                      </p>
                      <p>
                        زمان:{" "}
                        <span className="text-foreground tabular-nums">
                          {formatTime(paidAt)}
                        </span>
                      </p>
                      <p className="col-span-2">
                        روش پرداخت:{" "}
                        <span className="font-medium text-foreground">
                          {p.methodLabel || paymentMethodLabel(p.method)}
                        </span>
                      </p>
                      <p className="col-span-2">
                        ثبت‌کننده:{" "}
                        <span className="text-foreground">
                          {p.recordedBy?.fullName || "—"}
                        </span>
                      </p>
                      {p.rejectionReason ? (
                        <p className="col-span-2">
                          دلیل رد:{" "}
                          <span className="text-destructive">
                            {p.rejectionReason}
                          </span>
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
                      <PaymentReceiptActions
                        paymentId={p.id}
                        onView={() => openReceipt(p.id)}
                      />
                      {canApprove && p.verification === "PENDING" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => verifyMut.mutate(p.id)}
                            disabled={busy}
                            className="rounded-lg"
                          >
                            <Check className="h-3.5 w-3.5" />
                            تأیید
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setRejectReason("");
                              setRejectTarget(p);
                            }}
                            disabled={busy}
                            className="rounded-lg text-destructive"
                          >
                            <X className="h-3.5 w-3.5" />
                            رد
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <PaymentReceiptDialog
        paymentId={receiptPaymentId}
        open={receiptOpen}
        onOpenChange={(open) => {
          setReceiptOpen(open);
          if (!open) setReceiptPaymentId(null);
        }}
      />

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-start">رد پرداخت</DialogTitle>
            <DialogDescription className="text-start">
              دلیل رد برای ثبت‌کننده ارسال می‌شود و مبلغ در محاسبات مالی لحاظ
              نمی‌شود.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="crm-rejection-reason">دلیل رد</Label>
            <Textarea
              id="crm-rejection-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="دلیل رد را بنویسید…"
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              type="button"
              variant="destructive"
              disabled={busy || rejectReason.trim().length < 3}
              onClick={() =>
                rejectTarget &&
                rejectMut.mutate({
                  paymentId: rejectTarget.id,
                  rejectionReason: rejectReason.trim(),
                })
              }
            >
              رد پرداخت
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setRejectTarget(null);
                setRejectReason("");
              }}
            >
              انصراف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
