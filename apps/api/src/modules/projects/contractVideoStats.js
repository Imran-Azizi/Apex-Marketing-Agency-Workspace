const PENDING_STATUSES = new Set(["NEW_MANAGER_REVIEW", "ON_HOLD"]);

/**
 * Roll up child video projects for a monthly contract.
 * Canceled videos are reported separately and are not part of the active total,
 * so completed + in progress + pending always equals total.
 */
export function summarizeContractVideos(children = []) {
  let completed = 0;
  let pending = 0;
  let inProgress = 0;
  let canceled = 0;

  for (const child of children) {
    const status = child?.status;
    if (status === "CANCELED") {
      canceled += 1;
      continue;
    }
    if (status === "COMPLETED") completed += 1;
    else if (PENDING_STATUSES.has(status)) pending += 1;
    else inProgress += 1;
  }

  const total = completed + pending + inProgress;
  const progressPercent =
    total === 0 ? 0 : Math.round((completed / total) * 100);

  return {
    total,
    completed,
    inProgress,
    pending,
    canceled,
    progressPercent,
  };
}

export function contractProgressPayload(stats) {
  const safe = stats || summarizeContractVideos([]);
  return {
    percent: safe.progressPercent,
    totalStages: safe.total,
    completedCount: safe.completed,
    remainingCount: Math.max(0, safe.total - safe.completed),
    currentStage: {
      key: "CONTRACT",
      label: "پیشرفت قرارداد",
      index: 0,
    },
    status: null,
    isComplete: safe.total > 0 && safe.completed === safe.total,
    isCanceled: false,
    isOnHold: false,
  };
}
