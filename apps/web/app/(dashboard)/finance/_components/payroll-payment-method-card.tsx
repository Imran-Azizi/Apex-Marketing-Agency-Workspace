"use client";

import { Badge } from "@/components/ui/badge";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";
import { formatMoney } from "./types";

export type PayrollPaymentMethodMetaRow = {
  label: string;
  value: string;
  ltr?: boolean;
};

type PayrollPaymentMethodCardProps = {
  method?: string | null;
  methodLabel?: string | null;
  amount?: number | null;
  metaRows?: PayrollPaymentMethodMetaRow[] | null;
  /** When false, only method + meta are shown (history tables already have an amount column). */
  showAmount?: boolean;
  className?: string;
  compact?: boolean;
};

function MetaLine({ row }: { row: PayrollPaymentMethodMetaRow }) {
  return (
    <div
      className="flex flex-wrap items-baseline gap-x-1.5 text-[11px] leading-snug"
      dir="rtl"
      title={`${row.label}: ${row.value}`}
    >
      <span className="shrink-0 text-muted-foreground">{row.label}</span>
      <span className="shrink-0 text-muted-foreground/50" aria-hidden>
        ·
      </span>
      <span
        className="min-w-0 break-all font-medium tabular-nums text-foreground"
        dir={row.ltr ? "ltr" : "rtl"}
      >
        {row.value}
      </span>
    </div>
  );
}

export function PayrollPaymentMethodCard({
  method,
  methodLabel: methodLabelProp,
  amount,
  metaRows,
  showAmount = true,
  className,
  compact = false,
}: PayrollPaymentMethodCardProps) {
  if (!method) {
    return (
      <span
        className={cn(
          "inline-flex rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground",
          className,
        )}
      >
        ثبت نشده
      </span>
    );
  }

  const label = methodLabelProp || paymentMethodLabel(method) || method;
  const rows = metaRows?.filter((r) => r?.value?.trim()) || [];
  const tipParts = [label];
  if (showAmount && amount != null) tipParts.push(formatMoney(amount));
  if (rows[0]) tipParts.push(`${rows[0].label}: ${rows[0].value}`);

  return (
    <div
      className={cn(
        "flex flex-col items-stretch gap-2 rounded-xl border border-border/60 bg-muted/30 text-start",
        compact ? "w-[10rem] px-2.5 py-2" : "min-w-[11rem] max-w-[16rem] px-3 py-2.5",
        className,
      )}
      dir="rtl"
      title={tipParts.join(" · ")}
    >
      <Badge
        variant="secondary"
        className="w-fit max-w-full truncate rounded-full border-0 bg-secondary/90 px-2.5 py-0.5 text-[11px] font-semibold leading-5 text-secondary-foreground"
      >
        {label}
      </Badge>

      {showAmount && amount != null ? (
        <div className="text-sm font-semibold tabular-nums tracking-tight text-foreground">
          {formatMoney(amount)}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="space-y-1">
          {rows.map((row) => (
            <MetaLine key={`${row.label}-${row.value}`} row={row} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
