"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { invalidateFinanceQueries } from "@/lib/finance-queries";
import { formatStoredDateAsAfghan } from "@/lib/afghan-calendar";
import { AfghanDateField } from "@/components/shared/afghan-date-field";
import {
  paymentMethodLabel,
  CUSTOMER_PAYMENT_METHODS,
  type CustomerPaymentMethod,
} from "@/lib/payment-methods";
import { useHasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingTable } from "@/components/shared/loading-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  formatMoney,
  toInputDate,
  type FinanceExpense,
} from "../_components/types";
import { DeleteExpenseDialog } from "../_components/delete-expense-dialog";

type ListResponse = {
  items: FinanceExpense[];
  total: number;
};

type ExpenseFormState = {
  description: string;
  recipient: string;
  amount: string;
  expenseDate: string;
  paymentMethod: CustomerPaymentMethod | null;
  hesabPayAccount: string;
  officeAddress: string;
  responsiblePhone: string;
  bankCardNumber: string;
  bankInfo: string;
};

const emptyForm = (): ExpenseFormState => ({
  description: "",
  recipient: "",
  amount: "",
  expenseDate: toInputDate(new Date()),
  paymentMethod: null,
  hesabPayAccount: "",
  officeAddress: "",
  responsiblePhone: "",
  bankCardNumber: "",
  bankInfo: "",
});

function expenseAccountName(row: FinanceExpense) {
  return row.paidBy?.fullName || row.accountLabel || "—";
}

function expensesListUrl(from: string, to: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  return query ? `/finance/expenses?${query}` : "/finance/expenses";
}

export default function FinanceExpensesPage() {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission("finance.create");
  const canDelete = useHasPermission("finance.delete");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ExpenseFormState>(emptyForm);
  const [methodError, setMethodError] = useState("");
  const [metaError, setMetaError] = useState("");
  const [deleting, setDeleting] = useState<FinanceExpense | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const query = useQuery({
    queryKey: ["finance-expenses", from, to],
    queryFn: () => apiGet<ListResponse>(expensesListUrl(from, to)),
  });

  function resetForm() {
    setForm(emptyForm());
    setMethodError("");
    setMetaError("");
  }

  function validateAndBuildPayload() {
    if (!form.paymentMethod) {
      setMethodError("لطفاً روش پرداخت را انتخاب کنید.");
      return null;
    }
    setMethodError("");
    setMetaError("");

    if (form.paymentMethod === "HESAB_PAY" && !form.hesabPayAccount.trim()) {
      setMetaError("شماره حساب پی الزامی است.");
      return null;
    }
    if (form.paymentMethod === "CASH") {
      if (!form.officeAddress.trim()) {
        setMetaError("آدرس دفتر الزامی است.");
        return null;
      }
      if (!form.responsiblePhone.trim()) {
        setMetaError("شماره تماس مسئول دفتر الزامی است.");
        return null;
      }
    }
    if (form.paymentMethod === "BANK_TRANSFER" && !form.bankCardNumber.trim()) {
      setMetaError("شماره کارت بانکی الزامی است.");
      return null;
    }

    return {
      description: form.description.trim(),
      recipient: form.recipient.trim(),
      amount: Number(form.amount),
      expenseDate: form.expenseDate,
      paymentMethod: form.paymentMethod,
      paymentMethodMeta: {
        hesabPayAccount: form.hesabPayAccount.trim() || undefined,
        officeAddress: form.officeAddress.trim() || undefined,
        responsiblePhone: form.responsiblePhone.trim() || undefined,
        bankCardNumber: form.bankCardNumber.trim() || undefined,
        bankInfo: form.bankInfo.trim() || undefined,
      },
    };
  }

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost("/finance/expenses", payload),
    onSuccess: () => {
      toast.success("مصرف ثبت شد");
      setOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
      void invalidateFinanceQueries(queryClient);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "ثبت مصرف ناموفق بود");
    },
  });

  function submitExpense() {
    const payload = validateAndBuildPayload();
    if (!payload) return;
    createMutation.mutate(payload);
  }

  const items = query.data?.items || [];

  return (
    <div>
      <PageHeader
        title="مصارف شرکت"
        subtitle="ثبت هزینه‌های عمومی — حساب ثبت‌کننده به‌صورت خودکار از کاربر واردشده تعیین می‌شود"
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="expense-range-from" className="text-xs">
                از
              </Label>
              <AfghanDateField
                id="expense-range-from"
                aria-label="از تاریخ"
                value={from}
                onChange={setFrom}
                className="w-[13.5rem] max-w-full"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expense-range-to" className="text-xs">
                تا
              </Label>
              <AfghanDateField
                id="expense-range-to"
                aria-label="تا تاریخ"
                value={to}
                onChange={setTo}
                className="w-[13.5rem] max-w-full"
              />
            </div>
            {canCreate && (
              <Button
                onClick={() => {
                  resetForm();
                  setOpen(true);
                }}
              >
                <Plus className="size-4" />
                ثبت مصرف
              </Button>
            )}
          </div>
        }
      />

      {query.isLoading ? (
        <LoadingTable rows={6} columns={6} />
      ) : items.length === 0 ? (
        <EmptyState title="مصرفي ثبت نشده" description="اولین مصرف شرکت را ثبت کنید." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>تاریخ</TableHead>
                <TableHead>برای چی</TableHead>
                <TableHead>به کی</TableHead>
                <TableHead>روش پرداخت</TableHead>
                <TableHead>حساب</TableHead>
                <TableHead>مبلغ</TableHead>
                {canDelete ? <TableHead></TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => {
                const methodLabel =
                  row.paymentMethodLabel || paymentMethodLabel(row.paymentMethod);
                const metaRows = row.paymentMethodMetaRows || [];
                return (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatStoredDateAsAfghan(row.expenseDate)}
                    </TableCell>
                    <TableCell>{row.description || "—"}</TableCell>
                    <TableCell>{row.recipient || "—"}</TableCell>
                    <TableCell>
                      <div className="space-y-1.5">
                        <Badge
                          variant="outline"
                          className="rounded-full font-normal"
                        >
                          {methodLabel}
                        </Badge>
                        {metaRows.length > 0 ? (
                          <div className="space-y-0.5 text-[11px] text-muted-foreground">
                            {metaRows.map((meta) => (
                              <div key={`${row.id}-${meta.label}`}>
                                <span>{meta.label}: </span>
                                <span
                                  className={cn(
                                    "text-foreground/80",
                                    meta.ltr && "tabular-nums",
                                  )}
                                  dir={meta.ltr ? "ltr" : undefined}
                                >
                                  {meta.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{expenseAccountName(row)}</TableCell>
                    <TableCell className="tabular-nums font-medium">
                      {formatMoney(row.amount)}
                    </TableCell>
                    {canDelete ? (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeleting(row);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetForm();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>ثبت مصرف شرکت</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="expense-description">برای چی</Label>
              <Input
                id="expense-description"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expense-recipient">به کی</Label>
              <Input
                id="expense-recipient"
                value={form.recipient}
                onChange={(e) =>
                  setForm((f) => ({ ...f, recipient: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expense-amount">مبلغ</Label>
              <Input
                id="expense-amount"
                type="number"
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expense-date">تاریخ</Label>
              <AfghanDateField
                id="expense-date"
                aria-label="تاریخ مصرف"
                value={form.expenseDate}
                onChange={(expenseDate) =>
                  setForm((current) => ({ ...current, expenseDate }))
                }
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">
                روش پرداخت <span className="text-destructive">*</span>
              </legend>
              <div
                role="radiogroup"
                aria-label="روش پرداخت"
                aria-invalid={!!methodError}
                aria-describedby={methodError ? "expense-method-error" : undefined}
                className="grid grid-cols-2 gap-1.5 rounded-xl border border-border/70 bg-muted/30 p-1.5 sm:grid-cols-4"
              >
                {CUSTOMER_PAYMENT_METHODS.map((option) => {
                  const selected = form.paymentMethod === option.value;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "relative flex min-h-10 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-semibold transition-all",
                        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
                        selected
                          ? "bg-card text-brand shadow-sm ring-1 ring-brand/25"
                          : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                        createMutation.isPending &&
                          "pointer-events-none opacity-60",
                      )}
                    >
                      <input
                        type="radio"
                        name="expense-payment-method"
                        value={option.value}
                        checked={selected}
                        disabled={createMutation.isPending}
                        onChange={() => {
                          setForm((f) => ({
                            ...f,
                            paymentMethod: option.value,
                          }));
                          setMethodError("");
                          setMetaError("");
                        }}
                        className="sr-only"
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
              {methodError ? (
                <p
                  id="expense-method-error"
                  className="text-xs text-destructive"
                  role="alert"
                >
                  {methodError}
                </p>
              ) : null}
            </fieldset>

            {form.paymentMethod === "HESAB_PAY" ? (
              <div className="space-y-1.5">
                <Label htmlFor="expense-hesab" className="text-xs">
                  شماره حساب پی <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="expense-hesab"
                  dir="ltr"
                  disabled={createMutation.isPending}
                  className="h-11 rounded-xl text-end"
                  value={form.hesabPayAccount}
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      hesabPayAccount: e.target.value,
                    }));
                    setMetaError("");
                  }}
                />
              </div>
            ) : null}

            {form.paymentMethod === "CASH" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="expense-office" className="text-xs">
                    آدرس دفتر <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="expense-office"
                    disabled={createMutation.isPending}
                    className="min-h-[4rem] resize-none rounded-xl"
                    value={form.officeAddress}
                    onChange={(e) => {
                      setForm((f) => ({
                        ...f,
                        officeAddress: e.target.value,
                      }));
                      setMetaError("");
                    }}
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expense-rep-phone" className="text-xs">
                    شماره تماس مسئول دفتر{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="expense-rep-phone"
                    dir="ltr"
                    disabled={createMutation.isPending}
                    className="h-11 rounded-xl text-end"
                    value={form.responsiblePhone}
                    onChange={(e) => {
                      setForm((f) => ({
                        ...f,
                        responsiblePhone: e.target.value,
                      }));
                      setMetaError("");
                    }}
                  />
                </div>
              </div>
            ) : null}

            {form.paymentMethod === "BANK_TRANSFER" ? (
              <div className="space-y-1.5">
                <Label htmlFor="expense-card" className="text-xs">
                  شماره کارت بانکی <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="expense-card"
                  dir="ltr"
                  disabled={createMutation.isPending}
                  className="h-11 rounded-xl text-end"
                  value={form.bankCardNumber}
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      bankCardNumber: e.target.value,
                    }));
                    setMetaError("");
                  }}
                />
              </div>
            ) : null}

            {form.paymentMethod === "HAWALA" ? (
              <div className="space-y-1.5">
                <Label htmlFor="expense-hawala" className="text-xs">
                  جزئیات حواله
                </Label>
                <Textarea
                  id="expense-hawala"
                  disabled={createMutation.isPending}
                  className="min-h-[4rem] resize-none rounded-xl"
                  placeholder="نام صرافی، شماره حواله یا سایر جزئیات"
                  value={form.bankInfo}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, bankInfo: e.target.value }));
                    setMetaError("");
                  }}
                  rows={2}
                />
              </div>
            ) : null}

            {metaError ? (
              <p className="text-xs text-destructive" role="alert">
                {metaError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
            >
              انصراف
            </Button>
            <Button
              disabled={createMutation.isPending}
              onClick={submitExpense}
            >
              ذخیره
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteExpenseDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        expense={deleting}
      />
    </div>
  );
}
