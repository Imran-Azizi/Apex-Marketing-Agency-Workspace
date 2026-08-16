export type DatePreset = "today" | "week" | "month" | "year" | "custom" | "all";

export interface DateRange {
  preset: DatePreset;
  from: Date | null;
  to: Date | null;
}

export interface DashboardSummary {
  projectStatusCounts: Array<{ status: string; _count: number }>;
  leadsToday: number;
  followUpsDue: number;
}

export interface ProjectFinance {
  agreedPrice?: string | number | null;
  finalProjectPrice?: string | number | null;
  received?: string | number | null;
  narratorCost?: string | number | null;
  editorCost?: string | number | null;
  otherDirectCosts?: string | number | null;
  discount?: string | number | null;
  currency?: string | null;
}

export interface ProjectAssignment {
  id?: string;
  role: string;
  deadlineAt?: string | null;
  userId?: string | null;
  user?: { id: string; fullName: string } | null;
  teamProfile?: {
    id: string;
    displayName: string;
    kind?: string;
    userId?: string;
  } | null;
}

export interface ManagerProject {
  id: string;
  code: string;
  title: string;
  status: string;
  customerFacingStatus?: string;
  paymentStatus?: string;
  deadlineAt: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  contentRevisionUsed?: number;
  videoRevisionUsed?: number;
  progress?: import("@/lib/project-progress").ProjectProgress | number | null;
  crmCustomer?: {
    id: string;
    personName: string;
    companyName: string | null;
  } | null;
  assignments?: ProjectAssignment[];
  finance?: ProjectFinance | null;
}

export interface KpiMetric {
  key: string;
  label: string;
  value: number;
  description?: string;
  href?: string;
  tone?: "default" | "brand" | "success" | "warning" | "danger" | "info";
  format?: "number" | "percent" | "currency" | "days";
}

export interface ManagerMetrics {
  kpis: {
    projects: KpiMetric[];
  };
  statusChart: Array<{ status: string; label: string; count: number }>;
  monthlyProjectGrowth: Array<{ month: string; count: number }>;
  monthlyRevenue: Array<{ month: string; revenue: number; received: number }>;
  recentProjects: ManagerProject[];
  finance: {
    available: boolean;
    cards: KpiMetric[];
  } | null;
}
