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

function previousPeriod(from: Date | null, to: Date | null) {
  if (!from || !to)
    return { from: null as Date | null, to: null as Date | null };
  const span = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - span);
  return { from: prevFrom, to: prevTo };
}

function trendPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function countByStatus(
  projects: ManagerProject[],
  statuses: Set<string> | string[],
) {
  const set = statuses instanceof Set ? statuses : new Set(statuses);
  return projects.filter((p) => set.has(p.status)).length;
}

function sparklineByMonth(projects: ManagerProject[], months = 6): number[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  const map = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const p of projects) {
    const k = monthKey(new Date(p.createdAt));
    if (k in map) map[k] += 1;
  }
  return keys.map((k) => map[k]);
}

function financeOf(p: ManagerProject) {
  const f = p.finance;
  if (!f) return null;
  const agreed = num(f.agreedPrice);
  const discount = num(f.discount);
  const finalPrice = num(f.finalProjectPrice) || Math.max(agreed - discount, 0);
  const received = num(f.received);
  const expenses =
    num(f.narratorCost) + num(f.editorCost) + num(f.otherDirectCosts);
  return {
    finalPrice,
    received,
    balance: finalPrice - received,
    expenses,
    profit: finalPrice - expenses,
  };
}

function sumFinance(projects: ManagerProject[]) {
  let totalRevenue = 0;
  let received = 0;
  let outstanding = 0;
  let expenses = 0;
  let profit = 0;
  let any = false;

  for (const p of projects) {
    const fin = financeOf(p);
    if (!fin) continue;
    if (fin.finalPrice || fin.received || fin.expenses) any = true;
    totalRevenue += fin.finalPrice;
    received += fin.received;
    outstanding += Math.max(fin.balance, 0);
    expenses += fin.expenses;
    profit += fin.profit;
  }

  return { totalRevenue, received, outstanding, expenses, profit, any };
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

function financeSparkline(projects: ManagerProject[], months = 6): number[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  const map = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const p of projects) {
    const fin = financeOf(p);
    if (!fin) continue;
    const anchor = p.completedAt || p.createdAt;
    const k = monthKey(new Date(anchor));
    if (k in map) map[k] += fin.finalPrice;
  }
  return keys.map((k) => map[k]);
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
  const prev = previousPeriod(from, to);

  const allProjects = input.projects;
  const scoped =
    from || to
      ? allProjects.filter(
          (p) =>
            inRange(p.createdAt, from, to) || inRange(p.updatedAt, from, to),
        )
      : allProjects;

  const prevScoped =
    prev.from && prev.to
      ? allProjects.filter(
          (p) =>
            inRange(p.createdAt, prev.from, prev.to) ||
            inRange(p.updatedAt, prev.from, prev.to),
        )
      : [];

  const statusCount = (list: ManagerProject[], status: string) =>
    list.filter((p) => p.status === status).length;

  const total = scoped.length;
  const active = scoped.filter(
    (p) => ACTIVE_STATUSES.has(p.status) && p.status !== "ON_HOLD",
  ).length;
  const completed = statusCount(scoped, "COMPLETED");
  const waitingCustomer = countByStatus(scoped, WAITING_CUSTOMER);
  const waitingApproval = countByStatus(scoped, WAITING_APPROVAL);

  const prevTotal = prevScoped.length;
  const prevActive = prevScoped.filter(
    (p) => ACTIVE_STATUSES.has(p.status) && p.status !== "ON_HOLD",
  ).length;
  const prevCompleted = statusCount(prevScoped, "COMPLETED");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));

  const projectsKpis: KpiMetric[] = [
    kpi({
      key: "total",
      label: "کل پروژه‌ها",
      value: total,
      description: "در بازه انتخاب‌شده",
      href: "/projects",
      tone: "brand",
      trendPct: from ? trendPct(total, prevTotal) : null,
      sparkline: sparklineByMonth(allProjects),
      progress: 100,
    }),
    kpi({
      key: "active",
      label: "پروژه‌های فعال",
      value: active,
      description: "در حال جریان کاری",
      href: "/projects",
      tone: "info",
      trendPct: from ? trendPct(active, prevActive) : null,
      progress: total ? Math.round((active / total) * 100) : 0,
    }),
    kpi({
      key: "completed",
      label: "تکمیل‌شده",
      value: completed,
      description: "پروژه‌های پایان‌یافته",
      tone: "success",
      trendPct: from ? trendPct(completed, prevCompleted) : null,
      progress: total ? Math.round((completed / total) * 100) : 0,
    }),
    kpi({
      key: "waiting_customer",
      label: "منتظر مشتری",
      value: waitingCustomer,
      description: "تأیید محتوا یا نهایی",
      tone: "warning",
      progress: total ? Math.round((waitingCustomer / total) * 100) : 0,
    }),
    kpi({
      key: "waiting_approval",
      label: "منتظر تأیید",
      value: waitingApproval,
      description: "نیاز به اقدام مدیر",
      tone: "warning",
      progress: total ? Math.round((waitingApproval / total) * 100) : 0,
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
  const prevMonthlyRevenueSum = revenueInWindow(
    allProjects,
    lastMonthStart,
    lastMonthEnd,
  );

  let hasFinance = currentFin.any || monthlyRevenueSum > 0;
  if (!hasFinance) {
    hasFinance = allProjects.some((p) => {
      const fin = financeOf(p);
      return !!fin && (fin.finalPrice > 0 || fin.received > 0 || fin.expenses > 0);
    });
  }

  const rollingFrom = startOfDay(new Date(now.getTime() - 29 * 86400000));
  const rollingPrevTo = new Date(rollingFrom.getTime() - 1);
  const rollingPrevFrom = new Date(rollingPrevTo.getTime() - 29 * 86400000);
  const rollingProjects = allProjects.filter(
    (p) =>
      inRange(p.createdAt, rollingFrom, endOfDay(now)) ||
      inRange(p.updatedAt, rollingFrom, endOfDay(now)),
  );
  const rollingPrevProjects = allProjects.filter(
    (p) =>
      inRange(p.createdAt, rollingPrevFrom, rollingPrevTo) ||
      inRange(p.updatedAt, rollingPrevFrom, rollingPrevTo),
  );
  const rollingFin = sumFinance(from || to ? scoped : rollingProjects);
  const rollingPrevFin = sumFinance(
    from || to ? prevScoped : rollingPrevProjects,
  );

  const financeCards: KpiMetric[] = [
    kpi({
      key: "total_revenue",
      label: "مجموع درآمد",
      value: currentFin.totalRevenue,
      description: "جمع مبلغ توافق‌شده پروژه‌ها",
      format: "currency",
      tone: "brand",
      trendPct: trendPct(rollingFin.totalRevenue, rollingPrevFin.totalRevenue),
      sparkline: financeSparkline(allProjects),
      progress: 100,
    }),
    kpi({
      key: "monthly_revenue",
      label: "درآمد این ماه",
      value: monthlyRevenueSum,
      description: "نسبت به ماه گذشته",
      format: "currency",
      tone: "success",
      trendPct: trendPct(monthlyRevenueSum, prevMonthlyRevenueSum),
      progress:
        monthlyRevenueSum + prevMonthlyRevenueSum > 0
          ? Math.round(
              (monthlyRevenueSum /
                (monthlyRevenueSum + prevMonthlyRevenueSum)) *
                100,
            )
          : 0,
    }),
    kpi({
      key: "received",
      label: "پرداخت‌های دریافت‌شده",
      value: currentFin.received,
      description: "مبالغ وصول‌شده از مشتریان",
      format: "currency",
      tone: "info",
      trendPct: trendPct(rollingFin.received, rollingPrevFin.received),
      progress:
        currentFin.totalRevenue > 0
          ? Math.min(
              100,
              Math.round((currentFin.received / currentFin.totalRevenue) * 100),
            )
          : 0,
    }),
    kpi({
      key: "outstanding",
      label: "پرداخت‌های باقی‌مانده",
      value: currentFin.outstanding,
      description: "مانده قابل وصول",
      format: "currency",
      tone: "warning",
      trendPct: trendPct(rollingFin.outstanding, rollingPrevFin.outstanding),
      progress:
        currentFin.totalRevenue > 0
          ? Math.min(
              100,
              Math.round(
                (currentFin.outstanding / currentFin.totalRevenue) * 100,
              ),
            )
          : 0,
    }),
    kpi({
      key: "expenses",
      label: "هزینه‌ها",
      value: currentFin.expenses,
      description: "هزینه ادیت، نریشن و مستقیم",
      format: "currency",
      tone: "danger",
      trendPct: trendPct(rollingFin.expenses, rollingPrevFin.expenses),
      progress:
        currentFin.totalRevenue > 0
          ? Math.min(
              100,
              Math.round((currentFin.expenses / currentFin.totalRevenue) * 100),
            )
          : 0,
    }),
    kpi({
      key: "net_profit",
      label: "سود خالص",
      value: currentFin.profit,
      description: "درآمد منهای هزینه‌های مستقیم",
      format: "currency",
      tone: currentFin.profit >= 0 ? "success" : "danger",
      trendPct: trendPct(rollingFin.profit, rollingPrevFin.profit),
      progress:
        currentFin.totalRevenue > 0
          ? Math.min(
              100,
              Math.max(
                0,
                Math.round((currentFin.profit / currentFin.totalRevenue) * 100),
              ),
            )
          : 0,
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
