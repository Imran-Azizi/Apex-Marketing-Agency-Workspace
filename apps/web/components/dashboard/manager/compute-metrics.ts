import { PROJECT_STATUS_LABELS } from "@/lib/project-status";
import type {
  DashboardSummary,
  DateRange,
  KpiMetric,
  ManagerMetrics,
  ManagerProject,
} from "./types";

const ACTIVE_STATUSES = new Set([
  "NEW_MANAGER_REVIEW",
  "CONTENT_GENERATION",
  "INTERNAL_CONTENT_REVIEW",
  "WAITING_CLIENT_CONTENT_APPROVAL",
  "CONTENT_REVISION",
  "NARRATION_RECORDING",
  "PRODUCTION_EDITING",
  "MANAGER_FINAL_REVIEW",
  "FINAL_REVISION",
  "WAITING_CLIENT_FINAL_APPROVAL",
  "WAITING_PAYMENT",
  "READY_TO_DOWNLOAD",
  "ON_HOLD",
]);

const WAITING_CUSTOMER = new Set([
  "WAITING_CLIENT_CONTENT_APPROVAL",
  "WAITING_CLIENT_FINAL_APPROVAL",
]);

const WAITING_APPROVAL = new Set([
  "NEW_MANAGER_REVIEW",
  "INTERNAL_CONTENT_REVIEW",
  "MANAGER_FINAL_REVIEW",
]);

function num(v: string | number | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("fa-AF", {
    numberingSystem: "latn",
    year: "numeric",
    month: "short",
  }).format(new Date(y, m - 1, 1));
}

export function resolveDateRange(range: DateRange): {
  from: Date | null;
  to: Date | null;
} {
  const now = new Date();
  if (range.preset === "all") return { from: null, to: null };
  if (range.preset === "custom") {
    return {
      from: range.from ? startOfDay(range.from) : null,
      to: range.to ? endOfDay(range.to) : null,
    };
  }
  if (range.preset === "today") {
    return { from: startOfDay(now), to: endOfDay(now) };
  }
  if (range.preset === "week") {
    const from = startOfDay(now);
    from.setDate(from.getDate() - ((from.getDay() + 1) % 7));
    return { from, to: endOfDay(now) };
  }
  if (range.preset === "month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: endOfDay(now),
    };
  }
  return {
    from: new Date(now.getFullYear(), 0, 1),
    to: endOfDay(now),
  };
}

function inRange(
  iso: string | null | undefined,
  from: Date | null,
  to: Date | null,
) {
  if (!iso) return !from && !to;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function countByStatus(
  projects: ManagerProject[],
  statuses: Set<string> | string[],
) {
  const set = statuses instanceof Set ? statuses : new Set(statuses);
  return projects.filter((p) => set.has(p.status)).length;
}

function financeOf(p: ManagerProject) {
  const f = p.finance;
  if (!f) return null;
  const agreed = num(f.agreedPrice);
  const discount = num(f.discount);
  const finalPrice = num(f.finalProjectPrice) || Math.max(agreed - discount, 0);
  const received = num(f.received);
  const narratorCost = num(f.narratorCost);
  const editorCost = num(f.editorCost);
  const otherDirectCosts = num(f.otherDirectCosts);
  const expenses = narratorCost + editorCost + otherDirectCosts;
  return {
    finalPrice,
    received,
    balance: finalPrice - received,
    narratorCost,
    editorCost,
    otherDirectCosts,
    expenses,
    profit: finalPrice - expenses,
  };
}

function sumFinance(projects: ManagerProject[]) {
  let totalRevenue = 0;
  let received = 0;
  let outstanding = 0;
  let expenses = 0;
  let narratorCost = 0;
  let editorCost = 0;
  let profit = 0;
  let any = false;

  for (const p of projects) {
    const fin = financeOf(p);
    if (!fin) continue;
    if (
      fin.finalPrice ||
      fin.received ||
      fin.expenses ||
      fin.narratorCost ||
      fin.editorCost
    ) {
      any = true;
    }
    totalRevenue += fin.finalPrice;
    received += fin.received;
    outstanding += Math.max(fin.balance, 0);
    expenses += fin.expenses;
    narratorCost += fin.narratorCost;
    editorCost += fin.editorCost;
    profit += fin.profit;
  }

  return {
    totalRevenue,
    received,
    outstanding,
    expenses,
    narratorCost,
    editorCost,
    profit,
    any,
  };
}

function revenueInWindow(
  projects: ManagerProject[],
  from: Date,
  to: Date,
): number {
  let sum = 0;
  for (const p of projects) {
    const fin = financeOf(p);
    if (!fin) continue;
    const anchor = p.completedAt || p.createdAt;
    if (inRange(anchor, from, to)) sum += fin.finalPrice;
  }
  return sum;
}

function assigneeName(p: ManagerProject, role: string): string {
  const a = p.assignments?.find(
    (x) => x.role === role && (x.teamProfile || x.user),
  );
  return a?.teamProfile?.displayName || a?.user?.fullName || "—";
}

function kpi(
  partial: Omit<KpiMetric, "tone"> & { tone?: KpiMetric["tone"] },
): KpiMetric {
  return { tone: "default", format: "number", ...partial };
}

export function computeManagerMetrics(input: {
  projects: ManagerProject[];
  summary?: DashboardSummary | null;
  range: DateRange;
}): ManagerMetrics {
  const { from, to } = resolveDateRange(input.range);

  const allProjects = input.projects;
  const scoped =
    from || to
      ? allProjects.filter(
          (p) =>
            inRange(p.createdAt, from, to) || inRange(p.updatedAt, from, to),
        )
      : allProjects;

  const statusCount = (list: ManagerProject[], status: string) =>
    list.filter((p) => p.status === status).length;

  const total = scoped.length;
  const active = scoped.filter(
    (p) => ACTIVE_STATUSES.has(p.status) && p.status !== "ON_HOLD",
  ).length;
  const completed = statusCount(scoped, "COMPLETED");
  const waitingCustomer = countByStatus(scoped, WAITING_CUSTOMER);
  const waitingApproval = countByStatus(scoped, WAITING_APPROVAL);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const projectsKpis: KpiMetric[] = [
    kpi({
      key: "total",
      label: "کل پروژه‌ها",
      value: total,
      description: "در بازه انتخاب‌شده",
      href: "/projects",
      tone: "brand",
    }),
    kpi({
      key: "active",
      label: "پروژه‌های فعال",
      value: active,
      description: "در حال جریان کاری",
      href: "/projects",
      tone: "info",
    }),
    kpi({
      key: "completed",
      label: "تکمیل‌شده",
      value: completed,
      description: "پروژه‌های پایان‌یافته",
      tone: "success",
    }),
    kpi({
      key: "waiting_customer",
      label: "منتظر مشتری",
      value: waitingCustomer,
      description: "تأیید محتوا یا نهایی",
      tone: "warning",
    }),
    kpi({
      key: "waiting_approval",
      label: "منتظر تأیید",
      value: waitingApproval,
      description: "نیاز به اقدام مدیر",
      tone: "warning",
    }),
  ];

  const statusMap = new Map<string, number>();
  for (const p of scoped) {
    statusMap.set(p.status, (statusMap.get(p.status) || 0) + 1);
  }
  if (!from && !to && input.summary?.projectStatusCounts?.length) {
    statusMap.clear();
    for (const row of input.summary.projectStatusCounts) {
      statusMap.set(row.status, row._count);
    }
  }
  const statusChart = Array.from(statusMap.entries())
    .map(([status, count]) => ({
      status,
      label: PROJECT_STATUS_LABELS[status] || status,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(monthKey(d));
  }

  const monthlyProjectGrowth = monthKeys.map((k) => ({
    month: monthLabel(k),
    count: allProjects.filter((p) => monthKey(new Date(p.createdAt)) === k)
      .length,
  }));

  const monthlyRevenue = monthKeys.map((k) => {
    let revenue = 0;
    let received = 0;
    for (const p of allProjects) {
      const fin = financeOf(p);
      if (!fin) continue;
      const anchor = p.completedAt || p.createdAt;
      if (monthKey(new Date(anchor)) !== k) continue;
      revenue += fin.finalPrice;
      received += fin.received;
    }
    return { month: monthLabel(k), revenue, received };
  });

  const currentFin = sumFinance(scoped);
  const monthlyRevenueSum = revenueInWindow(
    allProjects,
    monthStart,
    endOfDay(now),
  );

  let hasFinance = currentFin.any || monthlyRevenueSum > 0;
  if (!hasFinance) {
    hasFinance = allProjects.some((p) => {
      const fin = financeOf(p);
      return !!fin && (fin.finalPrice > 0 || fin.received > 0 || fin.expenses > 0);
    });
  }

  const financeCards: KpiMetric[] = [
    kpi({
      key: "total_revenue",
      label: "مجموع درآمد",
      value: currentFin.totalRevenue,
      description: "جمع مبلغ توافق‌شده پروژه‌ها",
      format: "currency",
      tone: "brand",
    }),
    kpi({
      key: "monthly_revenue",
      label: "درآمد این ماه",
      value: monthlyRevenueSum,
      description: "نسبت به ماه گذشته",
      format: "currency",
      tone: "success",
    }),
    kpi({
      key: "received",
      label: "پرداخت‌های دریافت‌شده",
      value: currentFin.received,
      description: "مبالغ وصول‌شده از مشتریان",
      format: "currency",
      tone: "info",
    }),
    kpi({
      key: "outstanding",
      label: "پرداخت‌های باقی‌مانده",
      value: currentFin.outstanding,
      description: "مانده قابل وصول",
      format: "currency",
      tone: "warning",
    }),
    kpi({
      key: "expenses",
      label: "هزینه‌ها",
      value: currentFin.expenses,
      description: "هزینه ادیت، نریشن و مستقیم",
      format: "currency",
      tone: "danger",
    }),
    kpi({
      key: "narrator_cost",
      label: "مجموع هزینه نریتور",
      value: currentFin.narratorCost,
      description: "پرداخت‌های مربوط به نریتورها",
      format: "currency",
      tone: "warning",
    }),
    kpi({
      key: "editor_cost",
      label: "مجموع هزینه ادیتور",
      value: currentFin.editorCost,
      description: "پرداخت‌های مربوط به ادیتورها",
      format: "currency",
      tone: "info",
    }),
    kpi({
      key: "net_profit",
      label: "سود خالص",
      value: currentFin.profit,
      description: "درآمد منهای هزینه‌های مستقیم",
      format: "currency",
      tone: currentFin.profit >= 0 ? "success" : "danger",
    }),
  ];

  const recentProjects = [...scoped]
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, 10);

  return {
    kpis: {
      projects: projectsKpis,
    },
    statusChart,
    monthlyProjectGrowth,
    monthlyRevenue,
    recentProjects,
    finance: hasFinance
      ? {
          available: true,
          cards: financeCards,
        }
      : null,
  };
}

export { assigneeName };
