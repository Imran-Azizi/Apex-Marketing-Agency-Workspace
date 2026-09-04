/**
 * Business Assistant Agent — shared constants.
 */

export const PROMPT_VERSION = 'business-assistant-v2-consultant';

export const KINDS = Object.freeze({
  PROFIT_GAP: 'PROFIT_GAP',
  RECEIVABLE_HIGH: 'RECEIVABLE_HIGH',
  PIPELINE_BOTTLENECK: 'PIPELINE_BOTTLENECK',
  OVERDUE_PROJECTS: 'OVERDUE_PROJECTS',
  PAYROLL_PRESSURE: 'PAYROLL_PRESSURE',
  SALES_CONVERSION: 'SALES_CONVERSION',
  REPEAT_REVENUE: 'REPEAT_REVENUE',
  EMPLOYEE_CAPACITY: 'EMPLOYEE_CAPACITY',
  REVENUE_TREND: 'REVENUE_TREND',
  LEAD_GENERATION: 'LEAD_GENERATION',
  MARKETING_ENGAGEMENT: 'MARKETING_ENGAGEMENT',
  STRATEGY_FOLLOWUP: 'STRATEGY_FOLLOWUP',
  MONTHLY_STRATEGY: 'MONTHLY_STRATEGY',
  WEEKLY_STRATEGY: 'WEEKLY_STRATEGY',
});

export const KIND_LABELS = Object.freeze({
  PROFIT_GAP: 'شکاف سود',
  RECEIVABLE_HIGH: 'مطالبات بالا',
  PIPELINE_BOTTLENECK: 'گلوگاه مسیر فروش',
  OVERDUE_PROJECTS: 'پروژه‌های تأخیری',
  PAYROLL_PRESSURE: 'فشار حقوق',
  SALES_CONVERSION: 'تبدیل فروش',
  REPEAT_REVENUE: 'درآمد تکراری',
  EMPLOYEE_CAPACITY: 'ظرفیت تیم',
  REVENUE_TREND: 'روند درآمد',
  LEAD_GENERATION: 'جذب سرنخ',
  MARKETING_ENGAGEMENT: 'تعامل بازاریابی',
  STRATEGY_FOLLOWUP: 'پیگیری استراتژی',
  MONTHLY_STRATEGY: 'استراتژی ماهانه',
  WEEKLY_STRATEGY: 'استراتژی هفتگی',
});

export const CATEGORIES = Object.freeze({
  FINANCE: 'FINANCE',
  CRM: 'CRM',
  PROJECTS: 'PROJECTS',
  HR: 'HR',
  MARKETING: 'MARKETING',
  STRATEGY: 'STRATEGY',
});

export const CATEGORY_LABELS = Object.freeze({
  FINANCE: 'مالی',
  CRM: 'فروش و CRM',
  PROJECTS: 'پروژه‌ها',
  HR: 'منابع انسانی',
  MARKETING: 'بازاریابی',
  STRATEGY: 'استراتژی',
});

export const SWOT = Object.freeze({
  STRENGTH: 'STRENGTH',
  WEAKNESS: 'WEAKNESS',
  RISK: 'RISK',
  OPPORTUNITY: 'OPPORTUNITY',
});

export const SWOT_LABELS = Object.freeze({
  STRENGTH: 'نقطه قوت',
  WEAKNESS: 'نقطه ضعف',
  RISK: 'ریسک',
  OPPORTUNITY: 'فرصت',
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

export const OPEN_ACTION_STATES = Object.freeze([
  ACTION_STATES.NEW,
  ACTION_STATES.VIEWED,
  ACTION_STATES.IN_PROGRESS,
]);

export const TRIGGERS = Object.freeze({
  SCHEDULED_SCAN: 'SCHEDULED_SCAN',
  WEEKLY_REPORT: 'WEEKLY_REPORT',
  MANUAL: 'MANUAL',
});

export const TARGET_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ACHIEVED: 'ACHIEVED',
  MISSED: 'MISSED',
  CLOSED: 'CLOSED',
});

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  weeklyReportEnabled: true,
  weeklyReportDay: 1,
  weeklyReportHour: 8,
  weeklyReportMinute: 0,
  receivableAlertPct: 30,
  overdueProjectDays: 3,
  profitTargetGapPct: 15,
  pipelineStuckDays: 7,
  notifyManagerOnHigh: true,
});
