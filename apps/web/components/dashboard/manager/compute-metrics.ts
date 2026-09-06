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

/** Positive price preference matching backend resolveContractPrice. */
function financeOf(p: ManagerProject) {
  const f = p.finance;
  if (!f) return null;
  const agreed = num(f.agreedPrice);
  const discount = num(f.discount);
  const cachedFinal = num(f.finalProjectPrice);
  const finalPrice =
    cachedFinal > 0
      ? cachedFinal
      : agreed > 0
        ? Math.max(agreed - discount, 0)
        : 0;
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
  /** Prefer finance API monthly series when present. */
  financeMonthly?: Array<{
    key: string;
    year: number;
    month: number;
    revenue: number;
    received: number;
  }> | null;
}): ManagerMetrics {
  const { from, to } = resolveDateRange(input.range);
  const hasDateFilter = Boolean(from || to);

  const allProjects = input.projects;
  const scoped = hasDateFilter
    ? allProjects.filter(
        (p) =>
          inRange(p.createdAt, from, to) ||
          inRange(p.updatedAt, from, to) ||
          inRange(p.completedAt, from, to),
      )
    : allProjects;

  const statusCount = (list: ManagerProject[], status: string) =>
    list.filter((p) => p.status === status).length;

  const serverKpis = !hasDateFilter ? input.summary?.projectKpis : null;

  const total = serverKpis?.total ?? scoped.length;
  const active =
    serverKpis?.active ??
    scoped.filter(
      (p) => ACTIVE_STATUSES.has(p.status) && p.status !== "ON_HOLD",
    ).length;
  const completed = serverKpis?.completed ?? statusCount(scoped, "COMPLETED");
  const waitingCustomer =
    serverKpis?.waitingCustomer ?? countByStatus(scoped, WAITING_CUSTOMER);
  const waitingApproval =
    serverKpis?.waitingApproval ?? countByStatus(scoped, WAITING_APPROVAL);

  const projectsKpis: KpiMetric[] = [
    kpi({
      key: "total",
      label: "کل پروژه‌ها",
      value: total,
      description: hasDateFilter ? "در بازه انتخاب‌شده" : "همه پروژه‌های فعال سیستم",
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
  if (!hasDateFilter && input.summary?.projectStatusCounts?.length) {
    for (const row of input.summary.projectStatusCounts) {
      statusMap.set(row.status, row._count);
    }
  } else {
    for (const p of scoped) {
      statusMap.set(p.status, (statusMap.get(p.status) || 0) + 1);
    }
  }
  const statusChart = Array.from(statusMap.entries())
    .map(([status, count]) => ({
      status,
      label: PROJECT_STATUS_LABELS[status] || status,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const now = new Date();
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(monthKey(d));
  }

  let monthlyProjectGrowth: Array<{ month: string; count: number }>;
  if (input.summary?.monthlyProjectGrowth?.length) {
    monthlyProjectGrowth = input.summary.monthlyProjectGrowth.map((row) => ({
      month: monthLabel(row.key),
      count: row.count,
    }));
  } else {
    monthlyProjectGrowth = monthKeys.map((k) => ({
      month: monthLabel(k),
      count: allProjects.filter((p) => monthKey(new Date(p.createdAt)) === k)
        .length,
    }));
  }

  let monthlyRevenue: Array<{
    month: string;
    revenue: number;
    received: number;
  }>;
  if (input.financeMonthly?.length) {
    monthlyRevenue = input.financeMonthly.map((row) => ({
      month: monthLabel(row.key),
      revenue: row.revenue,
      received: row.received,
    }));
  } else {
    monthlyRevenue = monthKeys.map((k) => {
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
  }

  const hasFinanceChart = monthlyRevenue.some(
    (r) => r.revenue > 0 || r.received > 0,
  );

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
    finance: hasFinanceChart
      ? {
          available: true,
          cards: [],
        }
      : null,
    crmPulse: {
      leadsToday: input.summary?.leadsToday ?? 0,
      followUpsDue: input.summary?.followUpsDue ?? 0,
    },
  };
}

export { assigneeName };
