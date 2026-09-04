/**
 * Sales Assistant engine — scan, evaluate, persist, notify.
 */

import { prisma } from '../../db/prisma.js';
import { stageLabel, isManagerRole } from '../crm/pipeline.js';
import { recordCrmActivity } from '../crm/activity.js';
import {
  createNotificationOnce,
  notifyManagersOnce,
} from '../../services/notifications.js';
import { enrichRecommendation } from './ai.js';
import { composeRecommendation } from './compose.js';
import { loadCustomerContext } from './context.js';
import { buildFingerprint } from './fingerprint.js';
import { assignPriority, categoryForKind } from './priority.js';
import { evaluateSignals } from './rules.js';
import { getSettings } from './settings.js';
import {
  ACTION_STATES,
  KIND_LABELS,
  OPEN_ACTION_STATES,
  PRIORITY_LABELS,
  TRIGGERS,
} from './constants.js';

const recInclude = {
  crmCustomer: {
    select: {
      id: true,
      customerCode: true,
      personName: true,
      companyName: true,
      pipelineStage: true,
      lastContactAt: true,
    },
  },
  salesOwner: { select: { id: true, fullName: true } },
  actedBy: { select: { id: true, fullName: true } },
};

export function serializeRecommendation(row, extras = {}) {
  const customer = row.crmCustomer;
  const days = row.daysInStage != null ? Number(row.daysInStage) : null;
  const priority = row.priority || 'MEDIUM';
  const suggestedFollowUp =
    priority === 'HIGH'
      ? 'امروز'
      : priority === 'MEDIUM'
        ? 'ظرف ۴۸ ساعت'
        : 'این هفته';

  const personName = customer?.personName || 'مشتری';
  const companyName = customer?.companyName || null;
  const customerDisplayName = companyName
    ? `${personName} — ${companyName}`
    : personName;

  return {
    id: row.id,
    kind: row.kind,
    kindLabel: KIND_LABELS[row.kind] || row.kind,
    category: row.category,
    priority,
    priorityLabel: PRIORITY_LABELS[priority] || priority,
    actionState: row.actionState,
    title: row.title,
    reason: row.reason,
    whatHappened: row.whatHappened,
    customerWants: row.customerWants,
    whatsStopping: row.whatsStopping,
    recommendedAction: row.recommendedAction,
    suggestedMessage: row.suggestedMessage,
    salesApproach: row.salesApproach,
    closeHelp: row.closeHelp,
    suggestedFollowUp,
    facts: extras.includeEvidence ? row.facts : undefined,
    interpretations: extras.includeEvidence ? row.interpretations : undefined,
    evidence: extras.includeEvidence ? row.evidence : undefined,
    pipelineStage: row.pipelineStage,
    pipelineStageLabel: stageLabel(row.pipelineStage),
    daysInStage: days,
    lastInteractionAt: row.lastInteractionAt,
    intentLevel: row.intentLevel,
    usedAi: row.usedAi,
    aiModel: extras.includeEvidence ? row.aiModel : undefined,
    aiPromptVersion: extras.includeEvidence ? row.aiPromptVersion : undefined,
    actedAt: row.actedAt,
    actedById: row.actedById,
    actedBy: row.actedBy || null,
    actionTaken: row.actionTaken,
    actionNotes: row.actionNotes,
    viewedAt: row.viewedAt,
    supersededAt: row.supersededAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    customer: customer
      ? {
          id: customer.id,
          customerCode: customer.customerCode,
          personName: customer.personName,
          companyName: customer.companyName,
          displayName: customerDisplayName,
          pipelineStage: customer.pipelineStage,
          lastContactAt: customer.lastContactAt,
        }
      : null,
    salesOwner: row.salesOwner
      ? { id: row.salesOwner.id, fullName: row.salesOwner.fullName }
      : null,
  };
}

/** Bucket for inbox dashboard sections (exclusive). */
export function inboxSectionFor(rec) {
  if (rec.priority === 'HIGH') return 'urgent';
  if (rec.category === 'REPEAT' || rec.kind === 'REPEAT_ORDER') return 'opportunity';
  return 'followUp';
}

async function notifyNewRecommendation(row, context, settings) {
  if (row.priority !== 'HIGH') return;
  const name = context.personName || row.title;
  const stage = stageLabel(row.pipelineStage);
  const payload = {
    title: `دستیار فروش: ${KIND_LABELS[row.kind] || 'توصیه'} — ${name}`,
    body: [
      `مشتری: ${name}${context.companyName ? ` — ${context.companyName}` : ''}`,
      `مرحله: ${stage}`,
      `اولویت: ${PRIORITY_LABELS[row.priority]}`,
      `علت: ${String(row.reason || '').slice(0, 220)}`,
      `اقدام پیشنهادی: ${String(row.recommendedAction || '').slice(0, 220)}`,
    ].join('\n'),
    link: `/sales-assistant?rec=${row.id}`,
    meta: {
      type: 'SALES_ASSISTANT',
      recommendationId: row.id,
      customerId: row.crmCustomerId,
      kind: row.kind,
      priority: row.priority,
    },
  };

  if (settings.notifyRepOnHigh && row.salesOwnerId) {
    await createNotificationOnce({
      userId: row.salesOwnerId,
      eventKey: `sales-assistant.rec:${row.id}:owner`,
      ...payload,
    });
  }
  if (settings.notifyManagerOnHigh) {
    await notifyManagersOnce({
      eventKey: `sales-assistant.rec:${row.id}:managers`,
      ...payload,
    });
  }
}

async function persistSignal(signal, context, settings) {
  const fingerprint = buildFingerprint(signal, context);
  const priority = assignPriority(signal, context, settings);
  const category = categoryForKind(signal.kind);

  const openExisting = await prisma.salesAssistantRecommendation.findFirst({
    where: {
      crmCustomerId: context.customerId,
      kind: signal.kind,
      actionState: { in: [...OPEN_ACTION_STATES] },
      supersededAt: null,
    },
  });

  if (openExisting && openExisting.fingerprint === fingerprint) {
    return { skipped: true, reason: 'same_fingerprint', id: openExisting.id };
  }

  const ai = await enrichRecommendation(signal, context);
  const copy = ai.output || composeRecommendation(signal, context);

  const row = await prisma.$transaction(async (tx) => {
    if (openExisting) {
      await tx.salesAssistantRecommendation.update({
        where: { id: openExisting.id },
        data: {
          supersededAt: new Date(),
          supersededById: null,
        },
      });
    }

    return tx.salesAssistantRecommendation.create({
      data: {
        crmCustomerId: context.customerId,
        salesOwnerId: context.salesOwnerId,
        kind: signal.kind,
        category,
        priority,
        actionState: ACTION_STATES.NEW,
        fingerprint,
        title: copy.title,
        reason: copy.reason,
        whatHappened: copy.whatHappened,
        customerWants: copy.customerWants,
        whatsStopping: copy.whatsStopping,
        recommendedAction: copy.recommendedAction,
        suggestedMessage: copy.suggestedMessage,
        salesApproach: copy.salesApproach,
        closeHelp: copy.closeHelp,
        facts: signal.facts,
        interpretations: signal.interpretations,
        evidence: {
          trigger: signal.trigger,
          objections: signal.objections,
          intentLevel: signal.intentLevel,
        },
        pipelineStage: context.pipelineStage,
        daysInStage: context.daysInStage,
        lastInteractionAt: context.lastContactAt,
        intentLevel: signal.intentLevel,
        usedAi: ai.usedAi,
        aiModel: ai.model,
        aiPromptVersion: ai.promptVersion,
      },
      include: recInclude,
    });
  });

  try {
    await notifyNewRecommendation(row, context, settings);
  } catch (err) {
    console.error('[sales-assistant] notify failed', err?.message || err);
  }

  return { created: true, id: row.id, row };
}

export async function evaluateCustomer(customerId, { trigger = TRIGGERS.CRM_EVENT, eventType } = {}) {
  const settings = await getSettings();
  if (!settings.enabled) {
    return { skipped: true, reason: 'disabled' };
  }

  const context = await loadCustomerContext(customerId);
  if (!context) return { skipped: true, reason: 'not_found' };

  const signals = evaluateSignals(context, settings);
  const results = [];
  for (const signal of signals) {
    results.push(await persistSignal(signal, context, settings));
  }

  if (!signals.length) {
    await autoResolveStale(context, settings);
  }

  return {
    customerId,
    trigger,
    eventType,
    signals: signals.map((s) => s.kind),
    results,
  };
}

async function autoResolveStale(context) {
  const open = await prisma.salesAssistantRecommendation.findMany({
    where: {
      crmCustomerId: context.customerId,
      actionState: { in: [...OPEN_ACTION_STATES] },
      supersededAt: null,
    },
  });
  const activeKinds = new Set(evaluateSignals(context, await getSettings()).map((s) => s.kind));
  for (const row of open) {
    if (!activeKinds.has(row.kind)) {
      await prisma.salesAssistantRecommendation.update({
        where: { id: row.id },
        data: {
          actionState: ACTION_STATES.DISMISSED,
          supersededAt: new Date(),
          actionNotes: 'خودکار بسته شد — دیگر شرایط فعال نیست',
        },
      });
    }
  }
}

export async function runPipelineScan({ trigger = TRIGGERS.SCHEDULED_SCAN } = {}) {
  const settings = await getSettings();
  if (!settings.enabled) return { skipped: true, reason: 'disabled' };

  const run = await prisma.salesAssistantRun.create({
    data: { trigger, status: 'RUNNING' },
  });

  const stats = { scanned: 0, created: 0, skipped: 0, errors: 0 };
  try {
    const customers = await prisma.crmCustomer.findMany({
      where: {
        deletedAt: null,
        pipelineStage: { not: 'LOST_CANCELED' },
      },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });

    for (const row of customers) {
      stats.scanned += 1;
      try {
        const result = await evaluateCustomer(row.id, { trigger });
        for (const r of result.results || []) {
          if (r?.created) stats.created += 1;
          else stats.skipped += 1;
        }
      } catch (err) {
        stats.errors += 1;
        console.error('[sales-assistant] evaluate failed', row.id, err?.message || err);
      }
    }

    await prisma.salesAssistantRun.update({
      where: { id: run.id },
      data: { status: 'COMPLETED', finishedAt: new Date(), stats },
    });
    return { runId: run.id, stats };
  } catch (err) {
    await prisma.salesAssistantRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        error: String(err?.message || err),
        stats,
      },
    });
    throw err;
  }
}

export async function generateDailyReport({ trigger = TRIGGERS.DAILY_REPORT } = {}) {
  const settings = await getSettings();
  if (!settings.enabled || !settings.dailyReportEnabled) {
    return { skipped: true, reason: 'disabled' };
  }

  await runPipelineScan({ trigger });

  const day = new Date();
  day.setHours(0, 0, 0, 0);

  const open = await prisma.salesAssistantRecommendation.findMany({
    where: {
      actionState: { in: [...OPEN_ACTION_STATES] },
      supersededAt: null,
    },
    include: recInclude,
    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
  });

  const summary = {
    totalOpen: open.length,
    high: open.filter((r) => r.priority === 'HIGH').length,
    medium: open.filter((r) => r.priority === 'MEDIUM').length,
    low: open.filter((r) => r.priority === 'LOW').length,
    byCategory: {
      DECISION: open.filter((r) => r.category === 'DECISION').length,
      DEPOSIT: open.filter((r) => r.category === 'DEPOSIT').length,
      REPEAT: open.filter((r) => r.category === 'REPEAT').length,
    },
  };

  const snapshot = {
    generatedAt: new Date().toISOString(),
    topHigh: open
      .filter((r) => r.priority === 'HIGH')
      .slice(0, 20)
      .map((r) => serializeRecommendation(r)),
  };

  const report = await prisma.salesAssistantDailyReport.upsert({
    where: { reportDate: day },
    create: { reportDate: day, summary, snapshot },
    update: { summary, snapshot, generatedAt: new Date() },
  });

  const byOwner = new Map();
  for (const rec of open.filter((r) => r.priority === 'HIGH')) {
    const ownerId = rec.salesOwnerId || 'unassigned';
    if (!byOwner.has(ownerId)) byOwner.set(ownerId, []);
    byOwner.get(ownerId).push(rec);
  }

  for (const [ownerId, mine] of byOwner) {
    if (ownerId === 'unassigned') continue;
    await createNotificationOnce({
      userId: ownerId,
      eventKey: `sales-assistant.daily:${day.toISOString().slice(0, 10)}:${ownerId}`,
      title: `گزارش روزانه دستیار فروش — ${mine.length} مورد با اولویت بالا`,
      body: mine.map((r) => `• ${r.title}`).join('\n').slice(0, 900),
      link: '/sales-assistant',
      meta: { type: 'SALES_ASSISTANT_DAILY', count: mine.length },
    });
  }

  await notifyManagersOnce({
    eventKey: `sales-assistant.daily:${day.toISOString().slice(0, 10)}:managers`,
    title: `گزارش روزانه دستیار فروش — ${summary.totalOpen} توصیه باز`,
    body: `اولویت بالا: ${summary.high} | متوسط: ${summary.medium} | پایین: ${summary.low}`,
    link: '/sales-assistant',
    meta: { type: 'SALES_ASSISTANT_DAILY', ...summary },
  });

  return { reportId: report.id, summary };
}

export async function markRecommendation(id, body, auth) {
  const rec = await prisma.salesAssistantRecommendation.findUnique({
    where: { id },
    include: recInclude,
  });
  if (!rec) return null;

  const isManager = isManagerRole(auth?.roleCode);
  if (!isManager && rec.salesOwnerId && rec.salesOwnerId !== auth.userId) {
    const err = new Error('FORBIDDEN');
    err.status = 403;
    throw err;
  }

  const nextState = body.actionState || rec.actionState;
  const updated = await prisma.salesAssistantRecommendation.update({
    where: { id },
    data: {
      actionState: nextState,
      actionTaken: body.actionTaken ?? rec.actionTaken,
      actionNotes: body.actionNotes ?? rec.actionNotes,
      actedAt: ['DONE', 'DISMISSED'].includes(nextState) ? new Date() : rec.actedAt,
      actedById: ['DONE', 'DISMISSED'].includes(nextState) ? auth.userId : rec.actedById,
      viewedAt: nextState === ACTION_STATES.VIEWED && !rec.viewedAt ? new Date() : rec.viewedAt,
    },
    include: recInclude,
  });

  if (['DONE', 'DISMISSED'].includes(nextState)) {
    await prisma.$transaction(async (tx) => {
      await recordCrmActivity(tx, {
        crmCustomerId: rec.crmCustomerId,
        type: 'INTERACTION',
        title: nextState === 'DONE' ? 'اقدام دستیار فروش انجام شد' : 'توصیه دستیار فروش رد شد',
        body: body.actionNotes || updated.recommendedAction,
        actorId: auth.userId,
        actorType: 'USER',
        source: 'SALES_ASSISTANT',
        relatedType: 'SalesAssistantRecommendation',
        relatedId: rec.id,
        meta: { actionState: nextState, kind: rec.kind },
      });
    });
  }

  return updated;
}

export { isManagerRole };
