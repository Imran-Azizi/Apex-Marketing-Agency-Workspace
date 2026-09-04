import { prisma } from '../../db/prisma.js';
import { DEFAULT_SETTINGS } from './constants.js';

export async function getSettings() {
  if (!prisma.businessAssistantSettings) {
    return { ...DEFAULT_SETTINGS };
  }
  const row = await prisma.businessAssistantSettings.findUnique({
    where: { id: 'default' },
  });
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    enabled: row.enabled,
    weeklyReportEnabled: row.weeklyReportEnabled,
    weeklyReportDay: row.weeklyReportDay,
    weeklyReportHour: row.weeklyReportHour,
    weeklyReportMinute: row.weeklyReportMinute,
    receivableAlertPct: row.receivableAlertPct,
    overdueProjectDays: row.overdueProjectDays,
    profitTargetGapPct: row.profitTargetGapPct,
    pipelineStuckDays: row.pipelineStuckDays,
    notifyManagerOnHigh: row.notifyManagerOnHigh,
    updatedAt: row.updatedAt,
    updatedById: row.updatedById,
  };
}
