import { createNotificationOnce } from '../../services/notifications.js';
import { formatFaDateTime } from '../portal/helpers.js';
import { isEmailConfigured, sendMail } from '../../services/email.js';
import { prisma } from '../../db/prisma.js';
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from './constants.js';

function taskLink(taskId) {
  return `/tasks/${taskId}`;
}

/** Run notification fan-out after the HTTP response path — never block status APIs. */
export function queueTaskNotify(work) {
  Promise.resolve()
    .then(() => work())
    .catch((err) => console.warn('[tasks] notify failed:', err?.message || err));
}

async function maybeEmailUser(userId, { subject, text }) {
  if (!isEmailConfigured() || !userId) return;
  try {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true },
      select: { email: true },
    });
    if (!user?.email) return;
    await sendMail({
      to: user.email,
      subject,
      text,
    });
  } catch (err) {
    console.warn('[tasks] email notify failed:', err?.message || err);
  }
}

async function notifyUsersOnce(userIds, payload) {
  const unique = [...new Set((userIds || []).filter(Boolean))];
  if (!unique.length) return;

  await Promise.all(
    unique.map((userId) =>
      createNotificationOnce({
        ...payload,
        userId,
        audience: 'INTERNAL',
        eventKey: `${payload.eventKey}:user:${userId}`,
      }),
    ),
  );
}

async function listActiveManagerIds() {
  const managers = await prisma.user.findMany({
    where: {
      role: { code: { in: ['MANAGER', 'ADMIN'] } },
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });
  return managers.map((m) => m.id);
}

/**
 * One in-app notification per recipient for status / stakeholder events.
 * Managers + task creator (when distinct), never the actor, never duplicates.
 */
export async function notifyTaskStakeholders({
  payload,
  actorUserId = null,
  createdById = null,
  extraUserIds = [],
  emailUserIds = [],
}) {
  const managers = await listActiveManagerIds();
  const recipients = new Set([...managers, ...extraUserIds]);
  if (createdById) recipients.add(createdById);
  if (actorUserId) recipients.delete(actorUserId);

  await notifyUsersOnce([...recipients], payload);

  // Email is optional and slow — only for explicitly requested recipients, in parallel, non-critical.
  if (emailUserIds?.length && isEmailConfigured()) {
    const mailTargets = emailUserIds.filter((id) => id && id !== actorUserId);
    await Promise.allSettled(
      mailTargets.map((userId) =>
        maybeEmailUser(userId, { subject: payload.title, text: payload.body }),
      ),
    );
  }
}

export function buildTaskAssignedNotification({ task, assignedAt = new Date() }) {
  const when = formatFaDateTime(assignedAt);
  const deadlineLabel = formatFaDateTime(task.deadline);
  return {
    eventKey: `task.assigned:${task.id}:${assignedAt.toISOString()}`,
    title: 'وظیفه جدید به شما محول شد',
    body: [
      `عنوان: ${task.title}`,
      `اولویت: ${TASK_PRIORITY_LABELS[task.priority] || task.priority}`,
      `مهلت: ${deadlineLabel}`,
      `تاریخ تخصیص: ${when}`,
    ].join('\n'),
    link: taskLink(task.id),
    meta: {
      type: 'TASK_ASSIGNED',
      taskId: task.id,
      actionType: 'TASK_ASSIGNED',
      priority: task.priority,
      createdAt: assignedAt.toISOString(),
    },
  };
}

export function buildTaskStatusNotification({
  task,
  actorName,
  status,
  eventSuffix,
  title,
  extraLines = [],
}) {
  const statusLabel = TASK_STATUS_LABELS[status] || status;
  return {
    eventKey: `task.status:${task.id}:${eventSuffix}`,
    title,
    body: [
      `عنوان: ${task.title}`,
      actorName ? `توسط: ${actorName}` : null,
      `وضعیت: ${statusLabel}`,
      ...extraLines,
    ]
      .filter(Boolean)
      .join('\n'),
    link: taskLink(task.id),
    meta: {
      type: 'TASK_STATUS_UPDATED',
      taskId: task.id,
      actionType: 'TASK_STATUS_UPDATED',
      status,
      createdAt: new Date().toISOString(),
    },
  };
}

export function buildTaskUpdatedNotification({ task, actorName, changes }) {
  return {
    eventKey: `task.updated:${task.id}:${Date.now()}`,
    title: 'جزئیات وظیفه به‌روزرسانی شد',
    body: [
      `عنوان: ${task.title}`,
      actorName ? `توسط: ${actorName}` : null,
      changes?.length ? `تغییرات: ${changes.join('، ')}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    link: taskLink(task.id),
    meta: {
      type: 'TASK_UPDATED',
      taskId: task.id,
      actionType: 'TASK_UPDATED',
      createdAt: new Date().toISOString(),
    },
  };
}

export function buildTaskDeadlineReminderNotification({ task, dayKey }) {
  const deadlineLabel = formatFaDateTime(task.deadline);
  return {
    eventKey: `task.deadline:${task.id}:${dayKey}`,
    title: 'مهلت وظیفه نزدیک است',
    body: [`عنوان: ${task.title}`, `مهلت: ${deadlineLabel}`].join('\n'),
    link: taskLink(task.id),
    meta: {
      type: 'TASK_DEADLINE_REMINDER',
      taskId: task.id,
      actionType: 'DEADLINE_REMINDER',
      createdAt: new Date().toISOString(),
    },
  };
}

export function buildTaskOverdueNotification({ task, dayKey }) {
  const deadlineLabel = formatFaDateTime(task.deadline);
  return {
    eventKey: `task.overdue:${task.id}:${dayKey}`,
    title: 'وظیفه از مهلت گذشته است',
    body: [`عنوان: ${task.title}`, `مهلت: ${deadlineLabel}`].join('\n'),
    link: taskLink(task.id),
    meta: {
      type: 'TASK_OVERDUE',
      taskId: task.id,
      actionType: 'TASK_OVERDUE',
      createdAt: new Date().toISOString(),
    },
  };
}

/** Assign → notify assignee once (+ optional email). Managers are not duplicated. */
export async function notifyTaskAssigned(task) {
  const payload = buildTaskAssignedNotification({ task });
  await createNotificationOnce({
    ...payload,
    userId: task.assigneeId,
    audience: 'INTERNAL',
    eventKey: `${payload.eventKey}:user:${task.assigneeId}`,
  });
  queueTaskNotify(() =>
    maybeEmailUser(task.assigneeId, {
      subject: payload.title,
      text: payload.body,
    }),
  );
}

/** Status change → one notification per manager/creator (deduped). */
export function notifyTaskStatusChange({
  payload,
  actorUserId,
  createdById,
}) {
  queueTaskNotify(() =>
    notifyTaskStakeholders({
      payload,
      actorUserId,
      createdById,
    }),
  );
}

/** Field update / reassign side notifications (deduped, non-blocking). */
export function notifyTaskDetailsChanged({
  payload,
  actorUserId,
  assigneeId,
  createdById,
}) {
  queueTaskNotify(() =>
    notifyTaskStakeholders({
      payload,
      actorUserId,
      createdById,
      extraUserIds: assigneeId ? [assigneeId] : [],
    }),
  );
}

/** Direct notify one user (approve/reject/cancel → assignee). Non-blocking. */
export function notifyTaskUser(userId, payload, { email = false } = {}) {
  if (!userId) return;
  queueTaskNotify(async () => {
    await createNotificationOnce({
      ...payload,
      userId,
      audience: 'INTERNAL',
      eventKey: `${payload.eventKey}:user:${userId}`,
    });
    if (email) {
      await maybeEmailUser(userId, {
        subject: payload.title,
        text: payload.body,
      });
    }
  });
}
