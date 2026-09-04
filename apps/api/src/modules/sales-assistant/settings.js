import { prisma } from '../../db/prisma.js';
import { DEFAULT_SETTINGS } from './constants.js';

export async function getSettings() {
  if (!prisma.salesAssistantSettings) {
    return { ...DEFAULT_SETTINGS };
  }
  const row = await prisma.salesAssistantSettings.findUnique({
    where: { id: 'default' },
  });
  if (!row) {
    return { ...DEFAULT_SETTINGS };
  }
  return {
    enabled: row.enabled,
    decisionWaitingDays: row.decisionWaitingDays,
    pendingDepositDays: row.pendingDepositDays,
    repeatOrderMinDays: row.repeatOrderMinDays,
    repeatOrderMaxDays: row.repeatOrderMaxDays,
    skipIfActiveHours: row.skipIfActiveHours,
    dailyReportEnabled: row.dailyReportEnabled,
    dailyReportHour: row.dailyReportHour,
    dailyReportMinute: row.dailyReportMinute,
    notifyRepOnHigh: row.notifyRepOnHigh,
    notifyManagerOnHigh: row.notifyManagerOnHigh,
    highValueMinOrders: row.highValueMinOrders,
    scanIntervalHours: row.scanIntervalHours,
    priorityRules: row.priorityRules,
    updatedAt: row.updatedAt,
    updatedById: row.updatedById,
  };
}

export async function ensureSettings(tx = prisma) {
  if (!tx.salesAssistantSettings) return { ...DEFAULT_SETTINGS };
  const existing = await tx.salesAssistantSettings.findUnique({
    where: { id: 'default' },
  });
  if (existing) return existing;
  return tx.salesAssistantSettings.create({
    data: {
      id: 'default',
      ...DEFAULT_SETTINGS,
    },
  });
}

export async function updateSettings(payload, userId) {
  await ensureSettings();
  const next = await prisma.salesAssistantSettings.update({
    where: { id: 'default' },
    data: {
      enabled: payload.enabled,
      decisionWaitingDays: payload.decisionWaitingDays,
      pendingDepositDays: payload.pendingDepositDays,
      repeatOrderMinDays: payload.repeatOrderMinDays,
      repeatOrderMaxDays: payload.repeatOrderMaxDays,
      skipIfActiveHours: payload.skipIfActiveHours,
      dailyReportEnabled: payload.dailyReportEnabled,
      dailyReportHour: payload.dailyReportHour,
      dailyReportMinute: payload.dailyReportMinute,
      notifyRepOnHigh: payload.notifyRepOnHigh,
      notifyManagerOnHigh: payload.notifyManagerOnHigh,
      highValueMinOrders: payload.highValueMinOrders,
      scanIntervalHours: payload.scanIntervalHours,
      priorityRules: payload.priorityRules,
      updatedById: userId || null,
    },
  });
  return next;
}
