import cron from 'node-cron';
import { prisma } from '../../db/prisma.js';
import { createNotificationOnce } from '../../services/notifications.js';
import { OPEN_TASK_STATUSES } from './constants.js';
import {
  buildTaskDeadlineReminderNotification,
  buildTaskOverdueNotification,
  notifyTaskStakeholders,
} from './notifications.js';

let started = false;
/** @type {import('node-cron').ScheduledTask | null} */
let job = null;

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * Remind assignees (and managers for overdue) about approaching / past deadlines.
 * Approaching = within next 48 hours. Runs hourly.
 */
export async function runTaskDeadlineSweep() {
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const key = dayKey(now);

  const openTasks = await prisma.managementTask.findMany({
    where: {
      deletedAt: null,
      status: { in: OPEN_TASK_STATUSES },
      deadline: { lte: in48h },
    },
    select: {
      id: true,
      title: true,
      priority: true,
      status: true,
      deadline: true,
      assigneeId: true,
      createdById: true,
    },
  });

  for (const task of openTasks) {
    const deadlineMs = new Date(task.deadline).getTime();
    const overdue = deadlineMs < now.getTime();

    if (overdue) {
      const payload = buildTaskOverdueNotification({ task, dayKey: key });
      await notifyTaskStakeholders({
        payload,
        createdById: task.createdById,
        extraUserIds: [task.assigneeId],
      });
      continue;
    }

    // Approaching: deadline within 48h and still in the future
    if (deadlineMs <= in48h.getTime()) {
      const payload = buildTaskDeadlineReminderNotification({ task, dayKey: key });
      await createNotificationOnce({
        ...payload,
        userId: task.assigneeId,
        audience: 'INTERNAL',
        eventKey: `${payload.eventKey}:user:${task.assigneeId}`,
      });
    }
  }

  return { scanned: openTasks.length };
}

export async function startTaskDeadlineScheduler() {
  if (started) return;
  started = true;
  const tz = process.env.TZ || 'Asia/Kabul';
  const expr = '15 * * * *'; // every hour at :15
  if (!cron.validate(expr)) {
    console.error('[task-scheduler] invalid cron expression');
    return;
  }
  job = cron.schedule(
    expr,
    () => {
      runTaskDeadlineSweep().catch((err) =>
        console.error('[task-scheduler] sweep failed:', err?.message || err),
      );
    },
    { timezone: tz },
  );
  console.log(`[task-scheduler] deadline sweep → ${expr} (${tz})`);
}

export function stopTaskDeadlineScheduler() {
  try {
    job?.stop();
  } catch {
    /* ignore */
  }
  job = null;
  started = false;
}
