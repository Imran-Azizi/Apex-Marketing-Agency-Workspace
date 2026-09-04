"use client";

import { Receipt } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { getCustomerPersonName } from "@/lib/crm-customer-name";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { formatMoney, type FinanceProject, type FinanceProjectPayment } from "./types";
import {
  paymentProgressPct,
  PaymentProgressBar,
  settlementBadgeVariant,
  settlementLabel,
  verificationLabel,
} from "./finance-project-ui";

function KpiCard({
  label,
  value,
  currency,
  tone = "default",
}: {
  label: string;
  value: number;
  currency?: string;
  tone?: "default" | "paid" | "remaining";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3.5",
        tone === "paid" &&
          "border-emerald-500/20 bg-emerald-500/[0.05] dark:bg-emerald-500/[0.08]",
        tone === "remaining" &&
          "border-amber-500/20 bg-amber-500/[0.05] dark:bg-amber-500/[0.08]",
        tone === "default" && "border-border/60 bg-muted/20",
      )}
    >
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-lg font-bold tabular-nums tracking-tight",
          tone === "paid" && "text-emerald-700 dark:text-emerald-300",
          tone === "remaining" && "text-amber-800 dark:text-amber-300",
          tone === "default" && "text-foreground",
        )}
      >
        {formatMoney(value, currency)}
      </p>
    </div>
  );
}

function confirmationText(payment: FinanceProjectPayment) {
  if (payment.verification === "VERIFIED") {
    const parts: string[] = [];
    if (payment.verifiedBy?.fullName) parts.push(payment.verifiedBy.fullName);
    if (payment.verifiedAt) parts.push(formatDate(payment.verifiedAt));
    return parts.length ? parts.join(" · ") : "—";
  }
  if (payment.verification === "REJECTED" && payment.rejectionReason) {
    return payment.rejectionReason;
  }
  return "—";
}

type FinanceProjectDetailsModalProps = {
  project: FinanceProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FinanceProjectDetailsModal({
  project,
  open,
  onOpenChange,
}: FinanceProjectDetailsModalProps) {
  if (!project) return null;

  const paymentCount = project.paymentCount ?? project.payments.length;
  const progressPct = paymentProgressPct(
    project.finalProjectPrice,
    project.received,
  );
  const customerName = getCustomerPersonName(project.customer);
  const methods =
    project.paymentMethods?.length
      ? project.paymentMethods.join(" · ")
      : project.payments
          .filter((p) => p.verification === "VERIFIED")
          .map((p) => p.methodLabel)
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .join(" · ") || "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(90vh,820px)] w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl"
        overlayClassName="bg-black/60 backdrop-blur-[2px]"
      >
        <div className="h-1 shrink-0 bg-gradient-to-l from-brand via-brand to-brand/50" />

        <DialogHeader className="shrink-0 space-y-3 border-b border-border/50 bg-muted/10 px-6 pb-5 pt-5 text-start">
          <div className="flex flex-wrap items-center gap-2 pe-8">
            <Badge
              variant={settlementBadgeVariant(project.settlementStatus)}
              className="font-medium"
            >
              {settlementLabel(project)}
            </Badge>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
              {progressPct}٪ پرداخت‌شده
            </span>
          </div>

          <div className="space-y-1">
            <DialogTitle className="text-start text-xl font-bold tracking-tight">
              جزئیات مالی پروژه
            </DialogTitle>
            <DialogDescription className="text-start leading-relaxed">
              <span className="font-medium text-foreground/90">
                {project.title}
              </span>
              <span className="mx-2 text-border">·</span>
              <span className="tabular-nums">{project.code}</span>
              <span className="mx-2 text-border">·</span>
              <span>{customerName}</span>
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              خلاصه مالی
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <KpiCard
                label="مبلغ کل پروژه"
                value={project.finalProjectPrice}
                currency={project.currency}
              />
              <KpiCard
                label="مبلغ پرداخت‌شده"
                value={project.received}
                currency={project.currency}
                tone="paid"
              />
              <KpiCard
                label="مانده حساب"
                value={project.balance}
                currency={project.currency}
                tone="remaining"
              />
            </div>

            <div className="rounded-xl border border-border/60 bg-card px-4 py-3.5">
              <PaymentProgressBar
                total={project.finalProjectPrice}
                paid={project.received}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-border/50 bg-muted/15 px-3 py-2.5">
                <p className="text-[10px] font-medium text-muted-foreground">
                  روش پرداخت
                </p>
                <p className="mt-1 text-xs font-medium text-foreground">
                  {methods}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/15 px-3 py-2.5">
                <p className="text-[10px] font-medium text-muted-foreground">
                  تعداد تراکنش
                </p>
                <p className="mt-1 text-xs font-medium tabular-nums text-foreground">
                  {paymentCount.toLocaleString("fa-AF", {
                    numberingSystem: "latn",
                  })}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/15 px-3 py-2.5">
                <p className="text-[10px] font-medium text-muted-foreground">
                  آخرین پرداخت
                </p>
                <p className="mt-1 text-xs font-medium text-foreground">
                  {project.lastPaymentAt
                    ? formatDate(project.lastPaymentAt)
                    : "—"}
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                تاریخچه پرداخت
              </h3>
              {paymentCount > 0 ? (
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {paymentCount.toLocaleString("fa-AF", {
                    numberingSystem: "latn",
                  })}{" "}
                  تراکنش
                </span>
              ) : null}
            </div>

            {!project.payments.length ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-6 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                  <Receipt className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-medium text-foreground">
                  پرداختی ثبت نشده
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  برای این پروژه هنوز تراکنش مالی ثبت نشده است.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-xs">تاریخ</TableHead>
                      <TableHead className="text-xs">مبلغ</TableHead>
                      <TableHead className="text-xs">روش</TableHead>
                      <TableHead className="text-xs">فاکتور</TableHead>
                      <TableHead className="text-xs">مرجع</TableHead>
                      <TableHead className="text-xs">وضعیت</TableHead>
                      <TableHead className="text-xs">تأیید</TableHead>
                      <TableHead className="text-xs">یادداشت</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {project.payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDate(payment.paidAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm font-semibold tabular-nums">
                          {formatMoney(payment.amount, project.currency)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {payment.methodLabel}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                          {payment.invoiceNumber || "—"}
                        </TableCell>
                        <TableCell className="max-w-[7rem] truncate text-sm text-muted-foreground">
                          {payment.reference || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              payment.verification === "VERIFIED"
                                ? "success"
                                : payment.verification === "PENDING"
                                  ? "warning"
                                  : "secondary"
                            }
                            className="font-normal"
                          >
                            {verificationLabel(payment.verification)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[9rem] truncate text-xs text-muted-foreground">
                          {confirmationText(payment)}
                        </TableCell>
                        <TableCell className="max-w-[8rem] truncate text-sm text-muted-foreground">
                          {payment.notes || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
