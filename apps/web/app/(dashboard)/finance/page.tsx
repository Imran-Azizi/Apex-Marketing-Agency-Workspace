"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangePills } from "@/components/shared/date-range-pills";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  dateRangeQueryParams,
  isDateRangeReady,
  type DateRange,
} from "@/lib/date-range";
import { financeDashboardQueryUrl } from "@/lib/finance-kpis";
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
  type FinanceDashboard,
} from "./_components/types";

const DEFAULT_RANGE: DateRange = {
  preset: "month",
  from: null,
  to: null,
};

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
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);

  const query = useQuery({
    queryKey: ["finance-dashboard", range.preset, dateRangeQueryParams(range)],
    queryFn: () => apiGet<FinanceDashboard>(financeDashboardQueryUrl(range)),
    enabled: isDateRangeReady(range),
    placeholderData: keepPreviousData,
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
      <div className="mb-6 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          className="mb-0 sm:mb-0"
          title="داشبورد مالی"
          subtitle="عواید، مصارف، سود و معاشات — مطابق شاخص‌های بخش مالی"
        />
        <DateRangePills
          range={range}
          onChange={setRange}
          className="lg:items-end"
          ariaLabel="فیلتر بازه زمانی داشبورد مالی"
        />
      </div>

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
          <div
            className={cn(
              "grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
              query.isFetching && "opacity-80",
            )}
          >
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
