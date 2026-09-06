export function formatMoney(value: number | null | undefined, currency = "AFN") {
  const n = Number(value || 0);
  const formatted = n.toLocaleString("fa-AF", {
    numberingSystem: "latn",
    maximumFractionDigits: 0,
  });
  return currency === "AFN" ? `${formatted} افغانی` : `${formatted} ${currency}`;
}

export function toInputDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export type FinanceDashboard = {
  range: { from: string | null; to: string | null };
  currency: string;
  kpis: {
    totalProjectReceipts: number;
    received: number;
    receivable: number;
    directProjectCosts: number;
    narratorCost: number;
    editorCost: number;
    otherDirectCosts: number;
    totalFinalPrice: number;
    projectProfit: number;
    companyExpenses: number;
    netCompanyProfit: number;
    scopedProjectCount?: number;
    employeeSalaries: { payable: number; paid: number };
  };
  /** Last 6 months contract revenue + verified receipts (from finance KPI engine). */
  monthly?: Array<{
    key: string;
    year: number;
    month: number;
    revenue: number;
    received: number;
  }>;
  employeeBreakdown: Array<{
    teamProfileId: string;
    displayName: string;
    kind: string;
    compensationType: string;
    payable: number;
    paid: number;
    openAdvances: number;
  }>;
};

export type FinanceProjectPayment = {
  id: string;
  amount: number;
  paidAt: string;
  method: string;
  methodLabel: string;
  verification: string;
  reference: string | null;
  notes: string | null;
  invoiceNumber: string | null;
  verifiedAt?: string | null;
  verifiedBy?: { id: string; fullName: string } | null;
  rejectionReason?: string | null;
};

export type FinanceProject = {
  id: string;
  code: string;
  title: string;
  status: string;
  paymentStatus: string;
  settlementStatus?: "UNPAID" | "PARTIAL" | "PAID" | "OVERRIDE" | string;
  settlementStatusLabel?: string;
  isComplete: boolean;
  expectedCompletionAt: string | null;
  completedAt: string | null;
  createdAt: string;
  currency?: string;
  customer: {
    id: string;
    personName: string | null;
    companyName: string | null;
    customerCode: string | null;
  } | null;
  finalProjectPrice: number;
  received: number;
  balance: number;
  directCosts: number;
  profit: number;
  paymentMethods?: string[];
  lastPaymentAt?: string | null;
  paymentCount?: number;
  verifiedPaymentCount?: number;
  payments: FinanceProjectPayment[];
};

export type FinanceExpense = {
  id: string;
  amount: number;
  expenseDate: string;
  description: string | null;
  recipient: string | null;
  accountLabel: string | null;
  paymentMethod: string | null;
  paidBy: { id: string; fullName: string } | null;
};

export type PayrollProjectHistoryItem = {
  payableId: string;
  projectId: string;
  code: string | null;
  title: string | null;
  projectStatus: string | null;
  completedAt: string | null;
  customer: {
    id: string;
    personName: string | null;
    companyName: string | null;
  } | null;
  roleLabel: string;
  projectAmount: number;
  amount: number;
  payableStatus: string;
  paidAmount: number;
  remainingAmount: number;
  paidAt: string | null;
  paymentMethod: string | null;
};

export type PayrollEmployee = {
  teamProfileId: string;
  displayName: string;
  kind: string;
  compensation: {
    type: "FIXED" | "PROJECT_SHARE";
    fixedMonthlyAmount: number;
    notes: string | null;
    isActive: boolean;
  };
  projectsCompletedCount: number;
  contributingProjects: Array<{
    payableId: string;
    projectId: string;
    code: string;
    title: string;
    amount: number;
    roleLabel: string;
  }>;
  projectHistory?: PayrollProjectHistoryItem[];
  grossPayable: number;
  paidTotal: number;
  openAdvances: number;
  netPayable: number;
  remaining?: number;
  lastPaymentAt?: string | null;
  payments: Array<{
    id: string;
    amount: number;
    paidAt: string;
    method: string;
    notes: string | null;
  }>;
  advances: Array<{
    id: string;
    amount: number;
    paidAt: string;
    method: string | null;
    status: string;
    notes: string | null;
  }>;
};

export type PnlMonth = {
  year: number;
  month: number;
  range: { from: string; to: string };
  trackingActive: boolean;
  isCurrentMonth: boolean;
  performance: "INACTIVE" | "PROFIT" | "LOSS" | "BREAK_EVEN";
  targetMet: boolean | null;
  actuals: {
    received: number;
    receivable: number;
    directProjectCosts: number;
    projectProfit: number;
    companyExpenses: number;
    netCompanyProfit: number;
  };
  target: {
    id: string;
    netProfitTarget: number;
    advertisingBudget: number;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  priorNetProfit: number | null;
};

export type PnlMonthSummary = {
  year: number;
  month: number;
  netProfitTarget: number;
  advertisingBudget: number;
  createdAt: string;
  updatedAt: string;
};
