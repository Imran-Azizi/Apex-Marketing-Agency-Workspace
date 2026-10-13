"use client";

import Link from "next/link";
import {
  ArrowUpLeft,
  CalendarCheck2,
  CalendarClock,
  Clapperboard,
  FileSignature,
  Image as ImageIcon,
  Timer,
} from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { CrmContractSummary } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

function formatCount(value: number | null | undefined) {
  if (value == null) return "—";
  return value.toLocaleString("fa-AF", { numberingSystem: "latn" });
}

function contractDurationDays(contract: CrmContractSummary): number | null {
  if (!contract.startDate || !contract.endDate) return null;
  const start = new Date(contract.startDate).getTime();
  const end = new Date(contract.endDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  return Math.round((end - start) / DAY_MS) + 1;
}

function ScopeTile({
  label,
  value,
  icon: Icon,
  ltr = false,
}: {
  label: string;
  value: string;
  icon: typeof Clapperboard;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <Icon className="size-4" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 text-start">
        <p className="text-[11px] font-semibold text-muted-foreground">
          {label}
        </p>
        <p
          dir={ltr ? "ltr" : undefined}
          className={cn(
            "mt-0.5 truncate text-sm font-bold text-foreground",
            ltr && "text-right tabular-nums [unicode-bidi:isolate]",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

/** Scope of a multi-video contract, shown inside the customer's contract details tab. */
export function ContractScopeOverview({
  contract,
}: {
  contract: CrmContractSummary;
}) {
  const duration = contractDurationDays(contract);

  return (
    <section className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 text-start">
          <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
            <FileSignature className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              مشخصات قرارداد چندویدیویی
            </h3>
            <p className="text-[11px] text-muted-foreground">
              اطلاعات ثبت‌شده هنگام ایجاد قرارداد
            </p>
          </div>
        </div>
        <Link
          href={`/projects/${contract.projectId}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand-muted/60 px-3 py-1 text-xs font-semibold text-brand transition-colors hover:bg-brand-muted"
        >
          <span dir="ltr" className="tabular-nums">
            {contract.code}
          </span>
          <ArrowUpLeft className="size-3.5" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <ScopeTile
          label="تعداد ویدیو"
          value={formatCount(contract.videoCount)}
          icon={Clapperboard}
        />
        <ScopeTile
          label="تعداد پوستر"
          value={formatCount(contract.posterCount)}
          icon={ImageIcon}
        />
        <ScopeTile
          label="تاریخ شروع"
          value={contract.startDate ? formatDate(contract.startDate) : "—"}
          icon={CalendarClock}
        />
        <ScopeTile
          label="تاریخ ختم"
          value={contract.endDate ? formatDate(contract.endDate) : "—"}
          icon={CalendarCheck2}
        />
        <ScopeTile
          label="مدت قرارداد"
          value={duration != null ? `${formatCount(duration)} روز` : "—"}
          icon={Timer}
        />
      </div>
    </section>
  );
}

/** Compact contract cell for the customer management table. */
export function ContractListCell({
  contract,
}: {
  contract: CrmContractSummary | null | undefined;
}) {
  if (!contract) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const scope = [
    contract.videoCount != null ? `${formatCount(contract.videoCount)} ویدیو` : null,
    contract.posterCount ? `${formatCount(contract.posterCount)} پوستر` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-w-[9rem] space-y-0.5 text-start">
      <p
        dir="ltr"
        className="text-right text-sm font-bold tabular-nums text-foreground [unicode-bidi:isolate]"
      >
        {contract.agreedPrice != null
          ? formatCurrency(contract.agreedPrice)
          : "—"}
      </p>
      {scope ? (
        <p className="text-xs text-muted-foreground">{scope}</p>
      ) : null}
      {contract.startDate && contract.endDate ? (
        <p className="text-[11px] text-muted-foreground">
          {formatDate(contract.startDate)} تا {formatDate(contract.endDate)}
        </p>
      ) : null}
    </div>
  );
}
