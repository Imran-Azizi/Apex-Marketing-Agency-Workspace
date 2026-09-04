import type { FinanceDashboard } from "@/app/(dashboard)/finance/_components/types";
import type { KpiMetric } from "@/components/dashboard/manager/types";
import { resolveDateRange } from "@/components/dashboard/manager/compute-metrics";
import type { DateRange } from "@/components/dashboard/manager/types";

function kpi(
  partial: Omit<KpiMetric, "tone"> & { tone?: KpiMetric["tone"] },
): KpiMetric {
  return { tone: "default", format: "number", ...partial };
}

/** Build `/finance/dashboard` URL for the manager dashboard date filter. */
export function financeDashboardQueryUrl(range: DateRange): string {
  const { from, to } = resolveDateRange(range);
  const params = new URLSearchParams();
  if (from) params.set("from", from.toISOString().slice(0, 10));
  if (to) params.set("to", to.toISOString().slice(0, 10));
  const qs = params.toString();
  return `/finance/dashboard${qs ? `?${qs}` : ""}`;
}

/** Map shared finance KPI payload → manager dashboard finance cards. */
export function managerFinanceCardsFromKpis(
  kpis: FinanceDashboard["kpis"],
): KpiMetric[] {
  return [
    kpi({
      key: "total_revenue",
      label: "مجموع درآمد",
      value: kpis.totalFinalPrice,
      description: "جمع مبلغ توافق‌شده پروژه‌ها",
      format: "currency",
      tone: "brand",
    }),
    kpi({
      key: "received",
      label: "پرداخت‌های دریافت‌شده",
      value: kpis.received,
      description: "پرداخت‌های Verified در بازه",
      format: "currency",
      tone: "info",
    }),
    kpi({
      key: "outstanding",
      label: "پرداخت‌های باقی‌مانده",
      value: kpis.receivable,
      description: "مانده قابل وصول",
      format: "currency",
      tone: "warning",
    }),
    kpi({
      key: "expenses",
      label: "هزینه‌ها",
      value: kpis.directProjectCosts,
      description: "هزینه ادیت، نریشن و مستقیم",
      format: "currency",
      tone: "danger",
    }),
    kpi({
      key: "narrator_cost",
      label: "مجموع هزینه نریتور",
      value: kpis.narratorCost,
      description: "پرداخت‌های مربوط به نریتورها",
      format: "currency",
      tone: "warning",
    }),
    kpi({
      key: "editor_cost",
      label: "مجموع هزینه ادیتور",
      value: kpis.editorCost,
      description: "پرداخت‌های مربوط به ادیتورها",
      format: "currency",
      tone: "info",
    }),
    kpi({
      key: "net_profit",
      label: "سود پروژه",
      value: kpis.projectProfit,
      description: "قیمت پروژه منهای هزینه‌های مستقیم",
      format: "currency",
      tone: kpis.projectProfit >= 0 ? "success" : "danger",
    }),
  ];
}

export function financeKpisAvailable(kpis: FinanceDashboard["kpis"]): boolean {
  return (
    kpis.totalFinalPrice > 0 ||
    kpis.received > 0 ||
    kpis.directProjectCosts > 0 ||
    kpis.companyExpenses > 0
  );
}
