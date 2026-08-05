import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  Clapperboard,
  Clock3,
  RefreshCw,
  Send,
} from "lucide-react";

export type EditingStatus =
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "REVIEW_REQUIRED"
  | "REVISION_REQUESTED"
  | "COMPLETED";

export type EditingPriority = "OVERDUE" | "HIGH" | "MEDIUM" | "NORMAL";

export type EditorTaskSummary = {
  id: string;
  projectId: string;
  status: EditingStatus | string;
  title: string;
  instructionsPreview?: string;
  revisionNotes?: string | null;
  assignedAt?: string | null;
  deadline?: string | null;
  submittedAt?: string | null;
  completedAt?: string | null;
  version?: number;
  assignedAmount?: number | null;
  priority?: EditingPriority | string;
  overdue?: boolean;
  updatedAt?: string | null;
  remainingMs?: number;
  projectStatus?: string | null;
  progress?: import("@/lib/project-progress").ProjectProgress | number | null;
};

export const EDITING_STATUS_LABEL: Record<string, string> = {
  ASSIGNED: "ارجاع جدید",
  IN_PROGRESS: "در حال ادیت",
  REVIEW_REQUIRED: "ارسال‌شده",
  REVISION_REQUESTED: "نیاز به اصلاح",
  COMPLETED: "تکمیل‌شده",
};

export const EDITING_PRIORITY_LABEL: Record<string, string> = {
  OVERDUE: "مهلت گذشته",
  HIGH: "فوری",
  MEDIUM: "متوسط",
  NORMAL: "عادی",
};

export function editingStatusVariant(
  status: string,
): "brand" | "success" | "warning" | "destructive" | "secondary" {
  if (status === "COMPLETED") return "success";
  if (status === "REVISION_REQUESTED") return "destructive";
  if (status === "REVIEW_REQUIRED" || status === "IN_PROGRESS")
    return "warning";
  if (status === "ASSIGNED") return "brand";
  return "secondary";
}

export function editingPriorityVariant(
  priority?: string | null,
): "destructive" | "warning" | "secondary" | "outline" {
  if (priority === "OVERDUE") return "destructive";
  if (priority === "HIGH") return "warning";
  if (priority === "MEDIUM") return "secondary";
  return "outline";
}

export function editingActionLabel(status: string): string {
  if (status === "ASSIGNED") return "شروع ادیت";
  if (status === "REVISION_REQUESTED") return "مشاهده اصلاحیه";
  if (status === "REVIEW_REQUIRED") return "مشاهده ارسال";
  if (status === "COMPLETED") return "مشاهده";
  return "باز کردن فضای ادیت";
}

export function formatRemainingTime(remainingMs?: number | null): string {
  if (remainingMs == null) return "—";
  if (remainingMs < 0) {
    const hours = Math.ceil(Math.abs(remainingMs) / (1000 * 60 * 60));
    if (hours < 24) return `${hours} ساعت گذشته`;
    return `${Math.ceil(hours / 24)} روز گذشته`;
  }
  const hours = Math.ceil(remainingMs / (1000 * 60 * 60));
  if (hours < 24) return `${hours} ساعت مانده`;
  return `${Math.ceil(hours / 24)} روز مانده`;
}

export const EDITING_STATUS_ICONS: Record<string, LucideIcon> = {
  ASSIGNED: Clapperboard,
  IN_PROGRESS: Clock3,
  REVIEW_REQUIRED: Send,
  REVISION_REQUESTED: RefreshCw,
  COMPLETED: CheckCircle2,
  OVERDUE: AlertTriangle,
};
