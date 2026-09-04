/**
 * Event-driven CRM status synchronization.
 * Business events (payment verify, portal invite, project create, …)
 * call applyCrmEvent inside the same database transaction.
 */

import { AppError } from '../../utils/response.js';
import {
  ACTIVITY_TYPES,
  CRM_EVENTS,
  activityLabel,
  canonicalizeStage,
  eventTargetStage,
  isClosedStage,
  shouldApplyStage,
  stageLabel,
} from './pipeline.js';
import { recordCrmActivity, statusChangeBody } from './activity.js';

const EVENT_ACTIVITY = {
  [CRM_EVENTS.LEAD_CREATED]: ACTIVITY_TYPES.LEAD_CREATED,
  [CRM_EVENTS.INTERACTION]: ACTIVITY_TYPES.INTERACTION,
  [CRM_EVENTS.INFORMATION_SENT]: ACTIVITY_TYPES.STATUS_CHANGED,
  [CRM_EVENTS.PROPOSAL_SENT]: ACTIVITY_TYPES.STATUS_CHANGED,
  [CRM_EVENTS.WAITING_DECISION]: ACTIVITY_TYPES.STATUS_CHANGED,
  [CRM_EVENTS.ORDER_CONFIRMED]: ACTIVITY_TYPES.STATUS_CHANGED,
  [CRM_EVENTS.INVOICE_CREATED]: ACTIVITY_TYPES.INVOICE_CREATED,
  [CRM_EVENTS.PAYMENT_SUBMITTED]: ACTIVITY_TYPES.PAYMENT_SUBMITTED,
  [CRM_EVENTS.PAYMENT_CONFIRMED]: ACTIVITY_TYPES.PAYMENT_CONFIRMED,
  [CRM_EVENTS.PAYMENT_REJECTED]: ACTIVITY_TYPES.PAYMENT_REJECTED,
  [CRM_EVENTS.PAYMENT_REVERSED]: ACTIVITY_TYPES.PAYMENT_REVERSED,
  [CRM_EVENTS.CUSTOMER_CONVERTED]: ACTIVITY_TYPES.CUSTOMER_CREATED,
  [CRM_EVENTS.PORTAL_INVITED]: ACTIVITY_TYPES.PORTAL_INVITATION_SENT,
  [CRM_EVENTS.PROJECT_CREATED]: ACTIVITY_TYPES.PROJECT_CREATED,
  [CRM_EVENTS.PROJECT_DELIVERED]: ACTIVITY_TYPES.PROJECT_DELIVERED,
  [CRM_EVENTS.REPEAT_ORDER]: ACTIVITY_TYPES.STATUS_CHANGED,
  [CRM_EVENTS.LOST]: ACTIVITY_TYPES.LEAD_LOST,
  [CRM_EVENTS.MANUAL_STAGE]: ACTIVITY_TYPES.STATUS_CHANGED,
};

const TOUCH_EVENTS = new Set([
  CRM_EVENTS.LEAD_CREATED,
  CRM_EVENTS.INTERACTION,
  CRM_EVENTS.INFORMATION_SENT,
  CRM_EVENTS.PROPOSAL_SENT,
  CRM_EVENTS.WAITING_DECISION,
]);

async function notifyCrm(payload, tx) {
  try {
    const { notifyManagersOnce, createNotificationOnce } = await import(
      '../../services/notifications.js'
    );
    if (payload.userId) {
      await createNotificationOnce(payload, tx);
      return;
    }
    await notifyManagersOnce(payload, tx);
  } catch (err) {
    console.error('[crm] notification failed', err?.message || err);
  }
}

function buildStageNotification({ customerId, personName, previousStatus, newStatus, eventKey }) {
  const name = (personName || '').trim() || 'مشتری';
  const from = stageLabel(previousStatus);
  const to = stageLabel(newStatus);
  return {
    eventKey,
    title: `وضعیت «${name}» تغییر کرد`,
    body: `وضعیت جدید: ${to}${from && from !== to ? ` (قبلی: ${from})` : ''}`,
    link: `/crm/${customerId}`,
    meta: {
      type: 'CRM_STAGE_CHANGED',
      customerId,
      previousStatus,
      newStatus,
    },
  };
}

/** Only notify for actions that matter to managers — skip noisy mid-funnel auto-steps. */
const NOTIFY_STAGE_EVENTS = new Set([
  CRM_EVENTS.ORDER_CONFIRMED,
  CRM_EVENTS.PAYMENT_CONFIRMED,
  CRM_EVENTS.CUSTOMER_CONVERTED,
  CRM_EVENTS.LOST,
  CRM_EVENTS.PROJECT_CREATED,
  CRM_EVENTS.PROJECT_DELIVERED,
  CRM_EVENTS.REPEAT_ORDER,
]);

/**
 * Apply a CRM lifecycle event. Must run inside an existing Prisma transaction.
 * @returns {{ changed: boolean, previousStatus: string, newStatus: string, customer: object }}
 */
export async function applyCrmEvent(tx, {
  customerId,
  opportunityId = null,
  event,
  actorId = null,
  actorType = 'SYSTEM',
  source = null,
  note = null,
  body = null,
  title = null,
  meta = null,
  relatedType = null,
  relatedId = null,
  interactionType = null,
  targetStage = null,
  force = false,
  lostReason = null,
  touchLastContact = false,
  isRepeat = false,
  hasVerifiedPayment = null,
  notify = true,
}) {
  if (!customerId) throw new AppError('شناسه سرنخ الزامی است', 400, 'VALIDATION');
  if (!event) throw new AppError('رویداد CRM الزامی است', 400, 'VALIDATION');

  const customer = await tx.crmCustomer.findFirst({
    where: { id: customerId },
  });
  if (!customer) throw new AppError('سرنخ یافت نشد', 404, 'NOT_FOUND');

  const previousStatus = canonicalizeStage(customer.pipelineStage);
  let extras = { interactionType, targetStage, isRepeat, hasVerifiedPayment };

  if (event === CRM_EVENTS.PROJECT_CREATED && isRepeat == null) {
    const other = await tx.project.count({
      where: {
        crmCustomerId: customerId,
        deletedAt: null,
        ...(relatedId ? { id: { not: relatedId } } : {}),
      },
    });
    extras = { ...extras, isRepeat: other > 0 };
  }

  if (event === CRM_EVENTS.PAYMENT_REVERSED && hasVerifiedPayment == null) {
    const verified = await tx.payment.count({
      where: { crmCustomerId: customerId, verification: 'VERIFIED' },
    });
    extras = { ...extras, hasVerifiedPayment: verified > 0 };
  }

  const nextStage = eventTargetStage(event, previousStatus, extras);
  const applyStage = nextStage
    && shouldApplyStage({
      currentStage: previousStatus,
      nextStage,
      force,
      event,
    });

  const customerPatch = {};
  if (applyStage) {
    customerPatch.pipelineStage = nextStage;
    if (nextStage === 'LOST_CANCELED') {
      customerPatch.lostReason = lostReason || note || customer.lostReason || 'لغو / از دست رفته';
    } else if (previousStatus === 'LOST_CANCELED') {
      customerPatch.lostReason = null;
    }
  }
  if (event === CRM_EVENTS.CUSTOMER_CONVERTED && !customer.convertedAt) {
    customerPatch.convertedAt = new Date();
  }
  if (touchLastContact || TOUCH_EVENTS.has(event)) {
    customerPatch.lastContactAt = new Date();
  }

  let updated = customer;
  if (Object.keys(customerPatch).length) {
    updated = await tx.crmCustomer.update({
      where: { id: customerId },
      data: customerPatch,
    });
  }

  if (applyStage) {
    const oppWhere = opportunityId
      ? { id: opportunityId, deletedAt: null }
      : { crmCustomerId: customerId, deletedAt: null };
    await tx.opportunity.updateMany({
      where: {
        ...oppWhere,
        pipelineStage: { not: nextStage },
      },
      data: {
        pipelineStage: nextStage,
        ...(nextStage === 'LOST_CANCELED'
          ? { lostReason: lostReason || note || 'لغو / از دست رفته' }
          : {}),
      },
    });
  }

  const activityType = EVENT_ACTIVITY[event] || ACTIVITY_TYPES.STATUS_CHANGED;
  const newStatus = applyStage ? nextStage : previousStatus;
  await recordCrmActivity(tx, {
    crmCustomerId: customerId,
    type: activityType,
    title: title || activityLabel(activityType),
    body: body || (applyStage
      ? statusChangeBody({
          previousStatus,
          newStatus,
          reason: note,
          automatic: actorType === 'SYSTEM',
        })
      : note),
    previousStatus: applyStage ? previousStatus : null,
    newStatus: applyStage ? newStatus : null,
    actorId,
    actorType: actorId ? 'USER' : actorType,
    source,
    relatedType,
    relatedId,
    meta: {
      event,
      ...(meta || {}),
    },
  });

  if (notify && applyStage && nextStage !== 'NEW_LEAD' && NOTIFY_STAGE_EVENTS.has(event)) {
    await notifyCrm(
      buildStageNotification({
        customerId,
        personName: updated.personName,
        previousStatus,
        newStatus,
        eventKey: `crm.stage:${customerId}:${event}:${newStatus}`,
      }),
      tx,
    );
    if (updated.salesOwnerId && actorId !== updated.salesOwnerId) {
      const name = (updated.personName || '').trim() || 'سرنخ';
      await notifyCrm(
        {
          userId: updated.salesOwnerId,
          eventKey: `crm.stage.owner:${customerId}:${event}:${newStatus}`,
          title: `وضعیت «${name}» تغییر کرد`,
          body: `وضعیت جدید: ${stageLabel(newStatus)}`,
          link: `/crm/${customerId}`,
          meta: { type: 'CRM_STAGE_CHANGED', customerId, newStatus },
        },
        tx,
      );
    }
  }

  setTimeout(() => scheduleAssistant(customerId, event), 0);

  return {
    changed: applyStage,
    previousStatus,
    newStatus,
    customer: updated,
  };
}

function scheduleAssistant(customerId, event) {
  import('../sales-assistant/hooks.js')
    .then((mod) => mod.scheduleSalesAssistantReeval(customerId, event))
    .catch(() => {});
}

export async function syncOpportunityStage(tx, opportunityId, stage) {
  if (!opportunityId || !stage) return;
  await tx.opportunity.updateMany({
    where: { id: opportunityId, deletedAt: null },
    data: { pipelineStage: canonicalizeStage(stage) },
  });
}

/**
 * Legacy hook after first payment — conversion is manual via CRM و فروش transfer.
 */
export async function maybeAutoConvertAfterFirstVerifiedPayment(_tx, _ctx = {}) {
  return { converted: false, reason: 'manual_transfer_only' };
}

export { isClosedStage };
