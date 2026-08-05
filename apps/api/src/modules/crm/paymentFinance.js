/**
 * Dynamic CRM payment / contract financial calculations.
 * Payments are the source of truth; Opportunity.advancePayment and
 * ProjectFinance.received / finalProjectPrice are synced caches only.
 *
 * Remaining (display / reports) = Total Project Price − Sum(APPROVED payments)
 * Cap validation uses APPROVED + PENDING so stacked pending rows cannot exceed the contract.
 *
 * Approval status mapping (VerificationStatus):
 *   PENDING  = awaiting manager approval (excluded from finance)
 *   VERIFIED = approved (included in all financial calculations)
 *   REJECTED = rejected (never included)
 */

import { AppError } from '../../utils/response.js';

/** Payments that affect revenue, balance, profit, reports, dashboards. */
export const APPROVED_PAYMENT_VERIFICATIONS = Object.freeze(['VERIFIED']);

/** Payments that reserve remaining balance when creating/editing (approved + pending). */
export const RESERVED_PAYMENT_VERIFICATIONS = Object.freeze(['PENDING', 'VERIFIED']);

/** @deprecated Use APPROVED_PAYMENT_VERIFICATIONS — only approved payments are financially active. */
export const ACTIVE_PAYMENT_VERIFICATIONS = APPROVED_PAYMENT_VERIFICATIONS;

const MONEY_EPS = 0.009; // tolerate float noise under 1 افغانی cent

export function roundMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

export function computeFinanceSnapshot(agreedPrice, totalPaid, extras = {}) {
  const projectTotal = roundMoney(Math.max(0, Number(agreedPrice) || 0));
  const paid = roundMoney(Math.max(0, Number(totalPaid) || 0));
  const remainingBalance = roundMoney(Math.max(0, projectTotal - paid));
  // Customer debt / unpaid obligation equals remaining contract balance.
  const customerDebt = remainingBalance;
  return {
    projectTotal,
    totalPaid: paid,
    remainingBalance,
    customerDebt,
    ...extras,
  };
}

/**
 * Prisma where-clause for payments that belong to a contract/opportunity.
 * Direct CRM payments (no invoice) + invoice payments for this opportunity.
 */
export function paymentsWhere({
  crmCustomerId,
  opportunityId,
  excludePaymentId,
  verifications = APPROVED_PAYMENT_VERIFICATIONS,
}) {
  const where = {
    crmCustomerId,
    verification: { in: [...verifications] },
    OR: [
      { invoiceId: null },
      ...(opportunityId
        ? [{ invoice: { opportunityId } }]
        : [{ invoiceId: { not: null } }]),
    ],
  };
  if (excludePaymentId) {
    where.id = { not: excludePaymentId };
  }
  return where;
}

/** @deprecated Prefer paymentsWhere with APPROVED statuses. */
export function activePaymentsWhere(opts) {
  return paymentsWhere({ ...opts, verifications: APPROVED_PAYMENT_VERIFICATIONS });
}

export async function sumPayments(db, opts, verifications = APPROVED_PAYMENT_VERIFICATIONS) {
  const agg = await db.payment.aggregate({
    where: paymentsWhere({ ...opts, verifications }),
    _sum: { amount: true },
  });
  return roundMoney(agg._sum.amount || 0);
}

export async function sumActivePayments(db, opts) {
  return sumPayments(db, opts, APPROVED_PAYMENT_VERIFICATIONS);
}

export async function sumReservedPayments(db, opts) {
  return sumPayments(db, opts, RESERVED_PAYMENT_VERIFICATIONS);
}

/**
 * Push live payment totals into ProjectFinance so portal / projects / delivery
 * all read the same numbers as CRM.
 */
export async function persistProjectFinanceCache(db, projectId, financeSnapshot) {
  if (!projectId || !financeSnapshot) return null;

  const row = await db.projectFinance.findUnique({ where: { projectId } });
  if (!row) return null;

  const agreed = roundMoney(financeSnapshot.projectTotal);
  const discount = roundMoney(row.discount);
  const finalProjectPrice = roundMoney(Math.max(0, agreed - discount));
  const received = roundMoney(financeSnapshot.totalPaid);

  const data = {};
  if (roundMoney(row.agreedPrice) !== agreed) data.agreedPrice = agreed;
  if (roundMoney(row.finalProjectPrice) !== finalProjectPrice) {
    data.finalProjectPrice = finalProjectPrice;
  }
  if (roundMoney(row.received) !== received) data.received = received;

  let updated = row;
  if (Object.keys(data).length) {
    updated = await db.projectFinance.update({
      where: { projectId },
      data,
    });
  }

  try {
    const { syncProjectDeliveryFields } = await import('../../services/deliveryAccess.js');
    await syncProjectDeliveryFields(db, projectId);
  } catch {
    // Delivery sync is best-effort; finance cache is still updated.
  }

  return {
    ...updated,
    balance: roundMoney(Number(updated.finalProjectPrice) - Number(updated.received)),
  };
}

/**
 * Load opportunity, sum approved payments, optionally persist caches
 * (Opportunity.advancePayment + linked ProjectFinance).
 * @returns {{ opportunity, finance, projectFinance }}
 */
export async function syncOpportunityFinance(db, opportunityId, { persist = true } = {}) {
  const opportunity = await db.opportunity.findFirst({
    where: { id: opportunityId, deletedAt: null },
    select: {
      id: true,
      crmCustomerId: true,
      agreedPrice: true,
      advancePayment: true,
      projectId: true,
      title: true,
      agreedTerms: true,
      contractLocked: true,
      contractLockedAt: true,
    },
  });
  if (!opportunity) {
    throw new AppError('فرصت یافت نشد', 404, 'NOT_FOUND');
  }

  const totalPaid = await sumActivePayments(db, {
    crmCustomerId: opportunity.crmCustomerId,
    opportunityId: opportunity.id,
  });
  const reservedPaid = await sumReservedPayments(db, {
    crmCustomerId: opportunity.crmCustomerId,
    opportunityId: opportunity.id,
  });
  const pendingApprovalTotal = roundMoney(Math.max(0, reservedPaid - totalPaid));
  const availableToRecord = roundMoney(Math.max(0, roundMoney(Number(opportunity.agreedPrice) || 0) - reservedPaid));
  const finance = computeFinanceSnapshot(opportunity.agreedPrice, totalPaid, {
    pendingApprovalTotal,
    reservedPaid,
    availableToRecord,
  });
  let projectFinance = null;

  if (persist) {
    const current = opportunity.advancePayment == null
      ? null
      : roundMoney(opportunity.advancePayment);
    if (current !== finance.totalPaid) {
      await db.opportunity.update({
        where: { id: opportunity.id },
        data: { advancePayment: finance.totalPaid },
      });
    }

    if (opportunity.projectId) {
      projectFinance = await persistProjectFinanceCache(
        db,
        opportunity.projectId,
        finance,
      );
    }
  }

  return { opportunity, finance, projectFinance };
}

/**
 * Sync ProjectFinance from the linked opportunity's live payments.
 * Safe no-op when the project has no opportunity yet.
 */
export async function syncProjectFinanceFromPayments(db, projectId, { persist = true } = {}) {
  if (!projectId) return null;

  const opportunity = await db.opportunity.findFirst({
    where: { projectId, deletedAt: null },
    select: { id: true },
  });

  if (opportunity) {
    return syncOpportunityFinance(db, opportunity.id, { persist });
  }

  // Fallback: project invoices + direct customer payments
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      crmCustomerId: true,
      finance: true,
    },
  });
  if (!project?.finance) return null;

  const agg = await db.payment.aggregate({
    where: {
      verification: { in: [...APPROVED_PAYMENT_VERIFICATIONS] },
      OR: [
        { invoice: { projectId } },
        {
          invoiceId: null,
          crmCustomerId: project.crmCustomerId,
        },
      ],
    },
    _sum: { amount: true },
  });
  const finance = computeFinanceSnapshot(
    project.finance.agreedPrice ?? project.finance.finalProjectPrice,
    agg._sum.amount || 0,
  );

  const projectFinance = persist
    ? await persistProjectFinanceCache(db, projectId, finance)
    : null;

  return {
    opportunity: null,
    finance,
    projectFinance,
  };
}

/**
 * Live finance snapshots for many opportunities in two queries (approved + reserved).
 * Same payment matching rules as syncOpportunityFinance(..., { persist: false }).
 * @param {Array<{ id: string, crmCustomerId: string, agreedPrice: any }>} opportunities
 * @returns {Promise<Map<string, ReturnType<typeof computeFinanceSnapshot>>>}
 */
export async function batchOpportunityFinanceSnapshots(db, opportunities) {
  const map = new Map();
  if (!opportunities?.length) return map;

  const customerIds = [...new Set(opportunities.map((o) => o.crmCustomerId).filter(Boolean))];
  const oppIds = opportunities.map((o) => o.id).filter(Boolean);
  if (!customerIds.length || !oppIds.length) {
    for (const opp of opportunities) {
      map.set(opp.id, computeFinanceSnapshot(opp.agreedPrice, 0, {
        pendingApprovalTotal: 0,
        reservedPaid: 0,
        availableToRecord: roundMoney(Math.max(0, Number(opp.agreedPrice) || 0)),
      }));
    }
    return map;
  }

  const paymentSelect = {
    amount: true,
    crmCustomerId: true,
    invoiceId: true,
    verification: true,
    invoice: { select: { opportunityId: true } },
  };
  const paymentOr = [
    { invoiceId: null },
    { invoice: { opportunityId: { in: oppIds } } },
  ];

  const reservedRows = await db.payment.findMany({
    where: {
      crmCustomerId: { in: customerIds },
      verification: { in: [...RESERVED_PAYMENT_VERIFICATIONS] },
      OR: paymentOr,
    },
    select: paymentSelect,
  });

  const approvedSet = new Set(APPROVED_PAYMENT_VERIFICATIONS);

  function paymentMatchesOpp(payment, opp) {
    if (payment.crmCustomerId !== opp.crmCustomerId) return false;
    if (!payment.invoiceId) return true;
    return payment.invoice?.opportunityId === opp.id;
  }

  for (const opp of opportunities) {
    let totalPaid = 0;
    let reservedPaid = 0;
    for (const p of reservedRows) {
      if (!paymentMatchesOpp(p, opp)) continue;
      const amt = Number(p.amount) || 0;
      reservedPaid += amt;
      if (approvedSet.has(p.verification)) totalPaid += amt;
    }
    totalPaid = roundMoney(totalPaid);
    reservedPaid = roundMoney(reservedPaid);
    const pendingApprovalTotal = roundMoney(Math.max(0, reservedPaid - totalPaid));
    const agreed = roundMoney(Number(opp.agreedPrice) || 0);
    const availableToRecord = roundMoney(Math.max(0, agreed - reservedPaid));
    map.set(
      opp.id,
      computeFinanceSnapshot(opp.agreedPrice, totalPaid, {
        pendingApprovalTotal,
        reservedPaid,
        availableToRecord,
      }),
    );
  }

  return map;
}

/**
 * Apply live opportunity finance onto in-memory project.finance rows (no DB writes).
 * @param {Array<{ id: string, finance?: any }>} projects
 * @param {Array<{ id: string, projectId: string|null, crmCustomerId: string, agreedPrice: any }>} opportunities
 */
export async function hydrateProjectsFinanceFromOpportunities(db, projects, opportunities) {
  if (!projects?.length) return;
  const financeByOpp = await batchOpportunityFinanceSnapshots(db, opportunities || []);
  const financeByProject = new Map();
  for (const opp of opportunities || []) {
    if (!opp.projectId) continue;
    const finance = financeByOpp.get(opp.id);
    if (finance) financeByProject.set(opp.projectId, finance);
  }
  for (const project of projects) {
    const finance = financeByProject.get(project.id);
    if (!finance || !project.finance) continue;
    project.finance = {
      ...project.finance,
      finalProjectPrice: finance.projectTotal,
      received: finance.totalPaid,
    };
  }
}

/**
 * Sync finance for every non-deleted opportunity of a customer.
 * Used after payment delete / status change when opportunity link is ambiguous.
 */
export async function syncCustomerOpportunitiesFinance(db, crmCustomerId) {
  const opps = await db.opportunity.findMany({
    where: { crmCustomerId, deletedAt: null },
    select: { id: true },
  });
  const results = [];
  for (const opp of opps) {
    results.push(await syncOpportunityFinance(db, opp.id, { persist: true }));
  }
  return results;
}

export function canOverrideOverpayment(auth) {
  const role = auth?.roleCode;
  return role === 'ADMIN' || role === 'MANAGER';
}

/**
 * Ensure a new/updated payment amount does not exceed remaining balance.
 * @param {object} opts
 * @param {number} opts.amount
 * @param {number} opts.remainingBalance - remaining BEFORE applying this amount
 * @param {boolean} [opts.allowOverpayment]
 * @param {object} [opts.auth]
 */
export function assertPaymentWithinRemaining({
  amount,
  remainingBalance,
  allowOverpayment = false,
  auth,
}) {
  const amt = roundMoney(amount);
  const remaining = roundMoney(remainingBalance);

  if (!(amt > 0)) {
    throw new AppError('مبلغ باید عدد مثبت باشد', 400, 'VALIDATION');
  }

  if (amt <= remaining + MONEY_EPS) return;

  const overrideOk = allowOverpayment && canOverrideOverpayment(auth);
  if (!overrideOk) {
    throw new AppError(
      'مبلغ پرداخت نمی‌تواند بیشتر از مبلغ باقی‌مانده پروژه باشد.',
      400,
      'PAYMENT_EXCEEDS_REMAINING',
      {
        amount: amt,
        remainingBalance: remaining,
      },
    );
  }
}

/**
 * Compute remaining available for a new payment (or edit excluding self).
 * Uses reserved (PENDING + VERIFIED) so pending approvals still occupy the cap.
 * Financial displays continue to use syncOpportunityFinance (approved only).
 */
export async function getAvailableRemaining(db, {
  opportunityId,
  crmCustomerId,
  excludePaymentId,
}) {
  let oppId = opportunityId;

  if (oppId) {
    const opportunity = await db.opportunity.findFirst({
      where: { id: oppId, deletedAt: null },
      select: {
        id: true,
        crmCustomerId: true,
        agreedPrice: true,
      },
    });
    if (!opportunity) {
      throw new AppError('فرصت یافت نشد', 404, 'NOT_FOUND');
    }
    const paid = await sumReservedPayments(db, {
      crmCustomerId: opportunity.crmCustomerId,
      opportunityId: opportunity.id,
      excludePaymentId,
    });
    return computeFinanceSnapshot(opportunity.agreedPrice, paid);
  }

  if (!crmCustomerId) {
    return computeFinanceSnapshot(0, 0);
  }

  const paid = await sumReservedPayments(db, {
    crmCustomerId,
    opportunityId: null,
    excludePaymentId,
  });
  return computeFinanceSnapshot(0, paid);
}
