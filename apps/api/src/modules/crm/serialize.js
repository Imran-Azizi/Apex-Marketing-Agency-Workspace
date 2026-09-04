import {
  canonicalizeStage,
  deriveCategory,
  categoryLabel,
  getAllowedActions,
  isActiveInManagement,
  stageControl,
  stageLabel,
} from './pipeline.js';
import { LEAD_SOURCE_LABELS } from './constants.js';

export function formatLeadSourceLabel(source) {
  if (!source) return null;
  if (source.startsWith('OTHER:')) {
    const detail = source.slice(6).trim();
    return detail ? `سایر: ${detail}` : LEAD_SOURCE_LABELS.OTHER;
  }
  return LEAD_SOURCE_LABELS[source] || source;
}

export function withCrmView(customer, auth = {}, extras = {}) {
  if (!customer) return customer;
  const stage = canonicalizeStage(customer.pipelineStage);
  const category = deriveCategory({
    ...customer,
    pipelineStage: stage,
    hasVerifiedPayment: customer.hasVerifiedPayment ?? extras.hasVerifiedPayment,
    hasProject: customer.hasProject ?? extras.hasProject,
    hasPayment: customer.hasPayment ?? extras.hasPayment,
  });
  return {
    ...customer,
    pipelineStage: stage,
    pipelineStageLabel: stageLabel(stage),
    stageControl: stageControl(stage),
    category,
    categoryLabel: categoryLabel(category),
    isConverted: Boolean(customer.convertedAt),
    isActiveInManagement: isActiveInManagement({
      ...customer,
      pipelineStage: stage,
      hasVerifiedPayment: customer.hasVerifiedPayment ?? extras.hasVerifiedPayment,
      hasProject: customer.hasProject ?? extras.hasProject,
      hasPayment: customer.hasPayment ?? extras.hasPayment,
    }),
    allowedActions: getAllowedActions(
      { ...customer, pipelineStage: stage },
      auth,
      extras,
    ),
  };
}

export function serializeListItem(customer, auth) {
  const opp = customer.opportunities?.[0] || null;
  const hasVerifiedPayment = Boolean(customer.payments?.length);
  const hasProject = Boolean(customer._count?.projects);
  const hasPayment = Boolean(customer._count?.payments);
  const view = withCrmView(
    { ...customer, hasVerifiedPayment, hasProject, hasPayment },
    auth,
    {
      hasProject,
      hasInvoice: Boolean(customer._count?.invoices),
      hasPayment,
      hasVerifiedPayment,
    },
  );
  const confirmedStages = new Set([
    'DEPOSIT_CONFIRMED',
    'PORTAL_INVITED',
    'PROJECT_CREATED',
    'DELIVERED',
    'REPEAT_CUSTOMER',
  ]);
  let paymentStatus = 'UNPAID';
  if (view.convertedAt || confirmedStages.has(view.pipelineStage)) {
    paymentStatus = 'DEPOSIT_CONFIRMED';
  } else if (view.pipelineStage === 'DEPOSIT_PENDING') {
    paymentStatus = 'DEPOSIT_PENDING';
  }

  return {
    id: view.id,
    customerCode: view.customerCode,
    personName: view.personName,
    companyName: view.companyName,
    jobTitle: view.jobTitle,
    phone: view.phone,
    whatsappRaw: view.whatsappRaw,
    normalizedWhatsapp: view.normalizedWhatsapp,
    phoneCountryIso: view.phoneCountryIso,
    city: view.city,
    address: view.address,
    notes: view.notes,
    nextFollowUpAt: view.nextFollowUpAt,
    email: view.email,
    source: view.source,
    salesOwnerId: view.salesOwnerId,
    salesOwner: view.salesOwner,
    pipelineStage: view.pipelineStage,
    pipelineStageLabel: view.pipelineStageLabel,
    stageControl: view.stageControl,
    category: view.category,
    categoryLabel: view.categoryLabel,
    convertedAt: view.convertedAt,
    isConverted: view.isConverted,
    isActiveInManagement: view.isActiveInManagement,
    lastContactAt: view.lastContactAt,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
    portalStatus: view.portalStatus,
    orderAmount: opp?.agreedPrice != null ? Number(opp.agreedPrice) : null,
    paymentStatus,
    allowedActions: view.allowedActions,
  };
}
