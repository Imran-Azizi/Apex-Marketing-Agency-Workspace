import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../utils/response.js";
import { hasAnyPermission } from "../../services/permissions/effective.js";
import { storage } from "../../services/storage.js";
import { APPROVED_PAYMENT_VERIFICATIONS } from "../crm/paymentFinance.js";
import { formatPaymentMethod } from "../crm/paymentMethods.js";
import {
  allocateSalaryPayment,
  derivePnlPerformance,
  emptyMonthlyActuals,
  employeeNetPayable,
  monthBounds,
  parseDateBound,
  priorCalendarMonth,
  roundMoney,
  targetMetForMonth,
} from "./metrics.js";
import {
  computeFinanceKpis,
  loadAllProjectsForFinanceList,
  loadPaymentsGroupedByProject,
  projectFinanceMetrics,
  resolvePaymentProjectId,
} from "./kpis.js";

export { resolvePaymentProjectId } from "./kpis.js";

const PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "HAWALA",
  "HESAB_PAY",
  "CARD",
  "OTHER",
];

function dec(v) {
  return roundMoney(v);
}

function dateFilter(field, from, to) {
  if (!from && !to) return undefined;
  const range = {};
  if (from) range.gte = from;
  if (to) range.lte = to;
  return { [field]: range };
}

function serializeExpense(row) {
  if (!row) return null;
  const creatorName = row.paidBy?.fullName || row.accountLabel || null;
  return {
    id: row.id,
    projectId: row.projectId,
    category: row.category,
    amount: dec(row.amount),
    expenseDate: row.expenseDate,
    paymentMethod: row.paymentMethod,
    description: row.description,
    recipient: row.recipient,
    accountLabel: creatorName,
    receiptKey: row.receiptKey,
    paidByUserId: row.paidByUserId,
    paidBy: row.paidBy
      ? { id: row.paidBy.id, fullName: row.paidBy.fullName }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const createExpenseSchema = z.object({
  description: z.string().trim().min(1, "برای چی الزامی است"),
  amount: z.coerce.number().positive("مبلغ باید بزرگ‌تر از صفر باشد"),
  recipient: z.string().trim().min(1, "به کی الزامی است"),
  expenseDate: z.coerce.date().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional().nullable(),
  receiptKey: z.string().trim().optional().nullable(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

async function resolveExpenseCreator(auth) {
  const userId = auth?.userId;
  if (!userId) {
    throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
  }
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null, isActive: true },
    select: { id: true, fullName: true },
  });
  if (!user) throw new AppError("کاربر یافت نشد", 404, "NOT_FOUND");
  return user;
}

export const salaryPaymentSchema = z.object({
  teamProfileId: z.string().min(1),
  amount: z.coerce.number().positive(),
  method: z.enum(PAYMENT_METHODS),
  paidAt: z.coerce.date().optional(),
  notes: z.string().trim().optional().nullable(),
});

export const salaryAdvanceSchema = z.object({
  teamProfileId: z.string().min(1),
  amount: z.coerce.number().positive(),
  method: z.enum(PAYMENT_METHODS).optional().nullable(),
  paidAt: z.coerce.date().optional(),
  notes: z.string().trim().optional().nullable(),
});

export const compensationSchema = z.object({
  teamProfileId: z.string().min(1),
  type: z.enum(["FIXED", "PROJECT_SHARE"]),
  fixedMonthlyAmount: z.coerce.number().min(0).optional().default(0),
  notes: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const pnlTargetSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  netProfitTarget: z.coerce.number(),
  advertisingBudget: z.coerce.number().min(0),
});

async function computeMonthlyPnlActuals(year, month) {
  const { from, to } = monthBounds(year, month);
  const kpis = await computeFinanceKpis({ from, to });
  return {
    received: kpis.received,
    receivable: kpis.receivable,
    directProjectCosts: kpis.directProjectCosts,
    projectProfit: kpis.projectProfit,
    companyExpenses: kpis.companyExpenses,
    netCompanyProfit: kpis.netCompanyProfit,
  };
}

async function resolvePriorMonthNetProfit(year, month) {
  const prior = priorCalendarMonth(year, month);
  const priorTarget = await prisma.financePnlTarget.findUnique({
    where: { year_month: { year: prior.year, month: prior.month } },
  });
  if (!priorTarget) return null;
  const priorActuals = await computeMonthlyPnlActuals(prior.year, prior.month);
  return priorActuals.netCompanyProfit;
}

function isCurrentCalendarMonth(year, month) {
  const now = new Date();
  return Number(year) === now.getFullYear() && Number(month) === now.getMonth() + 1;
}

async function buildPnlMonthPayload(year, month) {
  const y = Number(year) || new Date().getFullYear();
  const m = Number(month) || new Date().getMonth() + 1;
  const { from, to } = monthBounds(y, m);

  const target = await prisma.financePnlTarget.findUnique({
    where: { year_month: { year: y, month: m } },
  });

  const trackingActive = Boolean(target);
  const actuals = trackingActive
    ? await computeMonthlyPnlActuals(y, m)
    : emptyMonthlyActuals();

  const netProfitTarget = target ? dec(target.netProfitTarget) : 0;
  const advertisingBudget = target ? dec(target.advertisingBudget) : 0;
  const priorNetProfit = await resolvePriorMonthNetProfit(y, m);

  return {
    year: y,
    month: m,
    range: { from: from.toISOString(), to: to.toISOString() },
    trackingActive,
    isCurrentMonth: isCurrentCalendarMonth(y, m),
    performance: derivePnlPerformance(actuals.netCompanyProfit, trackingActive),
    targetMet: targetMetForMonth(
      actuals.netCompanyProfit,
      netProfitTarget,
      trackingActive,
    ),
    actuals,
    target: target
      ? {
          id: target.id,
          netProfitTarget,
          advertisingBudget,
          createdAt: target.createdAt,
          updatedAt: target.updatedAt,
        }
      : null,
    priorNetProfit,
  };
}

/** @deprecated Prefer resolvePaymentProjectId for exclusive assignment. */
export function paymentBelongsToProject(payment, project) {
  const indexes = {
    byProjectId: new Map([[project.id, project]]),
    byOpportunityId: new Map(
      project.opportunity?.id ? [[project.opportunity.id, project.id]] : [],
    ),
    byCustomerId: new Map([[project.crmCustomerId, [project.id]]]),
  };
  return resolvePaymentProjectId(payment, indexes) === project.id;
}

export const SETTLEMENT_STATUS_LABELS = Object.freeze({
  UNPAID: "پرداخت‌نشده",
  PARTIAL: "پرداخت جزئی",
  PAID: "تسویه‌شده",
  OVERRIDE: "استثنا",
});

/** Live settlement from totals: Remaining = Total − Paid. */
export function deriveSettlementStatus({ finalProjectPrice, received }) {
  const total = dec(finalProjectPrice);
  const paid = dec(received);
  if (paid <= 0) return "UNPAID";
  if (total <= 0 || paid >= total) return "PAID";
  return "PARTIAL";
}

function serializeFinancePayment(payment) {
  return {
    id: payment.id,
    amount: dec(payment.amount),
    paidAt: payment.paidAt,
    method: payment.method,
    methodLabel: formatPaymentMethod(payment.method),
    verification: payment.verification,
    reference: payment.reference || null,
    notes: payment.notes || null,
    verifiedAt: payment.verifiedAt || null,
    verifiedBy: payment.verifiedBy
      ? { id: payment.verifiedBy.id, fullName: payment.verifiedBy.fullName }
      : null,
    rejectionReason: payment.rejectionReason || null,
  };
}

function projectListMetrics(project, projectPayments) {
  const m = projectFinanceMetrics(project, projectPayments);
  const approved = (projectPayments || []).filter((p) =>
    APPROVED_PAYMENT_VERIFICATIONS.includes(p.verification),
  );
  const settlementStatus = deriveSettlementStatus({
    finalProjectPrice: m.finalProjectPrice,
    received: m.received,
  });
  const methodLabels = [
    ...new Set(
      approved.map((p) => formatPaymentMethod(p.method)).filter(Boolean),
    ),
  ];
  const lastPaymentAt = projectPayments[0]?.paidAt || null;
  const pendingApprovalTotal = roundMoney(
    (projectPayments || [])
      .filter((p) => p.verification === "PENDING")
      .reduce((sum, p) => sum + dec(p.amount), 0),
  );
  const reservedPaid = roundMoney(m.received + pendingApprovalTotal);
  const availableToRecord = roundMoney(
    Math.max(0, m.finalProjectPrice - reservedPaid),
  );

  return {
    finalProjectPrice: m.finalProjectPrice,
    narratorCost: m.narratorCost,
    editorCost: m.editorCost,
    otherDirectCosts: m.otherDirectCosts,
    directCosts: m.directCosts,
    received: m.received,
    balance: m.balance,
    profit: m.profit,
    currency: m.currency,
    settlementStatus,
    settlementStatusLabel:
      SETTLEMENT_STATUS_LABELS[settlementStatus] || settlementStatus,
    paymentMethods: methodLabels,
    lastPaymentAt,
    paymentCount: projectPayments.length,
    verifiedPaymentCount: approved.length,
    pendingApprovalTotal,
    reservedPaid,
    availableToRecord,
  };
}

async function buildEmployeeSalaryRows({ lean = false } = {}) {
  const payableInclude = lean
    ? {
        where: { status: { in: ["ESTIMATED", "CONFIRMED", "PAID"] } },
        select: {
          id: true,
          projectId: true,
          amount: true,
          status: true,
          roleLabel: true,
          paidAt: true,
          paymentMethod: true,
          project: { select: { status: true } },
        },
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      }
    : {
        where: { status: { in: ["ESTIMATED", "CONFIRMED", "PAID"] } },
        include: {
          project: {
            select: {
              id: true,
              code: true,
              title: true,
              status: true,
              completedAt: true,
              createdAt: true,
              crmCustomer: {
                select: {
                  id: true,
                  personName: true,
                  companyName: true,
                },
              },
              finance: {
                select: {
                  finalProjectPrice: true,
                  agreedPrice: true,
                },
              },
              opportunity: {
                select: { agreedPrice: true },
              },
            },
          },
        },
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      };

  const profiles = await prisma.teamProfile.findMany({
    where: { deletedAt: null, status: { not: "INACTIVE" } },
    include: {
      user: {
        select: { id: true, fullName: true, email: true, isActive: true },
      },
      compensationProfile: true,
      employeePayables: payableInclude,
      salaryPayments: lean
        ? { select: { id: true, amount: true, paidAt: true, method: true, notes: true }, orderBy: { paidAt: "desc" } }
        : { orderBy: { paidAt: "desc" } },
      salaryAdvances: lean
        ? { select: { id: true, amount: true, paidAt: true, method: true, status: true, notes: true, settledAt: true }, orderBy: { paidAt: "desc" } }
        : { orderBy: { paidAt: "desc" } },
    },
    orderBy: { displayName: "asc" },
  });

  return profiles.map((p) => {
    const compensationType =
      p.compensationProfile?.type ||
      (p.kind === "EDITOR" || p.kind === "NARRATOR"
        ? "PROJECT_SHARE"
        : "FIXED");
    const fixedMonthly = dec(p.compensationProfile?.fixedMonthlyAmount || 0);

    const unpaidPayables = p.employeePayables.filter(
      (x) => x.status !== "PAID",
    );
    const projectShareGross = unpaidPayables.reduce(
      (s, x) => s + dec(x.amount),
      0,
    );
    const salaryPaidTotal = p.salaryPayments.reduce(
      (s, x) => s + dec(x.amount),
      0,
    );
    const openAdvances = p.salaryAdvances
      .filter((a) => a.status === "OPEN")
      .reduce((s, x) => s + dec(x.amount), 0);

    const projectShareNet = employeeNetPayable({
      grossPayable: projectShareGross,
      paidTotal: 0,
      openAdvances,
    });
    const fixedNet = employeeNetPayable({
      grossPayable: fixedMonthly,
      paidTotal: salaryPaidTotal,
      openAdvances,
    });

    const projectHistory = lean
      ? []
      : p.employeePayables.map((row) => {
      const amount = dec(row.amount);
      const isPaid = row.status === "PAID";
      const projectPrice = dec(
        row.project?.finance?.finalProjectPrice ??
          row.project?.finance?.agreedPrice ??
          row.project?.opportunity?.agreedPrice ??
          0,
      );
      return {
        payableId: row.id,
        projectId: row.projectId,
        code: row.project?.code || null,
        title: row.project?.title || null,
        projectStatus: row.project?.status || null,
        completedAt: row.project?.completedAt || null,
        customer: row.project?.crmCustomer
          ? {
              id: row.project.crmCustomer.id,
              personName: row.project.crmCustomer.personName,
              companyName: row.project.crmCustomer.companyName,
            }
          : null,
        roleLabel: row.roleLabel,
        projectAmount: projectPrice,
        amount,
        payableStatus: row.status,
        paidAmount: isPaid ? amount : 0,
        remainingAmount: isPaid ? 0 : amount,
        paidAt: row.paidAt || null,
        paymentMethod: row.paymentMethod || null,
      };
    });

    const contributingProjects = unpaidPayables.map((row) => ({
      payableId: row.id,
      projectId: row.projectId,
      code: row.project?.code,
      title: row.project?.title,
      status: row.project?.status,
      roleLabel: row.roleLabel,
      amount: dec(row.amount),
      payableStatus: row.status,
    }));

    const lastPaymentAt = p.salaryPayments[0]?.paidAt || null;

    return {
      teamProfileId: p.id,
      displayName: p.displayName,
      realName: p.realName,
      kind: p.kind,
      user: p.user,
      compensation: {
        type: compensationType,
        fixedMonthlyAmount: fixedMonthly,
        notes: p.compensationProfile?.notes || null,
        isActive: p.compensationProfile?.isActive ?? true,
        profileId: p.compensationProfile?.id || null,
      },
      projectsCompletedCount: new Set(
        p.employeePayables
          .filter(
            (x) =>
              x.project?.status === "COMPLETED" ||
              x.status === "PAID" ||
              x.status === "CONFIRMED",
          )
          .map((x) => x.projectId),
      ).size,
      projectHistory,
      contributingProjects,
      grossPayable:
        compensationType === "FIXED" ? fixedMonthly : projectShareGross,
      paidTotal: salaryPaidTotal,
      openAdvances,
      netPayable: compensationType === "FIXED" ? fixedNet : projectShareNet,
      remaining: compensationType === "FIXED" ? fixedNet : projectShareNet,
      lastPaymentAt,
      payments: p.salaryPayments.map((pay) => ({
        id: pay.id,
        amount: dec(pay.amount),
        paidAt: pay.paidAt,
        method: pay.method,
        notes: pay.notes,
      })),
      advances: p.salaryAdvances.map((adv) => ({
        id: adv.id,
        amount: dec(adv.amount),
        paidAt: adv.paidAt,
        method: adv.method,
        status: adv.status,
        notes: adv.notes,
        settledAt: adv.settledAt,
      })),
    };
  });
}

export const financeService = {
  async getDashboard({ from: fromRaw, to: toRaw } = {}) {
    const from = parseDateBound(fromRaw, false);
    const to = parseDateBound(toRaw, true);

    const [kpis, salaryRows] = await Promise.all([
      computeFinanceKpis({ from, to }),
      buildEmployeeSalaryRows({ lean: true }),
    ]);

    const salariesPayable = roundMoney(
      salaryRows.reduce((s, r) => s + Number(r.netPayable || 0), 0),
    );
    const salariesPaid = roundMoney(
      salaryRows.reduce((s, r) => s + Number(r.paidTotal || 0), 0),
    );

    return {
      range: kpis.range,
      currency: "AFN",
      kpis: {
        totalProjectReceipts: kpis.totalProjectReceipts,
        received: kpis.received,
        receivable: kpis.receivable,
        directProjectCosts: kpis.directProjectCosts,
        narratorCost: kpis.narratorCost,
        editorCost: kpis.editorCost,
        otherDirectCosts: kpis.otherDirectCosts,
        totalFinalPrice: kpis.totalFinalPrice,
        projectProfit: kpis.projectProfit,
        companyExpenses: kpis.companyExpenses,
        netCompanyProfit: kpis.netCompanyProfit,
        scopedProjectCount: kpis.scopedProjectCount ?? 0,
        employeeSalaries: {
          payable: salariesPayable,
          paid: salariesPaid,
        },
      },
      monthly: kpis.monthly || [],
      reconciliation: {
        projectFinanceReceivedCache: kpis.received,
        projectFinalPriceTotal: kpis.totalFinalPrice,
      },
      employeeBreakdown: salaryRows.map((r) => ({
        teamProfileId: r.teamProfileId,
        displayName: r.displayName,
        kind: r.kind,
        compensationType: r.compensation.type,
        payable: r.netPayable,
        paid: r.paidTotal,
        openAdvances: r.openAdvances,
      })),
    };
  },

  async listProjects({ q } = {}) {
    const projects = await loadAllProjectsForFinanceList();
    const paymentsByProject = await loadPaymentsGroupedByProject(projects);
    const qLower = String(q || "")
      .trim()
      .toLowerCase();

    let items = projects.map((p) => {
      const projectPayments = paymentsByProject.get(p.id) || [];
      const m = projectListMetrics(p, projectPayments);
      const isComplete = p.status === "COMPLETED" || Boolean(p.completedAt);
      return {
        id: p.id,
        code: p.code,
        title: p.title,
        status: p.status,
        paymentStatus: p.paymentStatus,
        isComplete,
        expectedCompletionAt: isComplete ? null : p.deadlineAt,
        completedAt: p.completedAt,
        createdAt: p.createdAt,
        customer: p.crmCustomer,
        opportunityId: p.opportunity?.id || null,
        contractLocked: Boolean(p.opportunity?.contractLocked),
        payments: projectPayments.map(serializeFinancePayment),
        ...m,
      };
    });

    if (qLower) {
      items = items.filter(
        (x) =>
          x.title?.toLowerCase().includes(qLower) ||
          x.code?.toLowerCase().includes(qLower) ||
          x.customer?.personName?.toLowerCase().includes(qLower) ||
          x.customer?.companyName?.toLowerCase().includes(qLower),
      );
    }

    return { items, total: items.length };
  },

  async listExpenses({
    from: fromRaw,
    to: toRaw,
    page = 1,
    pageSize = 50,
  } = {}) {
    const from = parseDateBound(fromRaw, false);
    const to = parseDateBound(toRaw, true);
    const take = Math.min(100, Math.max(1, Number(pageSize) || 50));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;

    const where = {
      category: "COMPANY_GENERAL",
      ...dateFilter("expenseDate", from, to),
    };

    const [total, rows] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        include: {
          paidBy: { select: { id: true, fullName: true } },
        },
        orderBy: { expenseDate: "desc" },
        skip,
        take,
      }),
    ]);

    return {
      items: rows.map(serializeExpense),
      total,
      page: Number(page) || 1,
      pageSize: take,
    };
  },

  async createExpense(body, auth) {
    const creator = await resolveExpenseCreator(auth);

    const row = await prisma.expense.create({
      data: {
        category: "COMPANY_GENERAL",
        amount: body.amount,
        description: body.description,
        recipient: body.recipient,
        accountLabel: creator.fullName,
        expenseDate: body.expenseDate || new Date(),
        paymentMethod: body.paymentMethod || null,
        receiptKey: body.receiptKey || null,
        paidByUserId: creator.id,
      },
      include: { paidBy: { select: { id: true, fullName: true } } },
    });
    return serializeExpense(row);
  },

  async updateExpense(id, body) {
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing || existing.category !== "COMPANY_GENERAL") {
      throw new AppError("مصرف یافت نشد", 404, "NOT_FOUND");
    }
    const row = await prisma.expense.update({
      where: { id },
      data: {
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.amount !== undefined ? { amount: body.amount } : {}),
        ...(body.recipient !== undefined ? { recipient: body.recipient } : {}),
        ...(body.expenseDate !== undefined
          ? { expenseDate: body.expenseDate }
          : {}),
        ...(body.paymentMethod !== undefined
          ? { paymentMethod: body.paymentMethod }
          : {}),
        ...(body.receiptKey !== undefined
          ? { receiptKey: body.receiptKey }
          : {}),
      },
      include: { paidBy: { select: { id: true, fullName: true } } },
    });
    return serializeExpense(row);
  },

  async deleteExpense(id, auth) {
    if (!hasAnyPermission(auth?.permissions, ["finance.delete"], auth?.roleCode)) {
      throw new AppError(
        "شما اجازه دسترسی به این منبع را ندارید",
        403,
        "FORBIDDEN",
      );
    }

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing || existing.category !== "COMPANY_GENERAL") {
      throw new AppError("مصرف یافت نشد", 404, "NOT_FOUND");
    }

    await storage.deleteStoredObject(existing.receiptKey, {
      required: true,
      logTag: "finance-expense",
    });

    await prisma.expense.delete({ where: { id } });
    return { id, deleted: true };
  },

  async listPayroll() {
    const rows = await buildEmployeeSalaryRows();
    const fixed = rows.filter((r) => r.compensation.type === "FIXED");
    const projectShare = rows.filter(
      (r) => r.compensation.type === "PROJECT_SHARE",
    );
    return {
      fixed,
      projectShare,
      totals: {
        payable: roundMoney(rows.reduce((s, r) => s + r.netPayable, 0)),
        paid: roundMoney(rows.reduce((s, r) => s + r.paidTotal, 0)),
        openAdvances: roundMoney(rows.reduce((s, r) => s + r.openAdvances, 0)),
      },
    };
  },

  async getEmployeePayroll(teamProfileId) {
    const rows = await buildEmployeeSalaryRows();
    const row = rows.find((r) => r.teamProfileId === teamProfileId);
    if (!row) throw new AppError("کارمند یافت نشد", 404, "NOT_FOUND");
    return row;
  },

  async upsertCompensation(body) {
    const profile = await prisma.teamProfile.findFirst({
      where: { id: body.teamProfileId, deletedAt: null },
      select: { id: true },
    });
    if (!profile)
      throw new AppError("پروفایل کارمند یافت نشد", 404, "NOT_FOUND");

    const row = await prisma.employeeCompensationProfile.upsert({
      where: { teamProfileId: body.teamProfileId },
      create: {
        teamProfileId: body.teamProfileId,
        type: body.type,
        fixedMonthlyAmount: body.fixedMonthlyAmount || 0,
        notes: body.notes || null,
        isActive: body.isActive ?? true,
      },
      update: {
        type: body.type,
        fixedMonthlyAmount: body.fixedMonthlyAmount || 0,
        notes: body.notes || null,
        isActive: body.isActive ?? true,
      },
    });
    return {
      id: row.id,
      teamProfileId: row.teamProfileId,
      type: row.type,
      fixedMonthlyAmount: dec(row.fixedMonthlyAmount),
      notes: row.notes,
      isActive: row.isActive,
    };
  },

  async recordSalaryPayment(body, auth) {
    const profile = await prisma.teamProfile.findFirst({
      where: { id: body.teamProfileId, deletedAt: null },
      include: {
        employeePayables: {
          where: { status: { in: ["ESTIMATED", "CONFIRMED"] } },
          orderBy: { createdAt: "asc" },
        },
        compensationProfile: true,
      },
    });
    if (!profile) throw new AppError("کارمند یافت نشد", 404, "NOT_FOUND");

    const amount = dec(body.amount);
    const paidAt = body.paidAt || new Date();

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.salaryPayment.create({
        data: {
          teamProfileId: body.teamProfileId,
          amount,
          method: body.method,
          paidAt,
          notes: body.notes || null,
          recordedById: auth?.userId || null,
        },
      });

      const type = profile.compensationProfile?.type || "PROJECT_SHARE";
      if (type === "PROJECT_SHARE" && profile.employeePayables.length) {
        const { updates } = allocateSalaryPayment(
          profile.employeePayables.map((p) => ({
            id: p.id,
            amount: dec(p.amount),
          })),
          amount,
        );
        for (const u of updates) {
          if (u.fullyPaid) {
            await tx.employeePayable.update({
              where: { id: u.id },
              data: {
                status: "PAID",
                paidAt,
                paymentMethod: body.method,
              },
            });
          } else if (u.newAmount != null) {
            await tx.employeePayable.update({
              where: { id: u.id },
              data: { amount: u.newAmount },
            });
          }
        }
      }

      return payment;
    });

    return {
      id: result.id,
      teamProfileId: result.teamProfileId,
      amount: dec(result.amount),
      paidAt: result.paidAt,
      method: result.method,
      notes: result.notes,
    };
  },

  async recordSalaryAdvance(body, auth) {
    const profile = await prisma.teamProfile.findFirst({
      where: { id: body.teamProfileId, deletedAt: null },
      select: { id: true },
    });
    if (!profile) throw new AppError("کارمند یافت نشد", 404, "NOT_FOUND");

    const row = await prisma.salaryAdvance.create({
      data: {
        teamProfileId: body.teamProfileId,
        amount: body.amount,
        method: body.method || null,
        paidAt: body.paidAt || new Date(),
        notes: body.notes || null,
        status: "OPEN",
        recordedById: auth?.userId || null,
      },
    });
    return {
      id: row.id,
      teamProfileId: row.teamProfileId,
      amount: dec(row.amount),
      paidAt: row.paidAt,
      method: row.method,
      status: row.status,
      notes: row.notes,
    };
  },

  async settleAdvance(id) {
    const existing = await prisma.salaryAdvance.findUnique({ where: { id } });
    if (!existing) throw new AppError("پیش‌پرداخت یافت نشد", 404, "NOT_FOUND");
    const row = await prisma.salaryAdvance.update({
      where: { id },
      data: { status: "SETTLED", settledAt: new Date() },
    });
    return {
      id: row.id,
      status: row.status,
      settledAt: row.settledAt,
    };
  },

  async getPnlMonth({ year, month }) {
    return buildPnlMonthPayload(year, month);
  },

  async upsertPnlTarget(body, auth) {
    await prisma.financePnlTarget.upsert({
      where: { year_month: { year: body.year, month: body.month } },
      create: {
        year: body.year,
        month: body.month,
        netProfitTarget: body.netProfitTarget,
        advertisingBudget: body.advertisingBudget,
        createdById: auth?.userId || null,
      },
      update: {
        netProfitTarget: body.netProfitTarget,
        advertisingBudget: body.advertisingBudget,
      },
    });

    return buildPnlMonthPayload(body.year, body.month);
  },

  async listPnlMonths() {
    const rows = await prisma.financePnlTarget.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: {
        year: true,
        month: true,
        netProfitTarget: true,
        advertisingBudget: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return {
      items: rows.map((row) => ({
        year: row.year,
        month: row.month,
        netProfitTarget: dec(row.netProfitTarget),
        advertisingBudget: dec(row.advertisingBudget),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    };
  },
};
