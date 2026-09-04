"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { invalidateFinanceQueries } from "@/lib/finance-queries";
import { formatDate } from "@/lib/utils";
import { paymentMethodLabel, CUSTOMER_PAYMENT_METHODS } from "@/lib/payment-methods";
import { useHasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingTable } from "@/components/shared/loading-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  endOfMonth,
  formatMoney,
  startOfMonth,
  toInputDate,
  type FinanceExpense,
} from "../_components/types";
import { DeleteExpenseDialog } from "../_components/delete-expense-dialog";

type ListResponse = {
  items: FinanceExpense[];
  total: number;
};

const emptyForm = {
  description: "",
  recipient: "",
  amount: "",
  expenseDate: toInputDate(new Date()),
  paymentMethod: "CASH",
};

function expenseAccountName(row: FinanceExpense) {
  return row.paidBy?.fullName || row.accountLabel || "—";
}

export default function FinanceExpensesPage() {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission("finance.create");
  const canDelete = useHasPermission("finance.delete");
  const [from, setFrom] = useState(() => toInputDate(startOfMonth()));
  const [to, setTo] = useState(() => toInputDate(endOfMonth()));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState<FinanceExpense | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const query = useQuery({
    queryKey: ["finance-expenses", from, to],
    queryFn: () =>
      apiGet<ListResponse>(
        `/finance/expenses?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiPost("/finance/expenses", {
        description: form.description.trim(),
        recipient: form.recipient.trim(),
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        paymentMethod: form.paymentMethod,
      }),
    onSuccess: () => {
      toast.success("مصرف ثبت شد");
      setOpen(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
      void invalidateFinanceQueries(queryClient);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "ثبت مصرف ناموفق بود");
    },
  });

  const items = query.data?.items || [];

  return (
    <div>
      <PageHeader
        title="مصارف شرکت"
        subtitle="ثبت هزینه‌های عمومی — حساب ثبت‌کننده به‌صورت خودکار از کاربر واردشده تعیین می‌شود"
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">از</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[140px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">تا</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[140px]" />
            </div>
            {canCreate && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="size-4" />
                ثبت مصرف
              </Button>
            )}
          </div>
        }
      />

      {query.isLoading ? (
        <LoadingTable rows={6} columns={5} />
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
                <TableHead>حساب</TableHead>
                <TableHead>مبلغ</TableHead>
                {canDelete ? <TableHead></TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDate(row.expenseDate)}</TableCell>
                  <TableCell>
                    <div>{row.description || "—"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {paymentMethodLabel(row.paymentMethod)}
                    </div>
                  </TableCell>
                  <TableCell>{row.recipient || "—"}</TableCell>
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ثبت مصرف شرکت</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="expense-description">برای چی</Label>
              <Input
                id="expense-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expense-recipient">به کی</Label>
              <Input
                id="expense-recipient"
                value={form.recipient}
                onChange={(e) => setForm((f) => ({ ...f, recipient: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expense-amount">مبلغ</Label>
              <Input
                id="expense-amount"
                type="number"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="expense-date">تاریخ</Label>
                <Input
                  id="expense-date"
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>روش پرداخت</Label>
                <Select
                  value={form.paymentMethod}
                  onValueChange={(v) => setForm((f) => ({ ...f, paymentMethod: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
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
