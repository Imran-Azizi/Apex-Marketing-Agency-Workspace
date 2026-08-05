"use client";

import { Banknote, Coins, Mic2, Scissors, TrendingUp, Wallet } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

export type ProjectFinanceSummary = {
  agreedPrice?: string | number | null;
  received?: string | number | null;
  narratorCost?: string | number | null;
  editorCost?: string | number | null;
  otherDirectCosts?: string | number | null;
  balance?: number | null;
  profit?: number | null;
};

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function MoneyValue({
  value,
  className,
  empty = "—",
}: {
  value: number | null;
  className?: string;
  empty?: string;
}) {
  if (value == null) {
    return <span className={cn("text-muted-foreground", className)}>{empty}</span>;
  }
  return (
    <bdi dir="ltr" className={cn("inline-block tabular-nums", className)}>
      {formatCurrency(value)}
    </bdi>
  );
}

function HighlightCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: number | null;
  icon: typeof Banknote;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "brand"
      ? "border-brand/25 from-brand/[0.08] to-card"
      : tone === "success"
        ? "border-emerald-500/25 from-emerald-500/[0.08] to-card"
        : tone === "warning"
          ? "border-amber-500/25 from-amber-500/[0.08] to-card"
          : tone === "danger"
            ? "border-rose-500/25 from-rose-500/[0.08] to-card"
            : "border-border/70 from-muted/40 to-card";

  const iconClass =
    tone === "brand"
      ? "bg-brand/10 text-brand"
      : tone === "success"
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        : tone === "warning"
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : tone === "danger"
            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
            : "bg-muted text-muted-foreground";

  const valueClass =
    tone === "brand"
      ? "text-brand"
      : tone === "success"
        ? "text-emerald-700 dark:text-emerald-300"
        : tone === "warning"
          ? "text-amber-700 dark:text-amber-300"
          : tone === "danger"
            ? "text-rose-700 dark:text-rose-300"
            : "text-foreground";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-b p-4 shadow-sm sm:p-5",
        toneClass,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">
            {label}
          </p>
          <p className={cn("text-xl font-bold tracking-tight sm:text-2xl", valueClass)}>
            <MoneyValue value={value} />
          </p>
        </div>
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            iconClass,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function CostRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | null;
  icon: typeof Mic2;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-3.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>
      <p className="shrink-0 text-sm font-semibold">
        <MoneyValue value={value} />
      </p>
    </div>
  );
}

export function ProjectFinancePanel({ finance }: { finance: ProjectFinanceSummary | null | undefined }) {
  if (!finance) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
        اطلاعات پرداخت در دسترس نیست
      </div>
    );
  }

  const agreedPrice = toNumber(finance.agreedPrice);
  const received = toNumber(finance.received);
  const narratorCost = toNumber(finance.narratorCost);
  const editorCost = toNumber(finance.editorCost);
  const otherDirectCosts = toNumber(finance.otherDirectCosts);
  const balance = finance.balance != null && Number.isFinite(finance.balance)
    ? finance.balance
    : agreedPrice != null && received != null
      ? Math.max(0, agreedPrice - received)
      : null;
  const profit = finance.profit != null && Number.isFinite(finance.profit)
    ? finance.profit
    : null;

  const balanceTone =
    balance == null ? "neutral" : balance <= 0 ? "success" : "warning";
  const profitTone =
    profit == null ? "neutral" : profit >= 0 ? "success" : "danger";

  return (
    <div dir="rtl" className="space-y-5 text-start">
      <div className="space-y-1 border-b border-border/60 pb-3">
        <h3 className="text-base font-semibold">خلاصه پرداخت پروژه</h3>
        <p className="text-xs text-muted-foreground sm:text-sm">
          قیمت توافقی، دریافتی‌ها، هزینه‌ها، مانده و سود
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HighlightCard
          label="قیمت توافقی"
          value={agreedPrice}
          icon={Banknote}
          tone="brand"
        />
        <HighlightCard
          label="دریافت‌شده"
          value={received}
          icon={Wallet}
          tone="neutral"
        />
        <HighlightCard
          label="مانده"
          value={balance}
          icon={Coins}
          tone={balanceTone}
        />
        <HighlightCard
          label="سود"
          value={profit}
          icon={TrendingUp}
          tone={profitTone}
        />
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">هزینه‌های مستقیم</h4>
          <span className="text-[11px] text-muted-foreground">بر اساس تخصیص تیم</span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <CostRow label="هزینه گوینده" value={narratorCost} icon={Mic2} />
          <CostRow label="هزینه ادیتور" value={editorCost} icon={Scissors} />
          <CostRow label="سایر هزینه‌ها" value={otherDirectCosts} icon={Coins} />
        </div>
      </div>
    </div>
  );
}
