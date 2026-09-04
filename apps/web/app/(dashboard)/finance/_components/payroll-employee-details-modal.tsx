"use client";

import { formatDate, cn } from "@/lib/utils";
import { getCustomerPersonName } from "@/lib/crm-customer-name";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  formatMoney,
  type PayrollEmployee,
  type PayrollProjectHistoryItem,
} from "./types";

const KIND_LABELS: Record<string, string> = {
  EDITOR: "ادیتور",
  NARRATOR: "نریتور",
  SALES: "فروش",
  FINANCE: "مالی",
  MANAGER: "مدیر",
  ADMIN: "ادمین",
  OTHER: "سایر",
};

const PAYABLE_STATUS_LABELS: Record<string, string> = {
  PAID: "پرداخت‌شده",
  CONFIRMED: "تأییدشده",
  ESTIMATED: "برآوردی",
};

export function payrollKindLabel(kind: string) {
  return KIND_LABELS[kind] || kind;
}

export function compensationTypeLabel(type: "FIXED" | "PROJECT_SHARE") {
  return type === "FIXED" ? "معاش ثابت" : "پروژه‌ای";
}

export function payrollPaymentStatus(
  payable: number,
  paid: number,
): { label: string; variant: "success" | "warning" | "secondary" } {
  if (payable <= 0 && paid > 0) {
    return { label: "تسویه‌شده", variant: "success" };
  }
  if (paid <= 0) {
    return { label: "پرداخت‌نشده", variant: "secondary" };
  }
  if (payable > 0) {
    return { label: "پرداخت جزئی", variant: "warning" };
  }
  return { label: "تسویه‌شده", variant: "success" };
}

function payableRowStatus(item: PayrollProjectHistoryItem) {
  if (item.payableStatus === "PAID" || item.remainingAmount <= 0) {
    return { label: "پرداخت‌شده", variant: "success" as const };
  }
  if (item.paidAmount > 0) {
    return { label: "پرداخت جزئی", variant: "warning" as const };
  }
  return {
    label: PAYABLE_STATUS_LABELS[item.payableStatus] || item.payableStatus,
    variant: "secondary" as const,
  };
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-start">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

type PayrollEmployeeDetailsModalProps = {
  employee: PayrollEmployee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canCreate: boolean;
  canEdit: boolean;
  onPay: () => void;
  onAdvance: () => void;
  onComp: () => void;
  onSettleAdvance: (id: string) => void;
  settlePending?: boolean;
};

export function PayrollEmployeeDetailsModal({
  employee,
  open,
  onOpenChange,
  canCreate,
  canEdit,
  onPay,
  onAdvance,
  onComp,
  onSettleAdvance,
  settlePending,
}: PayrollEmployeeDetailsModalProps) {
  if (!employee) return null;

  const isFixed = employee.compensation.type === "FIXED";
  const remaining = employee.remaining ?? employee.netPayable;
  const status = payrollPaymentStatus(remaining, employee.paidTotal);
  const history = employee.projectHistory?.length
    ? employee.projectHistory
    : employee.contributingProjects.map((p) => ({
        payableId: p.payableId,
        projectId: p.projectId,
        code: p.code,
        title: p.title,
        projectStatus: null,
        completedAt: null,
        customer: null,
        roleLabel: p.roleLabel,
        projectAmount: 0,
        amount: p.amount,
        payableStatus: "CONFIRMED",
        paidAmount: 0,
        remainingAmount: p.amount,
        paidAt: null,
        paymentMethod: null,
      }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(92vh,880px)] w-[calc(100%-2rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 text-start sm:rounded-2xl"
        dir="rtl"
      >
        <div className="h-1 shrink-0 bg-gradient-to-l from-brand via-brand to-brand/50" />

        <DialogHeader className="shrink-0 space-y-3 border-b border-border/50 bg-muted/10 px-6 pb-5 pt-5 text-start">
          <div className="flex flex-wrap items-center gap-2 pe-8">
            <Badge variant={isFixed ? "secondary" : "default"} className="font-medium">
              {compensationTypeLabel(employee.compensation.type)}
            </Badge>
            <Badge variant={status.variant} className="font-normal">
              {status.label}
            </Badge>
          </div>
          <div className="space-y-1 text-start">
            <DialogTitle className="text-start text-xl font-bold tracking-tight">
              {employee.displayName}
            </DialogTitle>
            <DialogDescription className="text-start">
              {payrollKindLabel(employee.kind)}
              {!isFixed ? (
                <>
                  <span className="mx-2 text-border">·</span>
                  <span className="tabular-nums">
                    {employee.projectsCompletedCount.toLocaleString("fa-AF", {
                      numberingSystem: "latn",
                    })}{" "}
                    پروژه
                  </span>
                </>
              ) : null}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 text-start" dir="rtl">
          <section className="space-y-3">
            <h3 className="text-start text-xs font-semibold tracking-wide text-muted-foreground">
              خلاصه مالی
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {isFixed ? (
                <InfoTile
                  label="معاش ماهانه"
                  value={formatMoney(employee.compensation.fixedMonthlyAmount)}
                />
              ) : (
                <InfoTile
                  label="مبلغ قابل پرداخت"
                  value={formatMoney(employee.grossPayable)}
                />
              )}
              <InfoTile label="پرداخت‌شده" value={formatMoney(employee.paidTotal)} />
              <InfoTile label="مانده / قابل پرداخت" value={formatMoney(remaining)} />
              <InfoTile
                label="پیش‌پرداخت باز"
                value={formatMoney(employee.openAdvances)}
              />
            </div>
            {!isFixed ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <InfoTile
                  label="تعداد پروژه‌ها"
                  value={employee.projectsCompletedCount.toLocaleString("fa-AF", {
                    numberingSystem: "latn",
                  })}
                />
                <InfoTile
                  label="نوع کارمند"
                  value={compensationTypeLabel(employee.compensation.type)}
                />
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <InfoTile
                  label="آخرین پرداخت"
                  value={
                    employee.lastPaymentAt
                      ? formatDate(employee.lastPaymentAt)
                      : "—"
                  }
                />
                <InfoTile
                  label="یادداشت معاش"
                  value={employee.compensation.notes || "—"}
                />
              </div>
            )}
          </section>

          {!isFixed ? (
            <section className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-start text-xs font-semibold tracking-wide text-muted-foreground">
                  تاریخچه پروژه‌ها
                </h3>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {history.length.toLocaleString("fa-AF", {
                    numberingSystem: "latn",
                  })}{" "}
                  رکورد
                </span>
              </div>
              {history.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
                  پروژه‌ای برای این کارمند ثبت نشده است.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border/60" dir="rtl">
                  <Table dir="rtl">
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="text-start text-xs">پروژه</TableHead>
                        <TableHead className="text-start text-xs">مشتری</TableHead>
                        <TableHead className="text-start text-xs">نقش</TableHead>
                        <TableHead className="text-start text-xs">تکمیل</TableHead>
                        <TableHead className="text-start text-xs">مبلغ پروژه</TableHead>
                        <TableHead className="text-start text-xs">قابل پرداخت</TableHead>
                        <TableHead className="text-start text-xs">وضعیت</TableHead>
                        <TableHead className="text-start text-xs">مانده</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((item) => {
                        const rowStatus = payableRowStatus(item);
                        return (
                          <TableRow key={item.payableId}>
                            <TableCell className="max-w-[10rem] text-start">
                              <div className="truncate text-sm font-medium">
                                {item.title || "—"}
                              </div>
                              <div className="text-[11px] tabular-nums text-muted-foreground">
                                {item.code || "—"}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[8rem] truncate text-start text-sm">
                              {getCustomerPersonName(item.customer)}
                            </TableCell>
                            <TableCell className="text-start text-sm">
                              {item.roleLabel}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-start text-sm">
                              {item.completedAt
                                ? formatDate(item.completedAt)
                                : "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-start text-sm tabular-nums">
                              {item.projectAmount > 0
                                ? formatMoney(item.projectAmount)
                                : "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-start text-sm font-semibold tabular-nums">
                              {formatMoney(item.amount)}
                            </TableCell>
                            <TableCell className="text-start">
                              <Badge
                                variant={rowStatus.variant}
                                className="font-normal"
                              >
                                {rowStatus.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-start text-sm tabular-nums">
                              {formatMoney(item.remainingAmount)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          ) : null}

          {employee.advances.filter((a) => a.status === "OPEN").length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-start text-xs font-semibold tracking-wide text-amber-700 dark:text-amber-400">
                پیش‌پرداخت‌های باز
              </h3>
              <ul className="space-y-1.5">
                {employee.advances
                  .filter((a) => a.status === "OPEN")
                  .map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-sm"
                      dir="rtl"
                    >
                      <span className="text-start">
                        {formatMoney(a.amount)}
                        <span className="mx-1.5 text-border">·</span>
                        {formatDate(a.paidAt)}
                      </span>
                      {canEdit ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={settlePending}
                          onClick={() => onSettleAdvance(a.id)}
                        >
                          تسویه
                        </Button>
                      ) : null}
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-start text-xs font-semibold tracking-wide text-muted-foreground">
              تاریخچه پرداخت
            </h3>
            {employee.payments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                پرداختی ثبت نشده
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border/60" dir="rtl">
                <Table dir="rtl">
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-start text-xs">تاریخ</TableHead>
                      <TableHead className="text-start text-xs">مبلغ</TableHead>
                      <TableHead className="text-start text-xs">روش</TableHead>
                      <TableHead className="text-start text-xs">توضیح</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employee.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap text-start text-sm">
                          {formatDate(p.paidAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-start text-sm font-semibold tabular-nums">
                          {formatMoney(p.amount)}
                        </TableCell>
                        <TableCell className="text-start text-sm">
                          {paymentMethodLabel(p.method)}
                        </TableCell>
                        <TableCell className="max-w-[12rem] truncate text-start text-sm text-muted-foreground">
                          {p.notes || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <div
            className={cn(
              "flex flex-wrap gap-2 border-t border-border/50 pt-4",
            )}
            dir="rtl"
          >
            {canCreate ? (
              <>
                <Button onClick={onPay}>ثبت پرداخت</Button>
                <Button variant="secondary" onClick={onAdvance}>
                  ثبت پیش‌پرداخت
                </Button>
              </>
            ) : null}
            {canEdit ? (
              <Button variant="outline" onClick={onComp}>
                تنظیم نوع معاش
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
