/**
 * Shared finance KPI engine — single source of truth for
 * /finance/dashboard, /finance/pnl, and Manager Dashboard finance cards.
 *
 * Rules (aligned with CRM paymentFinance + ProjectFinance):
 * - received = sum of VERIFIED payments with paidAt in range (payments are source of truth)
 * - directProjectCosts = narrator + editor + otherDirectCosts from ProjectFinance
 * - projectProfit = totalFinalPrice − directProjectCosts (for scoped projects)
 * - companyExpenses = COMPANY_GENERAL expenses with expenseDate in range
 * - netCompanyProfit = projectProfit − companyExpenses
 * - receivable = sum of project balances for scoped projects
 *
 * Project scope when a date range is set:
 *   include projects with ≥1 VERIFIED payment whose paidAt falls in [from, to].
 * When no range: include all non-deleted projects.
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

export function projectFinanceMetrics(project, projectPayments) {
  const finance = project.finance;
  const agreed =
    finance?.finalProjectPrice ??
    finance?.agreedPrice ??
    project.opportunity?.agreedPrice ??
    0;
  const finalProjectPrice = dec(agreed);
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

  const [companyExpenses, projects, received] = await Promise.all([
    sumCompanyExpenses({ from, to }),
    loadAllProjectsForFinanceList(),
    sumVerifiedPayments({ from, to }),
  ]);
  const paymentsByProject = await loadPaymentsGroupedByProject(projects);

  let totalFinalPrice = 0;
  let directProjectCosts = 0;
  let receivable = 0;
  let narratorCost = 0;
  let editorCost = 0;
  let otherDirectCosts = 0;

  for (const project of projects) {
    const payments = paymentsByProject.get(project.id) || [];
    const verifiedInRange = hasRange
      ? payments.filter(
          (p) => isApprovedPayment(p) && paymentInRange(p.paidAt, from, to),
        )
      : payments.filter(isApprovedPayment);

    if (hasRange && verifiedInRange.length === 0) continue;

    const m = projectFinanceMetrics(project, payments);

    totalFinalPrice = roundMoney(totalFinalPrice + m.finalProjectPrice);
    directProjectCosts = roundMoney(directProjectCosts + m.directCosts);
    receivable = roundMoney(receivable + m.balance);
    narratorCost = roundMoney(narratorCost + m.narratorCost);
    editorCost = roundMoney(editorCost + m.editorCost);
    otherDirectCosts = roundMoney(otherDirectCosts + m.otherDirectCosts);
  }

  const projectProfitVal = projectProfit(totalFinalPrice, directProjectCosts);
  const netCompanyProfitVal = netCompanyProfit(projectProfitVal, companyExpenses);

  return {
    received,
    totalProjectReceipts: received,
    receivable,
    directProjectCosts,
    narratorCost,
    editorCost,
    otherDirectCosts,
    totalFinalPrice,
    projectProfit: projectProfitVal,
    companyExpenses,
    netCompanyProfit: netCompanyProfitVal,
    range: {
      from: from?.toISOString() || null,
      to: to?.toISOString() || null,
    },
  };
}
