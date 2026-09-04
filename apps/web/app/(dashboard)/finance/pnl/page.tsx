"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Settings2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useHasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PnlTargetDialog } from "../_components/pnl-target-dialog";
import { formatMoney, type PnlMonth, type PnlMonthSummary } from "../_components/types";

const MONTH_LABELS = [
  "ژانویه",
  "فوریه",
  "مارس",
  "آوریل",
  "مه",
  "ژوئن",
  "جولای",
  "آگوست",
  "سپتامبر",
  "اکتبر",
  "نوامبر",
  "دسامبر",
];

const PERFORMANCE_META = {
  INACTIVE: {
    label: "ماه غیرفعال — هدف ثبت نشده",
    hint: "برای شروع محاسبه سود و زیان این ماه، ابتدا «تنظیم هدف ماه» را انجام دهید.",
    tone: "muted" as const,
    icon: AlertCircle,
  },
  PROFIT: {
    label: "سودده در این ماه",
    hint: "سود خالص ماه مثبت است.",
    tone: "profit" as const,
    icon: TrendingUp,
  },
  LOSS: {
    label: "زیان‌ده در این ماه",
    hint: "سود خالص ماه منفی است.",
    tone: "loss" as const,
    icon: TrendingDown,
  },
  BREAK_EVEN: {
    label: "سربه‌سر در این ماه",
    hint: "سود خالص ماه صفر است.",
    tone: "muted" as const,
    icon: AlertCircle,
  },
};

function monthKey(year: number, month: number) {
  return `${year}-${month}`;
}

export default function FinancePnlPage() {
  const canEdit = useHasPermission("finance.edit");
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [targetOpen, setTargetOpen] = useState(false);

  const query = useQuery({
    queryKey: ["finance-pnl", year, month],
    queryFn: () => apiGet<PnlMonth>(`/finance/pnl?year=${year}&month=${month}`),
  });

  const historyQuery = useQuery({
    queryKey: ["finance-pnl-months"],
    queryFn: () => apiGet<{ items: PnlMonthSummary[] }>("/finance/pnl/months"),
  });

  const data = query.data;
  const performance = data?.performance ?? "INACTIVE";
  const perfMeta = PERFORMANCE_META[performance];

  const historyOptions = useMemo(() => {
    const items = historyQuery.data?.items ?? [];
    const current = monthKey(year, month);
    const seen = new Set<string>();
    const options: Array<{ year: number; month: number; label: string }> = [];

    for (const item of items) {
      const key = monthKey(item.year, item.month);
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({
        year: item.year,
        month: item.month,
        label: `${MONTH_LABELS[item.month - 1] || item.month} ${item.year}`,
      });
    }

    if (!seen.has(current)) {
      options.unshift({
        year,
        month,
        label: `${MONTH_LABELS[month - 1] || month} ${year} (جاری)`,
      });
    }

    return options;
  }, [historyQuery.data?.items, year, month]);

  function selectHistoricalMonth(value: string) {
    const [y, m] = value.split("-").map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return;
    setYear(y);
    setMonth(m);
  }

  return (
    <div>
      <PageHeader
        title="سود و زیان"
        subtitle="پیگیری ماهانه سود و زیان — هر ماه مستقل، بدون انتقال از ماه قبل"
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">سال</Label>
              <Input
                type="number"
                className="w-[100px]"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ماه</Label>
              <Input
                type="number"
                min={1}
                max={12}
                className="w-[80px]"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              />
            </div>
            {historyOptions.length > 0 ? (
              <div className="space-y-1">
                <Label className="text-xs">ماه‌های دارای هدف</Label>
                <Select
                  value={monthKey(year, month)}
                  onValueChange={selectHistoricalMonth}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="انتخاب سریع" />
                  </SelectTrigger>
                  <SelectContent>
                    {historyOptions.map((opt) => (
                      <SelectItem
                        key={monthKey(opt.year, opt.month)}
                        value={monthKey(opt.year, opt.month)}
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {canEdit ? (
              <Button
                type="button"
                className="self-end"
                onClick={() => setTargetOpen(true)}
              >
                <Settings2 className="size-4" />
                تنظیم هدف ماه
              </Button>
            ) : null}
          </div>
        }
      />

      {query.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-20 rounded-xl" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </div>
      ) : data ? (
        <>
          <Card
            className={cn(
              "mb-4 border-border/60",
              perfMeta.tone === "profit" && "border-emerald-500/30 bg-emerald-500/5",
              perfMeta.tone === "loss" && "border-destructive/30 bg-destructive/5",
              perfMeta.tone === "muted" && "border-border/50 bg-muted/20",
            )}
          >
            <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    perfMeta.tone === "profit" && "bg-emerald-500/15 text-emerald-700",
                    perfMeta.tone === "loss" && "bg-destructive/15 text-destructive",
                    perfMeta.tone === "muted" && "bg-muted text-muted-foreground",
                  )}
                >
                  <perfMeta.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{perfMeta.label}</p>
                  <p className="text-xs text-muted-foreground">{perfMeta.hint}</p>
                  {!data.trackingActive ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      تا زمان ثبت هدف، همه شاخص‌های این ماه روی{" "}
                      <span className="font-medium">۰</span> باقی می‌مانند.
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      محاسبه فقط بر اساس تراکنش‌های{" "}
                      {MONTH_LABELS[data.month - 1]} {data.year}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {data.trackingActive && data.targetMet != null ? (
                  <Badge variant={data.targetMet ? "default" : "destructive"}>
                    {data.targetMet ? "هدف محقق شد" : "زیر هدف"}
                  </Badge>
                ) : null}
                {data.isCurrentMonth ? (
                  <Badge variant="secondary">ماه جاری</Badge>
                ) : (
                  <Badge variant="outline">ماه تاریخی</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric
              label="دریافت شده (ماه)"
              value={data.actuals.received}
              inactive={!data.trackingActive}
            />
            <Metric
              label="هزینه مستقیم پروژه‌ها"
              value={data.actuals.directProjectCosts}
              inactive={!data.trackingActive}
            />
            <Metric
              label="سود پروژه"
              value={data.actuals.projectProfit}
              inactive={!data.trackingActive}
            />
            <Metric
              label="مصارف شرکت"
              value={data.actuals.companyExpenses}
              inactive={!data.trackingActive}
            />
            <Metric
              label="سود خالص"
              value={data.actuals.netCompanyProfit}
              emphasize
              inactive={!data.trackingActive}
              valueTone={
                !data.trackingActive
                  ? "default"
                  : data.actuals.netCompanyProfit > 0
                    ? "profit"
                    : data.actuals.netCompanyProfit < 0
                      ? "loss"
                      : "default"
              }
            />
            <Metric
              label="هدف سود خالص"
              value={data.target?.netProfitTarget ?? 0}
              inactive={!data.target}
            />
            <Metric
              label="بودجه تبلیغات"
              value={data.target?.advertisingBudget ?? 0}
              inactive={!data.target}
            />
            <Metric
              label="سود خالص ماه قبل"
              value={data.priorNetProfit ?? 0}
              inactive={data.priorNetProfit == null}
            />
          </div>

          {canEdit ? (
            <PnlTargetDialog
              open={targetOpen}
              onOpenChange={setTargetOpen}
              year={year}
              month={month}
              target={data.target}
            />
          ) : null}
        </>
      ) : (
        <p className="text-sm text-destructive">خطا در بارگذاری سود و زیان</p>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  emphasize,
  inactive,
  valueTone = "default",
}: {
  label: string;
  value: number;
  emphasize?: boolean;
  inactive?: boolean;
  valueTone?: "default" | "profit" | "loss";
}) {
  return (
    <Card
      className={cn(
        emphasize ? "border-brand/30 bg-brand-muted/30" : "border-border/50",
        inactive && "opacity-70",
      )}
    >
      <CardContent className="p-4">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1 text-xl font-black tabular-nums",
            valueTone === "profit" && "text-emerald-700 dark:text-emerald-400",
            valueTone === "loss" && "text-destructive",
          )}
        >
          {formatMoney(value)}
        </p>
      </CardContent>
    </Card>
  );
}
