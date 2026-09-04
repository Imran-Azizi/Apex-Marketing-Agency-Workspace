import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/response.js';
import { writeAudit } from '../../middleware/audit.js';
import { isManagerRole } from '../crm/pipeline.js';
import {
  inboxSectionFor,
  isManagerRole as engineIsManager,
  markRecommendation,
  runPipelineScan,
  serializeRecommendation,
} from './engine.js';
import { getSettings } from './settings.js';
import { ACTION_STATES, OPEN_ACTION_STATES } from './constants.js';

const patchRecSchema = z.object({
  actionState: z.enum(['VIEWED', 'IN_PROGRESS', 'DONE', 'DISMISSED']).optional(),
  actionTaken: z.string().trim().max(4000).optional(),
  actionNotes: z.string().trim().max(4000).optional(),
});

function canAct(auth) {
  const perms = new Set(auth?.permissions || []);
  return perms.has('sales_assistant.act') || perms.has('crm.edit');
}

function ownerWhere(auth) {
  if (engineIsManager(auth?.roleCode)) return {};
  return { salesOwnerId: auth.userId };
}

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

export const salesAssistantService = {
  async getInbox(query, auth) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 50));
    const where = {
      supersededAt: null,
      actionState: query.includeClosed === 'true'
        ? undefined
        : { in: [...OPEN_ACTION_STATES] },
      ...ownerWhere(auth),
    };
    if (query.customerId) where.crmCustomerId = String(query.customerId);
    if (query.priority && query.priority !== 'ALL') where.priority = String(query.priority);
    if (query.category && query.category !== 'ALL') where.category = String(query.category);
    if (query.kind && query.kind !== 'ALL') where.kind = String(query.kind);

    const openWhere = {
      supersededAt: null,
      actionState: { in: [...OPEN_ACTION_STATES] },
      ...ownerWhere(auth),
      ...(query.customerId ? { crmCustomerId: String(query.customerId) } : {}),
    };

    const [rows, total, allOpenForStats] = await Promise.all([
      prisma.salesAssistantRecommendation.findMany({
        where,
        include: recInclude,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.salesAssistantRecommendation.count({ where }),
      prisma.salesAssistantRecommendation.findMany({
        where: openWhere,
        select: {
          priority: true,
          category: true,
          kind: true,
          actionState: true,
        },
      }),
    ]);

    const stats = {
      open: allOpenForStats.length,
      newCount: 0,
      urgent: 0,
      followUp: 0,
      opportunity: 0,
      high: 0,
    };

    for (const row of allOpenForStats) {
      if (row.actionState === ACTION_STATES.NEW) stats.newCount += 1;
      if (row.priority === 'HIGH') stats.high += 1;
      const section = inboxSectionFor(row);
      if (section === 'urgent') stats.urgent += 1;
      else if (section === 'opportunity') stats.opportunity += 1;
      else stats.followUp += 1;
    }

    const items = rows.map((r) => {
      const serialized = serializeRecommendation(r);
      return { ...serialized, section: inboxSectionFor(serialized) };
    });

    return {
      items,
      total,
      page,
      pageSize,
      stats,
    };
  },

  async runNow(_body, auth) {
    if (!canAct(auth)) {
      throw new AppError('اجازه اجرای دستی را ندارید', 403, 'FORBIDDEN');
    }
    return runPipelineScan({ trigger: 'MANUAL' });
  },

  async getRecommendation(id, auth) {
    const row = await prisma.salesAssistantRecommendation.findFirst({
      where: { id, ...ownerWhere(auth) },
      include: recInclude,
    });
    if (!row) throw new AppError('توصیه یافت نشد', 404, 'NOT_FOUND');

    if (row.actionState === ACTION_STATES.NEW) {
      await prisma.salesAssistantRecommendation.update({
        where: { id },
        data: { actionState: ACTION_STATES.VIEWED, viewedAt: new Date() },
      });
      row.actionState = ACTION_STATES.VIEWED;
      row.viewedAt = new Date();
    }

    const serialized = serializeRecommendation(row, {
      includeEvidence: isManagerRole(auth?.roleCode),
    });
    return { ...serialized, section: inboxSectionFor(serialized) };
  },

  async patchRecommendation(id, body, auth, req) {
    if (!canAct(auth)) throw new AppError('اجازه این اقدام را ندارید', 403, 'FORBIDDEN');
    const parsed = patchRecSchema.parse(body);
    const updated = await markRecommendation(id, parsed, auth);
    if (!updated) throw new AppError('توصیه یافت نشد', 404, 'NOT_FOUND');
    await writeAudit({
      userId: auth.userId,
      action: 'SALES_ASSISTANT_REC_ACTION',
      entityType: 'SalesAssistantRecommendation',
      entityId: id,
      after: parsed,
      req,
    });
    const serialized = serializeRecommendation(updated);
    return { ...serialized, section: inboxSectionFor(serialized) };
  },
};

export { patchRecSchema };

/** Kept for scheduler defaults only — not exposed via settings UI. */
export async function readSettings() {
  return getSettings();
}
