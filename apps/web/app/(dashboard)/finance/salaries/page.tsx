"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, ApiError } from "@/lib/api";
import { invalidateFinanceQueries } from "@/lib/finance-queries";
import { CUSTOMER_PAYMENT_METHODS } from "@/lib/payment-methods";
import { useHasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingTable } from "@/components/shared/loading-table";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { formatMoney, type PayrollEmployee } from "../_components/types";
import {
  PayrollEmployeeDetailsModal,
  compensationTypeLabel,
  payrollKindLabel,
  payrollPaymentStatus,
} from "../_components/payroll-employee-details-modal";

type PayrollResponse = {
  fixed: PayrollEmployee[];
  projectShare: PayrollEmployee[];
  totals: { payable: number; paid: number; openAdvances: number };
};

type SalaryTab = "FIXED" | "PROJECT_SHARE";

export default function FinanceSalariesPage() {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission("finance.create");
  const canEdit = useHasPermission("finance.edit");
  const [tab, setTab] = useState<SalaryTab>("PROJECT_SHARE");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [compOpen, setCompOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [paidAt, setPaidAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [compType, setCompType] = useState<"FIXED" | "PROJECT_SHARE">(
    "PROJECT_SHARE",
  );
  const [fixedAmount, setFixedAmount] = useState("");

  const query = useQuery({
    queryKey: ["finance-payroll"],
    queryFn: () => apiGet<PayrollResponse>("/finance/payroll"),
  });

  const rows = useMemo(() => {
    if (!query.data) return [] as PayrollEmployee[];
    return tab === "FIXED" ? query.data.fixed : query.data.projectShare;
  }, [query.data, tab]);

  const selected = useMemo(
    () => rows.find((r) => r.teamProfileId === selectedId) || null,
    [rows, selectedId],
  );

  const tabTotals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.payable += Number(row.netPayable || 0);
        acc.paid += Number(row.paidTotal || 0);
        acc.openAdvances += Number(row.openAdvances || 0);
        return acc;
      },
      { payable: 0, paid: 0, openAdvances: 0 },
    );
  }, [rows]);

  useEffect(() => {
    if (selectedId && !rows.some((r) => r.teamProfileId === selectedId)) {
      setSelectedId(null);
      setDetailsOpen(false);
      setPayOpen(false);
      setAdvanceOpen(false);
      setCompOpen(false);
    }
  }, [rows, selectedId]);

  function handleTabChange(next: string) {
    setTab(next as SalaryTab);
    setSelectedId(null);
    setDetailsOpen(false);
    setPayOpen(false);
    setAdvanceOpen(false);
    setCompOpen(false);
  }

  function openDetails(row: PayrollEmployee) {
    setSelectedId(row.teamProfileId);
    setCompType(row.compensation.type);
    setFixedAmount(String(row.compensation.fixedMonthlyAmount || ""));
    setDetailsOpen(true);
  }

  const payMutation = useMutation({
    mutationFn: () =>
      apiPost("/finance/payroll/payments", {
        teamProfileId: selected!.teamProfileId,
        amount: Number(amount),
        method,
        paidAt,
        notes: notes || null,
      }),
    onSuccess: () => {
      toast.success("پرداخت معاش ثبت شد");
      setPayOpen(false);
      setAmount("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["finance-payroll"] });
      void invalidateFinanceQueries(queryClient);
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : "ثبت پرداخت ناموفق بود",
      );
    },
  });

  const advanceMutation = useMutation({
    mutationFn: () =>
      apiPost("/finance/payroll/advances", {
        teamProfileId: selected!.teamProfileId,
        amount: Number(amount),
        method,
        paidAt,
        notes: notes || null,
      }),
    onSuccess: () => {
      toast.success("پیش‌پرداخت ثبت شد");
      setAdvanceOpen(false);
      setAmount("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["finance-payroll"] });
      void invalidateFinanceQueries(queryClient);
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : "ثبت پیش‌پرداخت ناموفق بود",
      );
    },
  });

  const settleMutation = useMutation({
    mutationFn: (id: string) =>
      apiPost(`/finance/payroll/advances/${id}/settle`),
    onSuccess: () => {
      toast.success("پیش‌پرداخت تسویه شد");
      queryClient.invalidateQueries({ queryKey: ["finance-payroll"] });
    },
  });

  const compMutation = useMutation({
    mutationFn: () =>
      apiPut("/finance/payroll/compensation", {
        teamProfileId: selected!.teamProfileId,
        type: compType,
        fixedMonthlyAmount: Number(fixedAmount || 0),
      }),
    onSuccess: () => {
      toast.success("نوع معاش به‌روز شد");
      setCompOpen(false);
      queryClient.invalidateQueries({ queryKey: ["finance-payroll"] });
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : "به‌روزرسانی ناموفق بود",
      );
    },
  });

  const fixedCount = query.data?.fixed.length ?? 0;
  const projectCount = query.data?.projectShare.length ?? 0;

  return (
    <div className="space-y-5 text-start" dir="rtl">
      <PageHeader
        title="معاشات کارمندان"
        subtitle="جداسازی کارمندان معاش ثابت و پروژه‌ای با جزئیات پرداخت و تاریخچه پروژه"
      />

      {query.data ? (
        <div className="grid gap-3 sm:grid-cols-3" dir="rtl">
          <SummaryCard label="قابل پرداخت" value={tabTotals.payable} />
          <SummaryCard label="پرداخت‌شده" value={tabTotals.paid} />
          <SummaryCard label="پیش‌پرداخت باز" value={tabTotals.openAdvances} />
        </div>
      ) : null}

      <Tabs
        dir="rtl"
        value={tab}
        onValueChange={handleTabChange}
        className="space-y-4"
      >
        <TabsList
          variant="segmented"
          className="w-full justify-start sm:w-auto"
          dir="rtl"
        >
          <TabsTrigger
            variant="segmented"
            value="PROJECT_SHARE"
            className="gap-2"
          >
            کارمندان پروژه‌ای
            <span className="rounded-md bg-background/70 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {projectCount.toLocaleString("fa-AF", {
                numberingSystem: "latn",
              })}
            </span>
          </TabsTrigger>
          <TabsTrigger variant="segmented" value="FIXED" className="gap-2">
            کارمندان معاش ثابت
            <span className="rounded-md bg-background/70 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {fixedCount.toLocaleString("fa-AF", { numberingSystem: "latn" })}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="PROJECT_SHARE" className="mt-0 space-y-3">
          {query.isLoading ? (
            <LoadingTable rows={6} columns={6} />
          ) : (query.data?.projectShare.length ?? 0) === 0 ? (
            <EmptyState
              title="کارمند پروژه‌ای یافت نشد"
              description="کارمندانی که جبران‌خدمت‌شان بر اساس پروژه است اینجا نمایش داده می‌شوند."
            />
          ) : (
            <ProjectShareTable
              rows={query.data!.projectShare}
              onSelect={openDetails}
            />
          )}
        </TabsContent>

        <TabsContent value="FIXED" className="mt-0 space-y-3">
          {query.isLoading ? (
            <LoadingTable rows={6} columns={7} />
          ) : (query.data?.fixed.length ?? 0) === 0 ? (
            <EmptyState
              title="کارمند معاش ثابت یافت نشد"
              description="کارمندانی که معاش ماهانه ثابت دارند اینجا نمایش داده می‌شوند."
            />
          ) : (
            <FixedSalaryTable rows={query.data!.fixed} onSelect={openDetails} />
          )}
        </TabsContent>
      </Tabs>

      <PayrollEmployeeDetailsModal
        employee={selected}
        open={
          detailsOpen && !!selected && !payOpen && !advanceOpen && !compOpen
        }
        onOpenChange={(v) => {
          setDetailsOpen(v);
          if (!v && !payOpen && !advanceOpen && !compOpen) {
            setSelectedId(null);
          }
        }}
        canCreate={canCreate}
        canEdit={canEdit}
        onPay={() => setPayOpen(true)}
        onAdvance={() => setAdvanceOpen(true)}
        onComp={() => setCompOpen(true)}
        onSettleAdvance={(id) => settleMutation.mutate(id)}
        settlePending={settleMutation.isPending}
      />

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="text-start sm:max-w-md" dir="rtl">
          <DialogHeader className="text-start">
            <DialogTitle className="text-start">
              ثبت پرداخت معاش — {selected?.displayName}
            </DialogTitle>
          </DialogHeader>
          <PayFields
            amount={amount}
            setAmount={setAmount}
            method={method}
            setMethod={setMethod}
            paidAt={paidAt}
            setPaidAt={setPaidAt}
            notes={notes}
            setNotes={setNotes}
          />
          <DialogFooter className="gap-2 sm:justify-start">
            <Button variant="outline" onClick={() => setPayOpen(false)}>
              انصراف
            </Button>
            <Button
              disabled={payMutation.isPending}
              onClick={() => payMutation.mutate()}
            >
              ذخیره
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent className="text-start sm:max-w-md" dir="rtl">
          <DialogHeader className="text-start">
            <DialogTitle className="text-start">
              ثبت پیش‌پرداخت — {selected?.displayName}
            </DialogTitle>
          </DialogHeader>
          <PayFields
            amount={amount}
            setAmount={setAmount}
            method={method}
            setMethod={setMethod}
            paidAt={paidAt}
            setPaidAt={setPaidAt}
            notes={notes}
            setNotes={setNotes}
          />
          <DialogFooter className="gap-2 sm:justify-start">
            <Button variant="outline" onClick={() => setAdvanceOpen(false)}>
              انصراف
            </Button>
            <Button
              disabled={advanceMutation.isPending}
              onClick={() => advanceMutation.mutate()}
            >
              ذخیره
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={compOpen} onOpenChange={setCompOpen}>
        <DialogContent className="text-start sm:max-w-md" dir="rtl">
          <DialogHeader className="text-start">
            <DialogTitle className="text-start">
              نوع معاش — {selected?.displayName}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 text-start">
            <div className="space-y-1">
              <Label>نوع</Label>
              <Select
                dir="rtl"
                value={compType}
                onValueChange={(v) =>
                  setCompType(v as "FIXED" | "PROJECT_SHARE")
                }
              >
                <SelectTrigger dir="rtl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="PROJECT_SHARE">پروژه‌ای</SelectItem>
                  <SelectItem value="FIXED">معاش ثابت</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {compType === "FIXED" ? (
              <div className="space-y-1">
                <Label>مبلغ ماهانه</Label>
                <Input
                  type="number"
                  dir="ltr"
                  className="text-start"
                  value={fixedAmount}
                  onChange={(e) => setFixedAmount(e.target.value)}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button variant="outline" onClick={() => setCompOpen(false)}>
              انصراف
            </Button>
            <Button
              disabled={compMutation.isPending}
              onClick={() => compMutation.mutate()}
            >
              ذخیره
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectShareTable({
  rows,
  onSelect,
}: {
  rows: PayrollEmployee[];
  onSelect: (row: PayrollEmployee) => void;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-border/60 bg-card"
      dir="rtl"
    >
      <Table dir="rtl">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="text-start">نام</TableHead>
            <TableHead className="text-start">نقش</TableHead>
            <TableHead className="text-start">تعداد پروژه‌ها</TableHead>
            <TableHead className="text-start">مبلغ قابل پرداخت</TableHead>
            <TableHead className="text-start">مبلغ پرداخت‌شده</TableHead>
            <TableHead className="w-[7rem] text-start">جزئیات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.teamProfileId}
              className="cursor-pointer"
              onClick={() => onSelect(row)}
            >
              <TableCell className="text-start">
                <div className="font-medium">{row.displayName}</div>
                <div className="text-[11px] text-muted-foreground">
                  {compensationTypeLabel(row.compensation.type)}
                </div>
              </TableCell>
              <TableCell className="text-start">
                {payrollKindLabel(row.kind)}
              </TableCell>
              <TableCell className="text-start tabular-nums">
                {row.projectsCompletedCount.toLocaleString("fa-AF", {
                  numberingSystem: "latn",
                })}
              </TableCell>
              <TableCell className="text-start font-medium tabular-nums text-amber-800 dark:text-amber-300">
                {formatMoney(row.netPayable)}
              </TableCell>
              <TableCell className="text-start tabular-nums text-emerald-700 dark:text-emerald-300">
                {formatMoney(row.paidTotal)}
              </TableCell>
              <TableCell className="text-start">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(row);
                  }}
                >
                  جزئیات
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FixedSalaryTable({
  rows,
  onSelect,
}: {
  rows: PayrollEmployee[];
  onSelect: (row: PayrollEmployee) => void;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-border/60 bg-card"
      dir="rtl"
    >
      <Table dir="rtl">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="text-start">نام</TableHead>
            <TableHead className="text-start">نقش</TableHead>
            <TableHead className="text-start">معاش ثابت</TableHead>
            <TableHead className="text-start">پرداخت‌شده</TableHead>
            <TableHead className="text-start">مانده</TableHead>
            <TableHead className="text-start">وضعیت</TableHead>
            <TableHead className="text-start">آخرین پرداخت</TableHead>
            <TableHead className="w-[7rem] text-start">جزئیات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const remaining = row.remaining ?? row.netPayable;
            const status = payrollPaymentStatus(remaining, row.paidTotal);
            return (
              <TableRow
                key={row.teamProfileId}
                className="cursor-pointer"
                onClick={() => onSelect(row)}
              >
                <TableCell className="text-start">
                  <div className="font-medium">{row.displayName}</div>
                  {row.openAdvances > 0 ? (
                    <div className="text-[11px] text-amber-700 dark:text-amber-400">
                      پیش‌پرداخت: {formatMoney(row.openAdvances)}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-start">
                  {payrollKindLabel(row.kind)}
                </TableCell>
                <TableCell className="text-start tabular-nums font-medium">
                  {formatMoney(row.compensation.fixedMonthlyAmount)}
                </TableCell>
                <TableCell className="text-start tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatMoney(row.paidTotal)}
                </TableCell>
                <TableCell className="text-start tabular-nums text-amber-800 dark:text-amber-300">
                  {formatMoney(remaining)}
                </TableCell>
                <TableCell className="text-start">
                  <Badge variant={status.variant} className="font-normal">
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-start text-sm text-muted-foreground">
                  {row.lastPaymentAt ? formatDate(row.lastPaymentAt) : "—"}
                </TableCell>
                <TableCell className="text-start">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(row);
                    }}
                  >
                    جزئیات
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-xl border border-border/50 bg-card p-3 text-start"
      dir="rtl"
    >
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">
        {formatMoney(value)}
      </p>
    </div>
  );
}

function PayFields({
  amount,
  setAmount,
  method,
  setMethod,
  paidAt,
  setPaidAt,
  notes,
  setNotes,
}: {
  amount: string;
  setAmount: (v: string) => void;
  method: string;
  setMethod: (v: string) => void;
  paidAt: string;
  setPaidAt: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
}) {
  return (
    <div className="grid gap-3 py-2 text-start" dir="rtl">
      <div className="space-y-1">
        <Label>مبلغ</Label>
        <Input
          type="number"
          dir="ltr"
          className="text-start"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>روش</Label>
          <Select dir="rtl" value={method} onValueChange={setMethod}>
            <SelectTrigger dir="rtl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent dir="rtl">
              {CUSTOMER_PAYMENT_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>تاریخ</Label>
          <Input
            type="date"
            dir="ltr"
            className="text-start"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label>توضیح</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </div>
  );
}
