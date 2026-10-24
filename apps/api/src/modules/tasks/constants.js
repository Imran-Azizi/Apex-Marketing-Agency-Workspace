export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const TASK_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'IN_PROGRESS',
  'COMPLETED',
  'APPROVED',
  'ISSUE_REPORTED',
  'CANCELLED',
];

/** Statuses that still count toward overdue / deadline reminder jobs. */
export const OPEN_TASK_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'IN_PROGRESS',
  'ISSUE_REPORTED',
];

export const TASK_PRIORITY_LABELS = {
  LOW: 'کم',
  MEDIUM: 'متوسط',
  HIGH: 'بالا',
  URGENT: 'فوری',
};

export const TASK_STATUS_LABELS = {
  PENDING: 'در انتظار پذیرش',
  ACCEPTED: 'پذیرفته‌شده',
  DECLINED: 'رد شده توسط کارمند',
  IN_PROGRESS: 'در حال انجام',
  /** Employee finished work — awaiting manager confirmation */
  COMPLETED: 'در انتظار تأیید',
  /** Manager confirmed — fully done */
  APPROVED: 'تکمیل‌شده',
  ISSUE_REPORTED: 'گزارش مشکل',
  CANCELLED: 'لغو شده',
};

export const ASSIGNABLE_ROLE_CODES = [
  'MANAGER',
  'ADMIN',
  'SALES',
  'EDITOR',
  'NARRATOR',
  'FINANCE',
  'PROJECT_MANAGER',
];
