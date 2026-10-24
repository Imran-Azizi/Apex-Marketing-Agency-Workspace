export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "APPROVED"
  | "ISSUE_REPORTED"
  | "CANCELLED";

export interface TaskUserBrief {
  id: string;
  fullName: string;
  email?: string;
  profileImage?: string | null;
  roleCode?: string | null;
  roleName?: string | null;
}

export interface TaskActivity {
  id: string;
  action: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus | null;
  message: string | null;
  meta?: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; fullName: string; profileImage?: string | null } | null;
}

export interface ManagementTask {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  statusLabel: string;
  priorityLabel: string;
  assigneeId: string;
  assignee: TaskUserBrief | null;
  createdById: string;
  createdBy: TaskUserBrief | null;
  approvedById: string | null;
  approvedBy: { id: string; fullName: string; profileImage?: string | null } | null;
  deadline: string;
  isOverdue: boolean;
  acceptedAt: string | null;
  declinedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  approvedAt: string | null;
  issueReportedAt: string | null;
  cancelledAt: string | null;
  declineNote: string | null;
  issueNote: string | null;
  rejectionNote: string | null;
  completionNote: string | null;
  createdAt: string;
  updatedAt: string;
  activities?: TaskActivity[];
}

export interface TaskListResponse {
  items: ManagementTask[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TaskStats {
  total: number;
  pending: number;
  accepted: number;
  inProgress: number;
  completed: number;
  approved: number;
  issueReported: number;
  overdue: number;
  byPriority: Record<TaskPriority, number>;
  byAssignee: Array<{
    assigneeId: string;
    fullName: string;
    profileImage: string | null;
    count: number;
  }>;
}

export const TASK_PRIORITIES: TaskPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
];

export const TASK_STATUSES: TaskStatus[] = [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "IN_PROGRESS",
  "COMPLETED",
  "APPROVED",
  "ISSUE_REPORTED",
  "CANCELLED",
];

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "کم",
  MEDIUM: "متوسط",
  HIGH: "بالا",
  URGENT: "فوری",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "در انتظار پذیرش",
  ACCEPTED: "پذیرفته‌شده",
  DECLINED: "رد شده",
  IN_PROGRESS: "در حال انجام",
  /** Employee marked done — waiting for manager confirmation */
  COMPLETED: "در انتظار تأیید",
  /** Manager confirmed — task is fully finished */
  APPROVED: "تکمیل‌شده",
  ISSUE_REPORTED: "گزارش مشکل",
  CANCELLED: "لغو شده",
};

export const PRIORITY_BADGE_VARIANTS: Record<
  TaskPriority,
  "secondary" | "outline" | "warning" | "destructive"
> = {
  LOW: "secondary",
  MEDIUM: "outline",
  HIGH: "warning",
  URGENT: "destructive",
};

export const STATUS_BADGE_VARIANTS: Record<
  TaskStatus,
  "secondary" | "outline" | "brand" | "warning" | "success" | "destructive" | "default"
> = {
  PENDING: "secondary",
  ACCEPTED: "brand",
  DECLINED: "destructive",
  IN_PROGRESS: "warning",
  COMPLETED: "warning",
  APPROVED: "success",
  ISSUE_REPORTED: "destructive",
  CANCELLED: "secondary",
};

export const ACTIVITY_LABELS: Record<string, string> = {
  CREATED: "ایجاد وظیفه",
  UPDATED: "به‌روزرسانی",
  REASSIGNED: "تغییر مسئول",
  ACCEPTED: "پذیرش",
  DECLINED: "رد توسط کارمند",
  STARTED: "شروع کار",
  COMPLETED: "ارسال برای تأیید مدیر",
  ISSUE_REPORTED: "گزارش مشکل",
  APPROVED: "تکمیل نهایی توسط مدیر",
  COMPLETION_REJECTED: "رد تکمیل توسط مدیر",
  CANCELLED: "لغو",
  DELETED: "حذف",
};

export function formatCount(value: number) {
  return new Intl.NumberFormat("fa-AF", { numberingSystem: "latn" }).format(
    value || 0,
  );
}
