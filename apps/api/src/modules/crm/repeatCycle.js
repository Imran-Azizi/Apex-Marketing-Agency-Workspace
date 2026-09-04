/**
 * One customer → multiple independent project/order cycles.
 * Same CrmCustomer + portal account; each cycle is a fresh Opportunity
 * with empty contract/payment fields. Never copies project finance.
 */

import { getCustomerPersonName } from '../../utils/crmCustomerName.js';

export function buildFreshOpportunityData(customer, { title, pipelineStage } = {}) {
  const name = getCustomerPersonName(customer);
  return {
    crmCustomerId: customer.id,
    title: title || `سفارش جدید — ${name}`,
    pipelineStage: pipelineStage || "REPEAT_CUSTOMER",
    serviceId: null,
    lostReason: null,
    proposedPrice: null,
    agreedPrice: null,
    advancePayment: null,
    agreedTerms: null,
    contractLocked: false,
    contractLockedAt: null,
    contractLockedById: null,
    projectId: null,
  };
}

/** Customer-level fields available for a new order cycle (never project finance). */
export function snapshotCustomerProfile(customer) {
  return {
    personName: customer.personName || null,
    whatsappRaw: customer.whatsappRaw || null,
    normalizedWhatsapp: customer.normalizedWhatsapp || null,
    source: customer.source || null,
    salesOwnerId: customer.salesOwnerId || null,
    companyName: customer.companyName || null,
    jobTitle: customer.jobTitle || null,
    phone: customer.phone || null,
    city: customer.city || null,
    email: customer.email || null,
  };
}

/**
 * Open (or reuse) a blank opportunity for a new project cycle.
 * Reuses only an unused open opportunity with no project and no contract data.
 * Prior opportunities with locked contracts / projects are left untouched.
 */
export async function openFreshCycleOpportunity(tx, customer, extras = {}) {
  const { alwaysCreate = false, title, pipelineStage, ...rest } = extras;

  if (!alwaysCreate) {
    const open = await tx.opportunity.findFirst({
      where: {
        crmCustomerId: customer.id,
        deletedAt: null,
        projectId: null,
        contractLocked: false,
        pipelineStage: { not: "LOST_CANCELED" },
        agreedPrice: null,
        advancePayment: null,
        proposedPrice: null,
        agreedTerms: null,
        invoices: { none: {} },
        payments: { none: {} },
      },
      orderBy: { createdAt: "desc" },
    });

    if (open) {
      return { opportunity: open, created: false };
    }
  }

  const opportunity = await tx.opportunity.create({
    data: buildFreshOpportunityData(customer, { title, pipelineStage, ...rest }),
  });
  return { opportunity, created: true };
}
