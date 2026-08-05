/**
 * Manager payment-approval workflow helpers.
 * Status mapping: PENDING → VERIFIED (approved) | REJECTED
 * Only VERIFIED payments enter financial calculations (see paymentFinance.js).
 */

import { AppError } from '../../utils/response.js';
import { formatFaDateTime } from '../portal/helpers.js';

export const PAYMENT_APPROVAL_STATUS = Object.freeze({
  PENDING_APPROVAL: 'PENDING',
  APPROVED: 'VERIFIED',
  REJECTED: 'REJECTED',
});

export function isPaymentApprover(auth) {
  const role = auth?.roleCode;
  return role === 'MANAGER' || role === 'ADMIN';
}

export function assertPaymentApprover(auth) {
  if (!isPaymentApprover(auth)) {
    throw new AppError(
      'فقط مدیر می‌تواند پرداخت را تأیید یا رد کند',
      403,
      'FORBIDDEN',
    );
  }
}

/** Managers/admins auto-approve their own recorded payments. */
export function shouldAutoApprovePayment(auth) {
  return isPaymentApprover(auth);
}

export function formatPaymentAmountLabel(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '0';
  return `${n.toLocaleString('fa-AF', { numberingSystem: 'latn' })} افغانی`;
}

export function buildPaymentPendingApprovalNotification({
  paymentId,
  amount,
  creatorName,
  customerName,
  projectTitle,
  projectId,
  crmCustomerId,
  createdAt = new Date(),
}) {
  const when = formatFaDateTime(createdAt);
  const amountLabel = formatPaymentAmountLabel(amount);
  return {
    eventKey: `payment.pending:${paymentId}`,
    title: 'پرداخت جدید نیاز به تایید دارد',
    body: [
      'پرداخت جدید صورت گرفت، منتظر تایید شما',
      creatorName ? `ثبت‌کننده: ${creatorName}` : null,
      customerName ? `مشتری: ${customerName}` : null,
      projectTitle ? `پروژه: ${projectTitle}` : null,
      `مبلغ: ${amountLabel}`,
      `تاریخ: ${when}`,
    ]
      .filter(Boolean)
      .join('\n'),
    link: crmCustomerId
      ? `/crm/${crmCustomerId}`
      : projectId
        ? `/projects/${projectId}`
        : '/crm',
    meta: {
      type: 'PAYMENT_PENDING_APPROVAL',
      paymentId,
      amount: Number(amount),
      creatorName: creatorName || null,
      customerName: customerName || null,
      projectId: projectId || null,
      projectName: projectTitle || null,
      crmCustomerId: crmCustomerId || null,
      createdAt: createdAt.toISOString(),
    },
  };
}

export function buildPaymentApprovedNotification({
  paymentId,
  amount,
  projectTitle,
  projectId,
  crmCustomerId,
  approvedAt = new Date(),
}) {
  const when = formatFaDateTime(approvedAt);
  const amountLabel = formatPaymentAmountLabel(amount);
  return {
    eventKey: `payment.approved:${paymentId}`,
    title: 'پرداخت تایید شد',
    body: [
      'مدیر پرداخت شما را تایید کرد',
      projectTitle ? `پروژه: ${projectTitle}` : null,
      `مبلغ تاییدشده: ${amountLabel}`,
      `تاریخ تایید: ${when}`,
    ]
      .filter(Boolean)
      .join('\n'),
    link: crmCustomerId ? `/crm/${crmCustomerId}` : projectId ? `/projects/${projectId}` : null,
    meta: {
      type: 'PAYMENT_APPROVED',
      paymentId,
      amount: Number(amount),
      projectId: projectId || null,
      projectName: projectTitle || null,
      crmCustomerId: crmCustomerId || null,
      approvedAt: approvedAt.toISOString(),
    },
  };
}

export function buildPaymentRejectedNotification({
  paymentId,
  amount,
  projectTitle,
  projectId,
  crmCustomerId,
  rejectionReason,
  rejectedAt = new Date(),
}) {
  const when = formatFaDateTime(rejectedAt);
  const amountLabel = formatPaymentAmountLabel(amount);
  return {
    eventKey: `payment.rejected:${paymentId}`,
    title: 'پرداخت رد شد',
    body: [
      'مدیر پرداخت شما را رد کرد',
      projectTitle ? `پروژه: ${projectTitle}` : null,
      `مبلغ: ${amountLabel}`,
      rejectionReason ? `دلیل رد: ${rejectionReason}` : null,
      `تاریخ: ${when}`,
    ]
      .filter(Boolean)
      .join('\n'),
    link: crmCustomerId ? `/crm/${crmCustomerId}` : projectId ? `/projects/${projectId}` : null,
    meta: {
      type: 'PAYMENT_REJECTED',
      paymentId,
      amount: Number(amount),
      projectId: projectId || null,
      projectName: projectTitle || null,
      crmCustomerId: crmCustomerId || null,
      rejectionReason: rejectionReason || null,
      rejectedAt: rejectedAt.toISOString(),
    },
  };
}

/**
 * Resolve project / customer context for a payment (for notifications + list UI).
 */
export async function resolvePaymentContext(db, payment) {
  const customer = payment.crmCustomer
    || (payment.crmCustomerId
      ? await db.crmCustomer.findUnique({
          where: { id: payment.crmCustomerId },
          select: {
            id: true,
            personName: true,
            companyName: true,
          },
        })
      : null);

  let opportunity = null;
  if (payment.invoice?.opportunityId) {
    opportunity = await db.opportunity.findFirst({
      where: { id: payment.invoice.opportunityId, deletedAt: null },
      select: {
        id: true,
        title: true,
        projectId: true,
        project: { select: { id: true, code: true, title: true } },
      },
    });
  } else if (payment.crmCustomerId) {
    opportunity = await db.opportunity.findFirst({
      where: { crmCustomerId: payment.crmCustomerId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        projectId: true,
        project: { select: { id: true, code: true, title: true } },
      },
    });
  }

  const project = opportunity?.project || null;
  const projectTitle = project?.title || opportunity?.title || null;
  const customerName = customer
    ? (customer.companyName
      ? `${customer.personName} — ${customer.companyName}`
      : customer.personName)
    : null;

  return {
    customer,
    customerName,
    opportunity,
    project,
    projectId: project?.id || opportunity?.projectId || payment.invoice?.projectId || null,
    projectTitle,
    crmCustomerId: payment.crmCustomerId || customer?.id || null,
  };
}
