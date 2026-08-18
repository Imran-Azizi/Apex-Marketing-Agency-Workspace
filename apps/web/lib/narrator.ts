import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Mic2,
  RefreshCw,
  Send,
} from "lucide-react";

export type NarrationStatus =
  | "PENDING_NARRATION"
  | "RECORDING_IN_PROGRESS"
  | "NARRATION_SUBMITTED"
  | "APPROVED"
  | "REVISION_REQUESTED";

export type NarrationPriority = "OVERDUE" | "HIGH" | "MEDIUM" | "NORMAL";

export type NarratorTaskSummary = {
  id: string;
  projectId: string;
  status: NarrationStatus | string;
  title: string;
  scriptPreview?: string;
  assignedAt?: string | null;
  deadline?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  assignedAmount?: number | null;
  priority?: NarrationPriority | string;
  overdue?: boolean;
  revisionNotes?: string | null;
  updatedAt?: string | null;
  remainingMs?: number;
  projectStatus?: string | null;
  progress?: import("@/lib/project-progress").ProjectProgress | number | null;
};

/** Shown only after the manager explicitly confirms the uploaded audio. */
export const NARRATION_APPROVED_LABEL = "نریشن تایید شد";

export const NARRATION_STATUS_LABEL: Record<string, string> = {
  PENDING_NARRATION: "جدید",
  RECORDING_IN_PROGRESS: "در حال کار",
  NARRATION_SUBMITTED: "ارسال‌شده",
  APPROVED: NARRATION_APPROVED_LABEL,
  REVISION_REQUESTED: "نیاز به اصلاح",
};

export function isNarrationApproved(status?: string | null): boolean {
  return status === "APPROVED";
}

export const NARRATION_PRIORITY_LABEL: Record<string, string> = {
  OVERDUE: "مهلت گذشته",
  HIGH: "فوری",
  MEDIUM: "نزدیک",
  NORMAL: "عادی",
};

export function narrationStatusVariant(
  status: string,
): "brand" | "success" | "warning" | "destructive" | "secondary" {
  if (status === "APPROVED") return "success";
  if (status === "REVISION_REQUESTED") return "destructive";
  if (status === "NARRATION_SUBMITTED" || status === "RECORDING_IN_PROGRESS")
    return "warning";
  if (status === "PENDING_NARRATION") return "brand";
  return "secondary";
}

export function narrationPriorityVariant(
  priority?: string | null,
): "destructive" | "warning" | "secondary" | "outline" {
  if (priority === "OVERDUE") return "destructive";
  if (priority === "HIGH") return "warning";
  if (priority === "MEDIUM") return "secondary";
  return "outline";
}

export function narrationActionLabel(status: string): string {
  if (status === "PENDING_NARRATION") return "شروع کار";
  if (status === "REVISION_REQUESTED") return "مشاهده اصلاحیه";
  if (status === "NARRATION_SUBMITTED") return "مشاهده ارسال";
  if (status === "APPROVED") return "مشاهده";
  return "باز کردن فضای نریشن";
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

export const STATUS_ICONS: Record<string, LucideIcon> = {
  PENDING_NARRATION: Mic2,
  RECORDING_IN_PROGRESS: Clock3,
  NARRATION_SUBMITTED: Send,
  REVISION_REQUESTED: RefreshCw,
  APPROVED: CheckCircle2,
  OVERDUE: AlertTriangle,
};
