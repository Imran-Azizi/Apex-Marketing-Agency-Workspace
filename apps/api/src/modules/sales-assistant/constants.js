/**
 * Sales Assistant Agent — shared constants.
 * Threshold defaults live in SalesAssistantSettings (not hard-coded here).
 */

export const PROMPT_VERSION = 'sales-assistant-v2-openrouter-free';

export const KINDS = Object.freeze({
  FOLLOW_UP: 'FOLLOW_UP',
  DEPOSIT_FOLLOW_UP: 'DEPOSIT_FOLLOW_UP',
  REPEAT_ORDER: 'REPEAT_ORDER',
});

export const KIND_LABELS = Object.freeze({
  FOLLOW_UP: 'پیگیری تصمیم',
  DEPOSIT_FOLLOW_UP: 'پیگیری بیعانه',
  REPEAT_ORDER: 'سفارش تکراری',
});

export const CATEGORIES = Object.freeze({
  DECISION: 'DECISION',
  DEPOSIT: 'DEPOSIT',
  REPEAT: 'REPEAT',
});

export const CATEGORY_LABELS = Object.freeze({
  DECISION: 'در انتظار تصمیم',
  DEPOSIT: 'در انتظار بیعانه',
  REPEAT: 'مشتری تکراری',
});

export const PRIORITIES = Object.freeze({
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});

export const PRIORITY_LABELS = Object.freeze({
  HIGH: 'بالا',
  MEDIUM: 'متوسط',
  LOW: 'پایین',
});

export const ACTION_STATES = Object.freeze({
  NEW: 'NEW',
  VIEWED: 'VIEWED',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
  DISMISSED: 'DISMISSED',
});

export const ACTION_STATE_LABELS = Object.freeze({
  NEW: 'جدید',
  VIEWED: 'مشاهده‌شده',
  IN_PROGRESS: 'در حال پیگیری',
  DONE: 'انجام‌شده',
  DISMISSED: 'رد شده',
});

export const OPEN_ACTION_STATES = Object.freeze([
  ACTION_STATES.NEW,
  ACTION_STATES.VIEWED,
  ACTION_STATES.IN_PROGRESS,
]);

export const TRIGGERS = Object.freeze({
  SCHEDULED_SCAN: 'SCHEDULED_SCAN',
  DAILY_REPORT: 'DAILY_REPORT',
  CRM_EVENT: 'CRM_EVENT',
  MANUAL: 'MANUAL',
});

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  decisionWaitingDays: 2,
  pendingDepositDays: 1,
  repeatOrderMinDays: 45,
  repeatOrderMaxDays: 180,
  skipIfActiveHours: 18,
  dailyReportEnabled: true,
  dailyReportHour: 8,
  dailyReportMinute: 0,
  notifyRepOnHigh: true,
  notifyManagerOnHigh: true,
  highValueMinOrders: 2,
  scanIntervalHours: 6,
});
