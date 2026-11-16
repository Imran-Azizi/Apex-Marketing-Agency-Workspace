/**
 * One customer → multiple independent project/order cycles.
 * Same CrmCustomer + portal account; each cycle is a fresh Opportunity
 * with empty contract/payment fields. Never copies project finance.
 */

import { getCustomerPersonName } from '../../utils/crmCustomerName.js';

/** Commercial fields for a blank project cycle (never copy prior deal price). */
export function blankOpportunityCommercials() {
  return {
    proposedPrice: null,
    agreedPrice: null,
    advancePayment: null,
    agreedTerms: null,
    contractLocked: false,
    contractLockedAt: null,
    contractLockedById: null,
  };
}

export function buildFreshOpportunityData(customer, { title, pipelineStage } = {}) {
  const name = getCustomerPersonName(customer);
  return {
    crmCustomerId: customer.id,
    title: title || `سفارش جدید — ${name}`,
    pipelineStage: pipelineStage || "REPEAT_CUSTOMER",
    serviceId: null,
    lostReason: null,
    ...blankOpportunityCommercials(),
    projectId: null,
  };
}

/**
 * After a project is removed, detach its opportunity and clear commercials
 * so the next project for the same customer cannot inherit the old price.
 */
export async function detachOpportunityFromDeletedProject(
  tx,
  opportunityId,
  { pipelineStage = "DEPOSIT_CONFIRMED" } = {},
) {
  return tx.opportunity.update({
    where: { id: opportunityId },
    data: {
      projectId: null,
      pipelineStage,
      ...blankOpportunityCommercials(),
    },
  });
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

/** Unused open sales cycles: no project, commercials, invoices, or payments. */
function blankOpenOpportunityWhere(customerId) {
  return {
    crmCustomerId: customerId,
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
  };
}

/**
 * Keep at most one blank open opportunity per customer; soft-delete the rest.
 * One empty cycle is useful for the next order — duplicates only clutter CRM.
 */
export async function pruneBlankOpenOpportunities(
  tx,
  customerId,
  { keepId = null } = {},
) {
  const blanks = await tx.opportunity.findMany({
    where: blankOpenOpportunityWhere(customerId),
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (blanks.length <= 1) {
    return { removed: 0, keptId: blanks[0]?.id || null };
  }

  const keep =
    keepId && blanks.some((row) => row.id === keepId) ? keepId : blanks[0].id;
  const toRemove = blanks.filter((row) => row.id !== keep).map((row) => row.id);

  await tx.opportunity.updateMany({
    where: { id: { in: toRemove } },
    data: {
      deletedAt: new Date(),
      pipelineStage: "LOST_CANCELED",
      lostReason: "فرصت فروش خالی تکراری",
    },
  });
  return { removed: toRemove.length, keptId: keep };
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
      where: blankOpenOpportunityWhere(customer.id),
      orderBy: { createdAt: "desc" },
    });

    if (open) {
      await pruneBlankOpenOpportunities(tx, customer.id, { keepId: open.id });
      return { opportunity: open, created: false };
    }
  }

  const opportunity = await tx.opportunity.create({
    data: buildFreshOpportunityData(customer, { title, pipelineStage, ...rest }),
  });
  // The new cycle may be linked to a project next; still clear older blank duplicates.
  await pruneBlankOpenOpportunities(tx, customer.id, { keepId: opportunity.id });
  return { opportunity, created: true };
}
