"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { STAGE_LABELS } from "./constants";
import { crmSalesText, type CrmSalesCopyKey } from "./copy";
import type { CrmDashboardStats } from "./types";

const STAGE_CARDS = [
  "NEW_LEAD",
  "CONTACTED",
  "INFORMATION_SENT",
  "PROPOSAL_PRICE_SENT",
  "WAITING_DECISION",
  "ORDER_CONFIRMED",
  "DEPOSIT_PENDING",
  "DEPOSIT_CONFIRMED",
  "REPEAT_CUSTOMER",
  "LOST_CANCELED",
] as const;

const CATEGORY_CARDS = [
  {
    code: "GHOST",
    labelKey: "categoryGhost",
    tone: "ghost",
  },
  {
    code: "INTERESTED",
    labelKey: "categoryInterested",
    tone: "interested",
  },
  {
    code: "FOLLOW_UP",
    labelKey: "categoryFollowUp",
    tone: "follow",
  },
  {
    code: "OUR_CUSTOMERS",
    labelKey: "categoryOurCustomers",
    tone: "brand",
    href: "/crm",
  },
] as const;

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "brand" | "ghost";
}) {
  return (
    <Card
      className={
        tone === "brand"
          ? "border-brand/25 bg-brand-muted/40"
          : tone === "ghost"
            ? "border-border/60 bg-muted/30"
            : "border-border/50"
      }
    >
      <CardContent className="p-3 sm:p-4">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-black tabular-nums tracking-tight sm:text-2xl">
          {value.toLocaleString("fa-AF", { numberingSystem: "latn" })}
        </p>
      </CardContent>
    </Card>
  );
}

function CategoryCardContent({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <CardContent className="p-3 sm:p-4">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-black tabular-nums tracking-tight">
        {value.toLocaleString("fa-AF", { numberingSystem: "latn" })}
      </p>
    </CardContent>
  );
}

export function CrmDashboardStats({
  stats,
  loading,
  selectedCategory,
  onSelectCategory,
}: {
  stats?: CrmDashboardStats;
  loading?: boolean;
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const stages = stats?.stages || {};
  const categories = stats?.categories;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {CATEGORY_CARDS.map((item) => {
            const selected = selectedCategory === item.code;
            const label = crmSalesText(item.labelKey as CrmSalesCopyKey);
            const value = categories?.[item.code] || 0;
            const cardClass = cn(
              "h-full transition-colors",
              item.tone === "brand" && "border-brand/25 bg-brand-muted/30",
              item.tone === "ghost" && "border-border/60 bg-muted/30",
              item.tone === "interested" &&
                "border-emerald-500/20 bg-emerald-500/5",
              item.tone === "follow" && "border-amber-500/25 bg-amber-500/5",
              selected && "ring-2 ring-brand ring-offset-2 ring-offset-background",
              "hover:border-brand/40 hover:bg-brand-muted/20",
            );

            if ("href" in item && item.href) {
              return (
                <Link
                  key={item.code}
                  href={item.href}
                  className="group block text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
                  aria-label={`${label} — مدیریت مشتریان`}
                >
                  <Card
                    className={cn(
                      cardClass,
                      "cursor-pointer group-hover:border-brand/45 group-hover:shadow-sm",
                    )}
                  >
                    <CategoryCardContent label={label} value={value} />
                  </Card>
                </Link>
              );
            }

            return (
              <button
                key={item.code}
                type="button"
                onClick={() => onSelectCategory?.(item.code)}
                className="rounded-xl text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-pressed={selected}
              >
                <Card className={cn(cardClass, "cursor-pointer")}>
                  <CategoryCardContent label={label} value={value} />
                </Card>
              </button>
            );
          })}
        </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="کل سرنخ‌ها" value={stats?.total || 0} tone="brand" />
        {STAGE_CARDS.map((code) => (
          <StatCard
            key={code}
            label={STAGE_LABELS[code]}
            value={stages[code] || 0}
          />
        ))}
      </div>
    </div>
  );
}
