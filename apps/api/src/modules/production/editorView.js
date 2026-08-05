/** Editor-facing payloads — least-privilege serialization. */

import { buildProjectProgress } from '../../services/projectProgress.js';

const OPEN_STATUSES = new Set([
  "ASSIGNED",
  "IN_PROGRESS",
  "REVISION_REQUESTED",
]);

export function computeEditingPriority(task, deadline) {
  if (!deadline) return "NORMAL";
  if (["COMPLETED", "REVIEW_REQUIRED"].includes(task.status)) return "NORMAL";
  const msLeft = new Date(deadline).getTime() - Date.now();
  if (msLeft < 0) return "OVERDUE";
  if (msLeft <= 24 * 60 * 60 * 1000) return "HIGH";
  if (msLeft <= 72 * 60 * 60 * 1000) return "MEDIUM";
  return "NORMAL";
}

export function isEditingOverdue(task, deadline) {
  if (!deadline || !OPEN_STATUSES.has(task.status)) return false;
  return new Date(deadline).getTime() < Date.now();
}

function instructionsPreview(text, max = 160) {
  if (!text) return "";
  const compact = String(text).replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max)}…`;
}

/**
 * Safe list/dashboard row for editors — no customer/finance/internal fields.
 */
export function serializeEditorTaskSummary(task, assignment) {
  const deadline = task.deadline ?? assignment?.deadlineAt ?? null;
  const assignedAt = assignment?.createdAt ?? task.createdAt ?? null;
  const amount =
    task.assignedAmount != null ? Number(task.assignedAmount) : null;
  const title = task.project?.title || "پروژه ادیت";

  return {
    id: task.id,
    projectId: task.projectId,
    status: task.status,
    title,
    instructionsPreview: instructionsPreview(task.instructions),
    revisionNotes:
      task.status === "REVISION_REQUESTED"
        ? (task.revisionNotes ?? null)
        : null,
    assignedAt,
    deadline,
    submittedAt: task.submittedAt ?? null,
    completedAt: task.completedAt ?? null,
    version: task.version ?? 1,
    assignedAmount: Number.isFinite(amount) ? amount : null,
    priority: computeEditingPriority(task, deadline),
    overdue: isEditingOverdue(task, deadline),
    updatedAt: task.updatedAt ?? null,
    projectStatus: task.project?.status ?? null,
    progress: buildProjectProgress({
      status: task.project?.status,
      audience: "internal",
    }),
  };
}
