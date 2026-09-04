/**
 * Hydrate a CRM customer into the snapshot the rules engine expects.
 */

import { prisma } from '../../db/prisma.js';
import { canonicalizeStage, stageLabel } from '../crm/pipeline.js';
import { getCustomerCompanyName, getCustomerPersonName } from '../../utils/crmCustomerName.js';
import {
  deriveStageEnteredAt,
  hoursSince,
  isCustomerActivity,
  isMeaningfulProgress,
  isSalesActivity,
} from './rules.js';

const ACTIVITY_TAKE = 40;

function num(value) {
  if (value == null) return 0;
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    return value.toNumber();
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function loadCustomerContext(customerId, now = new Date()) {
  const customer = await prisma.crmCustomer.findFirst({
    where: { id: customerId, deletedAt: null },
    include: {
      salesOwner: { select: { id: true, fullName: true } },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_TAKE,
        include: { actor: { select: { id: true, fullName: true } } },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          amount: true,
          verification: true,
          paidAt: true,
          createdAt: true,
        },
      },
      projects: {
        where: { deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
          createdAt: true,
        },
      },
      opportunities: {
        where: { deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: { service: { select: { name: true } } },
      },
      invoices: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          invoiceNumber: true,
          status: true,
          total: true,
        },
      },
    },
  });

  if (!customer) return null;

  const stage = canonicalizeStage(customer.pipelineStage);
  const activities = customer.activities || [];
  const stageEnteredAt = deriveStageEnteredAt({ ...customer, pipelineStage: stage }, activities);
  const daysInStage = hoursSince(stageEnteredAt, now) / 24;
  const activitiesAfterStage = activities.filter((a) => {
    const t = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
    return t.getTime() > stageEnteredAt.getTime() + 1000;
  });

  const lastCustomerMessage = activities.find(isCustomerActivity) || null;
  const lastSalesMessage = activities.find(isSalesActivity) || null;
  const lastMeaningful = activities.find(isMeaningfulProgress) || null;

  const verifiedPayments = customer.payments.filter((p) => p.verification === 'VERIFIED');
  const hasVerifiedDeposit = verifiedPayments.length > 0;

  const deliveredProjects = customer.projects.filter((p) => {
    const s = String(p.status || '');
    return s === 'COMPLETED' || s === 'READY_TO_DOWNLOAD';
  });
  const lastDelivered = deliveredProjects[0] || (stage === 'DELIVERED' ? customer.projects[0] : null);
  const lastDeliveredAt = lastDelivered?.updatedAt || lastDelivered?.createdAt || null;

  const openSalesStages = new Set([
    'NEW_LEAD',
    'CONTACTED',
    'INFORMATION_SENT',
    'PROPOSAL_PRICE_SENT',
    'WAITING_DECISION',
    'ORDER_CONFIRMED',
    'DEPOSIT_PENDING',
  ]);
  const hasOpenSalesCycle = customer.opportunities.some(
    (o) => openSalesStages.has(canonicalizeStage(o.pipelineStage)),
  );

  const facts = [
    `نام: ${getCustomerPersonName(customer)}`,
    customer.companyName ? `شرکت: ${getCustomerCompanyName(customer)}` : null,
    `کد مشتری: ${customer.customerCode}`,
    `مرحله CRM: ${stageLabel(stage)} (${stage})`,
    customer.salesOwner?.fullName ? `مسئول فروش: ${customer.salesOwner.fullName}` : 'مسئول فروش تعیین نشده',
    `مدت در مرحله فعلی: حدود ${Math.round(daysInStage * 10) / 10} روز`,
    verifiedPayments.length
      ? `پرداخت تأییدشده: ${verifiedPayments.length} مورد`
      : 'پرداخت تأییدشده ثبت نشده',
    customer.projects.length
      ? `تعداد پروژه: ${customer.projects.length}`
      : 'پروژه‌ای ثبت نشده',
  ].filter(Boolean);

  if (customer.notes) facts.push('یادداشت فروش در پرونده موجود است');

  return {
    customerId: customer.id,
    customerCode: customer.customerCode,
    personName: getCustomerPersonName(customer),
    companyName: getCustomerCompanyName(customer),
    notes: customer.notes || null,
    pipelineStage: stage,
    salesOwnerId: customer.salesOwnerId,
    salesOwnerName: customer.salesOwner?.fullName || null,
    lastContactAt: customer.lastContactAt,
    createdAt: customer.createdAt,
    stageEnteredAt,
    daysInStage,
    activities,
    activitiesAfterStage,
    lastCustomerMessage,
    lastSalesMessage,
    lastMeaningfulAt: lastMeaningful?.createdAt || null,
    hoursSinceLastCustomerActivity: hoursSince(lastCustomerMessage?.createdAt, now),
    hoursSinceLastSalesActivity: hoursSince(lastSalesMessage?.createdAt, now),
    hoursSinceLastMeaningfulActivity: hoursSince(lastMeaningful?.createdAt, now),
    hasVerifiedDeposit,
    payments: {
      verifiedCount: verifiedPayments.length,
      lastVerifiedAt: verifiedPayments[0]?.paidAt || verifiedPayments[0]?.createdAt || null,
    },
    orders: {
      projectCount: customer.projects.length,
      deliveredCount: deliveredProjects.length || (stage === 'DELIVERED' ? customer.projects.length : 0),
      lastDeliveredAt,
      daysSinceLastDelivered: lastDeliveredAt ? hoursSince(lastDeliveredAt, now) / 24 : null,
      lastProjectTitle: lastDelivered?.title || customer.projects[0]?.title || null,
      lastServiceName: customer.opportunities.find((o) => o.service?.name)?.service?.name || null,
      hasOpenSalesCycle,
    },
    invoices: customer.invoices.map((inv) => ({
      number: inv.invoiceNumber,
      status: inv.status,
      total: num(inv.total),
    })),
    facts,
    customer,
  };
}

export function compactContextForAi(context) {
  const activities = (context.activities || []).slice(0, 18).map((a) => ({
    at: a.createdAt,
    type: a.type,
    title: a.title,
    body: a.body ? String(a.body).slice(0, 500) : null,
    actorType: a.actorType,
    source: a.source || null,
  }));

  return {
    customer: {
      id: context.customerId,
      name: context.personName,
      company: context.companyName,
      stage: context.pipelineStage,
      daysInStage: context.daysInStage,
      notes: context.notes,
    },
    activities,
    payments: context.payments,
    orders: context.orders,
    facts: context.facts,
  };
}
