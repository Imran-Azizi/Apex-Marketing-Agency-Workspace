import cron from 'node-cron';
import { backupService, getScheduleSettings } from '../modules/backup/service.js';

/** @type {import('node-cron').ScheduledTask[]} */
let tasks = [];
let started = false;

function parseHm(time) {
  const [h, m] = String(time || '23:00').split(':').map((x) => Number(x));
  return {
    h: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 23,
    m: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0,
  };
}

function stopAll() {
  for (const t of tasks) {
    try {
      t.stop();
    } catch {
      /* ignore */
    }
  }
  tasks = [];
}

async function fire(label) {
  console.log(`[backup-scheduler] triggering ${label} backup`);
  try {
    await backupService.createAutomatic(label);
  } catch (err) {
    console.error(`[backup-scheduler] ${label} failed:`, err?.message || err);
  }
}

export async function reloadBackupScheduler() {
  stopAll();
  const schedule = await getScheduleSettings();
  const tz = process.env.TZ || 'Asia/Kabul';

  if (schedule.daily?.enabled) {
    const { h, m } = parseHm(schedule.daily.time);
    const expr = `${m} ${h} * * *`;
    if (cron.validate(expr)) {
      tasks.push(
        cron.schedule(expr, () => fire('daily'), { timezone: tz }),
      );
      console.log(`[backup-scheduler] daily → ${expr} (${tz})`);
    }
  }

  if (schedule.weekly?.enabled) {
    const { h, m } = parseHm(schedule.weekly.time);
    const dow = Number(schedule.weekly.dayOfWeek);
    const day = Number.isFinite(dow) ? Math.min(6, Math.max(0, dow)) : 0;
    const expr = `${m} ${h} * * ${day}`;
    if (cron.validate(expr)) {
      tasks.push(
        cron.schedule(expr, () => fire('weekly'), { timezone: tz }),
      );
      console.log(`[backup-scheduler] weekly → ${expr} (${tz})`);
    }
  }

  if (schedule.monthly?.enabled) {
    const { h, m } = parseHm(schedule.monthly.time);
    const dom = Math.min(28, Math.max(1, Number(schedule.monthly.dayOfMonth) || 1));
    const expr = `${m} ${h} ${dom} * *`;
    if (cron.validate(expr)) {
      tasks.push(
        cron.schedule(expr, () => fire('monthly'), { timezone: tz }),
      );
      console.log(`[backup-scheduler] monthly → ${expr} (${tz})`);
    }
  }

  if (!tasks.length) {
    console.log('[backup-scheduler] no schedules enabled');
  }
}

export async function startBackupScheduler() {
  if (started) return;
  started = true;
  try {
    await reloadBackupScheduler();
  } catch (err) {
    console.error('[backup-scheduler] start failed:', err?.message || err);
  }
}
