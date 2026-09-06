"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  endOfMonth,
  formatMoney,
  startOfMonth,
  toInputDate,
  type FinanceDashboard,
} from "./_components/types";

const KPI_DEFS: Array<{
  key: keyof FinanceDashboard["kpis"] | "employeePayable" | "employeePaid";
  label: string;
  hint: string;
}> = [
  {
    key: "totalProjectReceipts",
    label: "مجموع دریافتی پروژه‌ها",
    hint: "جمع مبلغ کل پروژه‌ها (قرارداد)",
  },
  {
    key: "received",
    label: "دریافت شده",
    hint: "جمع Paymentهای Verified",
  },
  {
    key: "receivable",
    label: "قابل دریافت",
    hint: "جمع مانده مشتریان",
  },
  {
    key: "directProjectCosts",
    label: "هزینه‌های مستقیم پروژه‌ها",
    hint: "نریتور + ادیتور + جانبی",
  },
  {
    key: "projectProfit",
    label: "سود پروژه",
    hint: "قیمت پروژه − هزینه‌های مستقیم",
  },
  {
    key: "companyExpenses",
    label: "مصارف شرکت",
    hint: "هزینه‌های عمومی",
  },
  {
    key: "netCompanyProfit",
    label: "سود خالص شرکت",
    hint: "سود پروژه − مصارف شرکت",
  },
  {
    key: "employeePayable",
    label: "معاش قابل پرداخت",
    hint: "به تفکیک هر کارمند در جدول زیر",
  },
];

function kpiValue(data: FinanceDashboard, key: (typeof KPI_DEFS)[number]["key"]) {
  if (key === "employeePayable") return data.kpis.employeeSalaries.payable;
  if (key === "employeePaid") return data.kpis.employeeSalaries.paid;
  return data.kpis[key] as number;
}

export default function FinanceDashboardPage() {
  const [from, setFrom] = useState(() => toInputDate(startOfMonth()));
  const [to, setTo] = useState(() => toInputDate(endOfMonth()));

  const query = useQuery({
    queryKey: ["finance-dashboard", from, to],
    queryFn: () =>
      apiGet<FinanceDashboard>(
        `/finance/dashboard?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
  });

  const data = query.data;

  const cards = useMemo(() => {
    if (!data) return [];
    return KPI_DEFS.map((def) => ({
      ...def,
      value: kpiValue(data, def.key),
    }));
  }, [data]);

  return (
    <div>
      <PageHeader
        title="داشبورد مالی"
        subtitle="عواید، مصارف، سود و معاشات — مطابق شاخص‌های بخش مالی"
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">از تاریخ</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">تا تاریخ</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-[150px]"
              />
            </div>
          </div>
        }
      />

      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <p className="text-sm text-destructive">خطا در بارگذاری داشبورد مالی</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <Card key={card.key} className="border-border/50">
                <CardContent className="p-4">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="mt-1 text-xl font-black tabular-nums tracking-tight">
                    {formatMoney(card.value)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {card.hint}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">معاش کارمندان (خلاصه)</h2>
              <Link
                href="/finance/salaries"
                className="text-xs font-medium text-brand hover:underline"
              >
                مشاهده جزئیات
              </Link>
            </div>
            <div className="overflow-hidden rounded-xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>کارمند</TableHead>
                    <TableHead>نوع</TableHead>
                    <TableHead>قابل پرداخت</TableHead>
                    <TableHead>پرداخت شده</TableHead>
                    <TableHead>پیش‌پرداخت باز</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.employeeBreakdown || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        کارمندی ثبت نشده است
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.employeeBreakdown.map((row) => (
                      <TableRow key={row.teamProfileId}>
                        <TableCell className="font-medium">{row.displayName}</TableCell>
                        <TableCell>
                          {row.compensationType === "FIXED"
                            ? "معاش ثابت"
                            : "سهم پروژه"}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatMoney(row.payable)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatMoney(row.paid)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatMoney(row.openAdvances)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
