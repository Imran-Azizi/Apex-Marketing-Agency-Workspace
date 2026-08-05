/**
 * Shared progress types + helpers.
 * Canonical calculation lives on the API (`projectProgress` service).
 * Frontend prefers `project.progress` from the backend.
 */

export type ProjectProgress = {
  percent: number;
  totalStages?: number;
  completedCount?: number;
  remainingCount?: number;
  currentStage?: {
    key: string;
    label: string;
    index: number;
  };
  status?: string | null;
  customerFacingStatus?: string | null;
  isComplete?: boolean;
  isCanceled?: boolean;
  isOnHold?: boolean;
};

/**
 * Fallback % map — keep in sync with apps/api/src/services/projectProgress.js
 * Used only when API progress is missing.
 */
export const PROJECT_STATUS_PROGRESS_FALLBACK: Record<string, number> = {
  NEW_MANAGER_REVIEW: 8,
  CONTENT_GENERATION: 18,
  INTERNAL_CONTENT_REVIEW: 28,
  WAITING_CLIENT_CONTENT_APPROVAL: 38,
  CONTENT_REVISION: 34,
  NARRATION_RECORDING: 48,
  PRODUCTION_EDITING: 62,
  PRODUCTION: 62,
  MANAGER_FINAL_REVIEW: 72,
  FINAL_REVISION: 68,
  WAITING_CLIENT_FINAL_APPROVAL: 82,
  WAITING_PAYMENT: 90,
  READY_TO_DOWNLOAD: 95,
  COMPLETED: 100,
  ON_HOLD: 15,
  CANCELED: 0,
  INFO_RECEIVED: 8,
  PREPARING_CONTENT: 18,
  WAITING_YOUR_APPROVAL: 38,
  IN_PRODUCTION: 62,
  FINAL_REVIEW: 72,
  READY_DELIVERY: 95,
};

/** Accept API progress object or legacy plain number. */
export function resolveProgressPercent(
  progress: ProjectProgress | number | null | undefined,
  fallbackStatus?: string | null,
): number {
  if (typeof progress === "number" && Number.isFinite(progress)) {
    return Math.min(100, Math.max(0, Math.round(progress)));
  }
  if (progress && typeof progress === "object" && Number.isFinite(progress.percent)) {
    return Math.min(100, Math.max(0, Math.round(progress.percent)));
  }
  if (fallbackStatus) {
    return PROJECT_STATUS_PROGRESS_FALLBACK[fallbackStatus] ?? 0;
  }
  return 0;
}

export function resolveCurrentStageLabel(
  progress: ProjectProgress | number | null | undefined,
  fallbackLabel?: string | null,
): string {
  if (progress && typeof progress === "object" && progress.currentStage?.label) {
    return progress.currentStage.label;
  }
  return fallbackLabel || "—";
}

export function formatProgressPercentFa(percent: number): string {
  return `${Math.min(100, Math.max(0, percent)).toLocaleString("fa-AF", {
    numberingSystem: "latn",
  })}٪`;
}
