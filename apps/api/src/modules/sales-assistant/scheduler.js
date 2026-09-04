import cron from 'node-cron';
import { getSettings } from './settings.js';

/** @type {import('node-cron').ScheduledTask[]} */
let tasks = [];
let started = false;

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

export async function reloadSalesAssistantScheduler() {
  stopAll();
  const settings = await getSettings();
  const tz = process.env.TZ || 'Asia/Kabul';

  if (!settings.enabled) {
    console.log('[sales-assistant-scheduler] agent disabled');
    return;
  }

  if (settings.dailyReportEnabled) {
    const h = Math.min(23, Math.max(0, Number(settings.dailyReportHour) || 8));
    const m = Math.min(59, Math.max(0, Number(settings.dailyReportMinute) || 0));
    const expr = `${m} ${h} * * *`;
    if (cron.validate(expr)) {
      tasks.push(
        cron.schedule(
          expr,
          () => {
            console.log('[sales-assistant-scheduler] daily report');
            import('./engine.js')
              .then((mod) => mod.generateDailyReport({ trigger: 'DAILY_REPORT' }))
              .catch((err) =>
                console.error('[sales-assistant-scheduler] daily failed', err?.message || err),
              );
          },
          { timezone: tz },
        ),
      );
      console.log(`[sales-assistant-scheduler] daily report → ${expr} (${tz})`);
    }
  }

  const hours = Math.max(1, Number(settings.scanIntervalHours) || 6);
  const scanExpr = `0 */${hours} * * *`;
  if (cron.validate(scanExpr)) {
    tasks.push(
      cron.schedule(
        scanExpr,
        () => {
          console.log('[sales-assistant-scheduler] periodic scan');
          import('./engine.js')
            .then((mod) => mod.runPipelineScan({ trigger: 'SCHEDULED_SCAN' }))
            .catch((err) =>
              console.error('[sales-assistant-scheduler] scan failed', err?.message || err),
            );
        },
        { timezone: tz },
      ),
    );
    console.log(`[sales-assistant-scheduler] scan → ${scanExpr} (${tz})`);
  }
}

export async function startSalesAssistantScheduler() {
  if (started) return;
  started = true;
  try {
    await reloadSalesAssistantScheduler();
  } catch (err) {
    console.error('[sales-assistant-scheduler] start failed:', err?.message || err);
  }
}
