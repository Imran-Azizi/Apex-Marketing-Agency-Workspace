/**
 * Shared finance KPI engine — single source of truth for
 * /finance/dashboard, /finance/pnl, and Manager Dashboard finance cards.
 *
 * Rules (aligned with CRM paymentFinance + ProjectFinance):
 * - received = sum of VERIFIED payments with paidAt in range (payments are source of truth)
 * - totalProjectReceipts = totalFinalPrice (sum of project contract values — NOT cash received)
 * - directProjectCosts = narrator + editor + otherDirectCosts from ProjectFinance
 * - projectProfit = totalFinalPrice − directProjectCosts (for scoped projects)
 * - companyExpenses = COMPANY_GENERAL expenses with expenseDate in range
 * - netCompanyProfit = projectProfit − companyExpenses
 * - receivable = sum of project balances for scoped projects
 * - totalFinalPrice = sum of contract prices (finalProjectPrice → agreedPrice → opportunity)
 *
 * Project scope when a date range is set:
 *   include projects with ≥1 VERIFIED payment in [from, to],
 *   OR created/completed in that range (so unpaid new contracts still count).
 * When no range: include all non-deleted projects.
 *
 * monthly[]: last 6 calendar months of contract revenue + verified receipts (always).
 */

import { prisma } from '../../db/prisma.js';
import { APPROVED_PAYMENT_VERIFICATIONS } from '../crm/paymentFinance.js';
import {
  directProjectCosts,
  netCompanyProfit,
  parseDateBound,
  projectProfit,
  roundMoney,
} from './metrics.js';
import { createTtlCache } from '../../utils/ttlCache.js';

const financeSourceCache = createTtlCache();
const FINANCE_SOURCE_TTL_MS = 30_000;

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

function paymentInRange(paidAt, from, to) {
  const d = new Date(paidAt);
  if (Number.isNaN(d.getTime())) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function isApprovedPayment(payment) {
  return APPROVED_PAYMENT_VERIFICATIONS.includes(payment.verification);
}

/**
 * Contract price for a project.
 * Prefer positive cache values; fall through 0 defaults to opportunity.agreedPrice.
 * (Prisma defaults finalProjectPrice/agreedPrice to 0, so `??` alone is wrong.)
 */
export function resolveContractPrice(project) {
  const candidates = [
    project?.finance?.finalProjectPrice,
    project?.finance?.agreedPrice,
    project?.opportunity?.agreedPrice,
  ];
  for (const raw of candidates) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return dec(n);
  }
  return 0;
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function buildLastNMonthKeys(n = 6) {
  const keys = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}

async function sumVerifiedPayments({ from, to }) {
  const where = {
    verification: { in: [...APPROVED_PAYMENT_VERIFICATIONS] },
    ...dateFilter('paidAt', from, to),
  };
  const agg = await prisma.payment.aggregate({
    where,
    _sum: { amount: true },
  });
  return dec(agg._sum.amount || 0);
}

async function sumCompanyExpenses({ from, to }) {
  const where = {
    category: 'COMPANY_GENERAL',
    ...dateFilter('expenseDate', from, to),
  };
  const agg = await prisma.expense.aggregate({
    where,
    _sum: { amount: true },
  });
  return dec(agg._sum.amount || 0);
}

export async function loadAllProjectsForFinanceList() {
  return prisma.project.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      paymentStatus: true,
      deadlineAt: true,
      completedAt: true,
      createdAt: true,
      crmCustomerId: true,
      crmCustomer: {
        select: {
          id: true,
          personName: true,
          companyName: true,
          customerCode: true,
        },
      },
      finance: {
        select: {
          finalProjectPrice: true,
          agreedPrice: true,
          narratorCost: true,
          editorCost: true,
          otherDirectCosts: true,
          received: true,
          currency: true,
        },
      },
      opportunity: {
        select: {
          id: true,
          agreedPrice: true,
          currency: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

function buildPaymentProjectIndexes(projects) {
  const byProjectId = new Map(projects.map((p) => [p.id, p]));
  const byOpportunityId = new Map();
  const byCustomerId = new Map();

  for (const p of projects) {
    if (p.opportunity?.id) byOpportunityId.set(p.opportunity.id, p.id);
    if (!byCustomerId.has(p.crmCustomerId)) byCustomerId.set(p.crmCustomerId, []);
    // Direct CRM payments (no invoice) — only projects with an opportunity
    if (p.opportunity?.id) byCustomerId.get(p.crmCustomerId).push(p.id);
  }

  return { byProjectId, byOpportunityId, byCustomerId };
}

export function resolvePaymentProjectId(payment, indexes) {
  const invoice = payment.invoice;
  if (invoice?.projectId) {
    if (indexes.byProjectId.has(invoice.projectId)) {
      return invoice.projectId;
    }
    return null;
  }
  if (invoice?.opportunityId && indexes.byOpportunityId.has(invoice.opportunityId)) {
    return indexes.byOpportunityId.get(invoice.opportunityId);
  }
  if (!payment.invoiceId && payment.crmCustomerId) {
    const candidates = indexes.byCustomerId.get(payment.crmCustomerId) || [];
    if (candidates.length === 1) return candidates[0];
  }
  return null;
}

export async function loadPaymentsGroupedByProject(projects) {
  const grouped = new Map(projects.map((p) => [p.id, []]));
  if (!projects.length) return grouped;

  const indexes = buildPaymentProjectIndexes(projects);
  const projectIds = projects.map((p) => p.id);
  const oppIds = [...indexes.byOpportunityId.keys()];
  const customerIds = [...new Set(projects.map((p) => p.crmCustomerId))];

  const orClauses = [{ invoice: { projectId: { in: projectIds } } }];
  if (oppIds.length) {
    orClauses.push({ invoice: { opportunityId: { in: oppIds } } });
  }
  if (customerIds.length) {
    orClauses.push({ invoiceId: null, crmCustomerId: { in: customerIds } });
  }

  const payments = await prisma.payment.findMany({
    where: { OR: orClauses },
    select: {
      id: true,
      amount: true,
      paidAt: true,
      method: true,
      verification: true,
      reference: true,
      notes: true,
      invoiceId: true,
      crmCustomerId: true,
      verifiedAt: true,
      rejectionReason: true,
      verifiedBy: { select: { id: true, fullName: true } },
      invoice: {
        select: {
          projectId: true,
          opportunityId: true,
          invoiceNumber: true,
        },
      },
    },
    orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
  });

  for (const payment of payments) {
    const projectId = resolvePaymentProjectId(payment, indexes);
    if (!projectId || !grouped.has(projectId)) continue;
    grouped.get(projectId).push(payment);
  }

  return grouped;
}

async function loadCachedFinanceSource() {
  return financeSourceCache.getOrSet('all', FINANCE_SOURCE_TTL_MS, async () => {
    const projects = await loadAllProjectsForFinanceList();
    const paymentsByProject = await loadPaymentsGroupedByProject(projects);
    return { projects, paymentsByProject };
  });
}

export function projectFinanceMetrics(project, projectPayments) {
  const finance = project.finance;
  const finalProjectPrice = resolveContractPrice(project);
  const approved = (projectPayments || []).filter(isApprovedPayment);
  const received = roundMoney(approved.reduce((sum, p) => sum + dec(p.amount), 0));
  const costs = directProjectCosts({
    narratorCost: finance?.narratorCost,
    editorCost: finance?.editorCost,
    otherDirectCosts: finance?.otherDirectCosts,
  });
  const balance = roundMoney(Math.max(0, finalProjectPrice - received));

  return {
    finalProjectPrice,
    narratorCost: dec(finance?.narratorCost),
    editorCost: dec(finance?.editorCost),
    otherDirectCosts: dec(finance?.otherDirectCosts),
    directCosts: costs,
    received,
    balance,
    profit: projectProfit(finalProjectPrice, costs),
    currency: finance?.currency || project.opportunity?.currency || 'AFN',
  };
}

/**
 * @param {{ from?: Date|string|null, to?: Date|string|null }} range
 */
export async function computeFinanceKpis(range = {}) {
  const from =
    range.from instanceof Date
      ? range.from
      : parseDateBound(range.from, false);
  const to =
    range.to instanceof Date ? range.to : parseDateBound(range.to, true);
  const hasRange = Boolean(from || to);

  const [companyExpenses, source, received] = await Promise.all([
    sumCompanyExpenses({ from, to }),
    loadCachedFinanceSource(),
    sumVerifiedPayments({ from, to }),
  ]);
  const { projects, paymentsByProject } = source;

  let totalFinalPrice = 0;
  let directProjectCosts = 0;
  let receivable = 0;
  let narratorCost = 0;
  let editorCost = 0;
  let otherDirectCosts = 0;
  let scopedProjectCount = 0;

  const monthKeys = buildLastNMonthKeys(6);
  const monthlyMap = new Map(
    monthKeys.map((k) => [k, { revenue: 0, received: 0 }]),
  );

  for (const project of projects) {
    const payments = paymentsByProject.get(project.id) || [];
    const m = projectFinanceMetrics(project, payments);

    // Monthly trend is always last 6 calendar months (independent of KPI date filter).
    const anchor = project.completedAt || project.createdAt;
    if (anchor) {
      const mk = monthKey(new Date(anchor));
      if (monthlyMap.has(mk)) {
        const row = monthlyMap.get(mk);
        row.revenue = roundMoney(row.revenue + m.finalProjectPrice);
      }
    }
    for (const p of payments) {
      if (!isApprovedPayment(p) || !p.paidAt) continue;
      const mk = monthKey(new Date(p.paidAt));
      if (!monthlyMap.has(mk)) continue;
      const row = monthlyMap.get(mk);
      row.received = roundMoney(row.received + dec(p.amount));
    }

    const verifiedInRange = hasRange
      ? payments.filter(
          (p) => isApprovedPayment(p) && paymentInRange(p.paidAt, from, to),
        )
      : payments.filter(isApprovedPayment);

    // Date scope: verified payment in-range, or project created/completed in-range.
    let inScope = !hasRange || verifiedInRange.length > 0;
    if (hasRange && !inScope) {
      const createdIn = paymentInRange(project.createdAt, from, to);
      const completedIn = project.completedAt
        ? paymentInRange(project.completedAt, from, to)
        : false;
      inScope = createdIn || completedIn;
    }
    if (!inScope) continue;

    scopedProjectCount += 1;
    totalFinalPrice = roundMoney(totalFinalPrice + m.finalProjectPrice);
    directProjectCosts = roundMoney(directProjectCosts + m.directCosts);
    receivable = roundMoney(receivable + m.balance);
    narratorCost = roundMoney(narratorCost + m.narratorCost);
    editorCost = roundMoney(editorCost + m.editorCost);
    otherDirectCosts = roundMoney(otherDirectCosts + m.otherDirectCosts);
  }

  const projectProfitVal = projectProfit(totalFinalPrice, directProjectCosts);
  const netCompanyProfitVal = netCompanyProfit(projectProfitVal, companyExpenses);

  const monthly = monthKeys.map((k) => {
    const [y, m] = k.split('-').map(Number);
    const row = monthlyMap.get(k);
    return {
      key: k,
      year: y,
      month: m,
      revenue: row?.revenue || 0,
      received: row?.received || 0,
    };
  });

  return {
    received,
    // Dashboard label «مجموع دریافتی پروژه‌ها» = total project contract value,
    // not cash collected (that is `received` / «دریافت شده»).
    totalProjectReceipts: totalFinalPrice,
    receivable,
    directProjectCosts,
    narratorCost,
    editorCost,
    otherDirectCosts,
    totalFinalPrice,
    projectProfit: projectProfitVal,
    companyExpenses,
    netCompanyProfit: netCompanyProfitVal,
    scopedProjectCount,
    monthly,
    range: {
      from: from?.toISOString() || null,
      to: to?.toISOString() || null,
    },
  };
}
