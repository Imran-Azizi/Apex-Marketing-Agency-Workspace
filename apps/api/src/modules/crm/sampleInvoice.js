/**
 * CRM و فروش invoices are sample/preview documents.
 * They must never post Payment rows or enter finance, dashboards, or P&L.
 */

import { roundMoney } from './paymentFinance.js';

const MONEY_EPS = 0.009;

/** Sample invoice: created from CRM و فروش with no contract/project link. */
export function isSampleCrmInvoice(invoice) {
  return Boolean(invoice) && !invoice.opportunityId && !invoice.projectId;
}

/** Real (financial) invoices linked to a contract or project. */
export function financialInvoiceWhere() {
  return {
    OR: [
      { opportunityId: { not: null } },
      { projectId: { not: null } },
    ],
  };
}

/**
 * Payments that may affect revenue, received totals, P&L, and CRM "our customers".
 * Direct payments (no invoice) and payments on contract/project invoices.
 * Excludes payments attached to CRM sample invoices.
 */
export function financialPaymentWhere() {
  return {
    OR: [
      { invoiceId: null },
      { invoice: { opportunityId: { not: null } } },
      { invoice: { projectId: { not: null } } },
    ],
  };
}

export function sampleInvoiceDisplayStatus(total, quotedPaid) {
  const t = roundMoney(total);
  const paid = roundMoney(quotedPaid);
  if (paid <= 0) return 'ISSUED';
  if (paid + MONEY_EPS < t) return 'PARTIALLY_PAID';
  return 'PAID';
}

/**
 * Display-only payable for a sample invoice.
 * Prefer quotedPaidAmount; fall back to legacy Payment sums so old bills still render.
 */
export function resolveSampleInvoicePaidAmount(invoice, paymentSum = 0) {
  const quoted = roundMoney(invoice?.quotedPaidAmount);
  if (quoted > 0) return quoted;
  const meta = invoice?.paymentMethodMeta;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const fromMeta = roundMoney(meta.quotedPaidAmount);
    if (fromMeta > 0) return fromMeta;
  }
  return roundMoney(paymentSum);
}
