import { activityLabel, canonicalizeStage, stageLabel } from './pipeline.js';

export async function recordCrmActivity(tx, {
  crmCustomerId,
  type,
  title,
  body = null,
  previousStatus = null,
  newStatus = null,
  actorId = null,
  actorType = 'SYSTEM',
  source = null,
  relatedType = null,
  relatedId = null,
  meta = null,
}) {
  if (!crmCustomerId || !type) return null;
  return tx.crmActivity.create({
    data: {
      crmCustomerId,
      type,
      title: title || activityLabel(type),
      body,
      previousStatus: previousStatus ? canonicalizeStage(previousStatus) : null,
      newStatus: newStatus ? canonicalizeStage(newStatus) : null,
      actorId: actorId || null,
      actorType: actorType || (actorId ? 'USER' : 'SYSTEM'),
      source,
      relatedType,
      relatedId,
      meta: meta || undefined,
    },
  });
}

export function statusChangeBody({ previousStatus, newStatus, reason, automatic }) {
  const from = previousStatus ? stageLabel(previousStatus) : '—';
  const to = newStatus ? stageLabel(newStatus) : '—';
  const parts = [`${from} → ${to}`];
  if (automatic) parts.push('تغییر خودکار بر اساس رویداد سیستم');
  if (reason) parts.push(reason);
  return parts.join('\n');
}

export async function listCrmActivities(tx, crmCustomerId, { take = 200 } = {}) {
  const items = await tx.crmActivity.findMany({
    where: { crmCustomerId },
    include: {
      actor: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take,
  });
  return items.map((row) => ({
    ...row,
    typeLabel: activityLabel(row.type),
    previousStatusLabel: row.previousStatus ? stageLabel(row.previousStatus) : null,
    newStatusLabel: row.newStatus ? stageLabel(row.newStatus) : null,
  }));
}
