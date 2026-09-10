import type { FinanceDashboard } from "@/app/(dashboard)/finance/_components/types";
import type { KpiMetric } from "@/components/dashboard/manager/types";
import { dateRangeQueryParams, type DateRange } from "@/lib/date-range";

function kpi(
  partial: Omit<KpiMetric, "tone"> & { tone?: KpiMetric["tone"] },
): KpiMetric {
  return { tone: "default", format: "number", ...partial };
}

/** Build `/finance/dashboard` URL for date-filtered KPI requests. */
export function financeDashboardQueryUrl(range: DateRange): string {
  const { from, to } = dateRangeQueryParams(range);
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
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
      value: Number(kpis.totalFinalPrice) || 0,
      description: "جمع مبلغ توافق‌شده قراردادها",
      format: "currency",
      tone: "brand",
      href: "/finance/projects",
    }),
    kpi({
      key: "received",
      label: "پرداخت‌های دریافت‌شده",
      value: Number(kpis.received) || 0,
      description: "فقط پرداخت‌های تأییدشده (Verified)",
      format: "currency",
      tone: "info",
      href: "/finance",
    }),
    kpi({
      key: "outstanding",
      label: "مانده قابل وصول",
      value: Number(kpis.receivable) || 0,
      description: "قرارداد منهای دریافتی تأییدشده",
      format: "currency",
      tone: "warning",
      href: "/finance/projects",
    }),
    kpi({
      key: "expenses",
      label: "هزینه‌های مستقیم",
      value: Number(kpis.directProjectCosts) || 0,
      description: "نریتور + ادیتور + هزینه‌های جانبی",
      format: "currency",
      tone: "danger",
      href: "/finance/expenses",
    }),
    kpi({
      key: "company_expenses",
      label: "مصارف شرکت",
      value: Number(kpis.companyExpenses) || 0,
      description: "هزینه‌های عمومی شرکت",
      format: "currency",
      tone: "danger",
      href: "/finance/expenses",
    }),
    kpi({
      key: "narrator_cost",
      label: "هزینه نریتور",
      value: Number(kpis.narratorCost) || 0,
      description: "جمع هزینه نریشن پروژه‌ها",
      format: "currency",
      tone: "warning",
    }),
    kpi({
      key: "editor_cost",
      label: "هزینه ادیتور",
      value: Number(kpis.editorCost) || 0,
      description: "جمع هزینه ادیت پروژه‌ها",
      format: "currency",
      tone: "info",
    }),
    kpi({
      key: "project_profit",
      label: "سود پروژه",
      value: Number(kpis.projectProfit) || 0,
      description: "درآمد قرارداد منهای هزینه‌های مستقیم",
      format: "currency",
      tone: kpis.projectProfit >= 0 ? "success" : "danger",
      href: "/finance/pnl",
    }),
    kpi({
      key: "net_company_profit",
      label: "سود خالص شرکت",
      value: Number(kpis.netCompanyProfit) || 0,
      description: "سود پروژه منهای مصارف شرکت",
      format: "currency",
      tone: kpis.netCompanyProfit >= 0 ? "success" : "danger",
      href: "/finance/pnl",
    }),
  ];
}

/** True when finance payload has loaded (including legitimate zeros). */
export function financeKpisLoaded(
  kpis: FinanceDashboard["kpis"] | null | undefined,
): kpis is FinanceDashboard["kpis"] {
  return Boolean(kpis && typeof kpis.totalFinalPrice === "number");
}

/** Whether any financial activity exists (for empty-state messaging). */
export function financeHasActivity(kpis: FinanceDashboard["kpis"]): boolean {
  return (
    kpis.totalFinalPrice > 0 ||
    kpis.received > 0 ||
    kpis.directProjectCosts > 0 ||
    kpis.companyExpenses > 0 ||
    (kpis.scopedProjectCount ?? 0) > 0
  );
}

/** @deprecated Prefer financeKpisLoaded + always render cards */
export function financeKpisAvailable(kpis: FinanceDashboard["kpis"]): boolean {
  return financeHasActivity(kpis);
}
