import { buildProjectProgress } from '../../services/projectProgress.js';

/** Narrator-facing payloads — least-privilege serialization. */

export const NARRATION_NOTIFICATION_TYPES = [
  'NARRATION_ASSIGNED',
  'NARRATION_DEADLINE_REMINDER',
  'NARRATION_APPROVED',
  'NARRATION_REVISION_REQUESTED',
];

export function parseNarrationContent(raw) {
  if (raw == null) return { title: null, script: '' };
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return { title: null, script: trimmed };
  }
  if (typeof raw === 'object') {
    const o = raw;
    const script =
      typeof o.script === 'string'
        ? o.script
        : typeof o.text === 'string'
          ? o.text
          : '';
    const title =
      typeof o.title === 'string' && o.title.trim()
        ? o.title.trim()
        : typeof o.headline === 'string' && o.headline.trim()
          ? o.headline.trim()
          : null;
    return { title, script: script.trim() };
  }
  return { title: null, script: '' };
}

function serializeAudioFile(file) {
  if (!file) return null;
  return {
    id: file.id,
    name: file.name,
    storageKey: file.storageKey,
    mimeType: file.mimeType ?? null,
    sizeBytes: file.sizeBytes ?? null,
    version: file.version ?? null,
    createdAt: file.createdAt,
  };
}

function serializeTake(take, currentFileId) {
  const file = take.projectFile ?? null;
  return {
    id: take.id,
    version: take.version,
    createdAt: take.createdAt,
    isCurrent: Boolean(file?.id && file.id === currentFileId),
    audioFile: serializeAudioFile(file),
  };
}

export function serializeNarrationTakes(task) {
  const currentFileId = task.audioFileId ?? task.audioFile?.id ?? null;
  const takes = Array.isArray(task.takes) ? [...task.takes] : [];
  takes.sort((a, b) => a.version - b.version);
  return takes.map((take) => serializeTake(take, currentFileId));
}

const OPEN_STATUSES = new Set([
  'PENDING_NARRATION',
  'RECORDING_IN_PROGRESS',
  'REVISION_REQUESTED',
]);

export function computeNarrationPriority(task, deadline) {
  if (!deadline) return 'NORMAL';
  if (['APPROVED', 'NARRATION_SUBMITTED'].includes(task.status)) return 'NORMAL';
  const msLeft = new Date(deadline).getTime() - Date.now();
  if (msLeft < 0) return 'OVERDUE';
  if (msLeft <= 24 * 60 * 60 * 1000) return 'HIGH';
  if (msLeft <= 72 * 60 * 60 * 1000) return 'MEDIUM';
  return 'NORMAL';
}

export function isNarrationOverdue(task, deadline) {
  if (!deadline || !OPEN_STATUSES.has(task.status)) return false;
  return new Date(deadline).getTime() < Date.now();
}

function scriptPreview(script, max = 140) {
  if (!script) return '';
  const compact = String(script).replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max)}…`;
}

/**
 * Minimal task row for narrator dashboard / projects lists.
 */
export function serializeNarratorTaskSummary(task, assignment) {
  const narration = parseNarrationContent(
    task.narrationScriptSnapshot ?? task.contentVersion?.narration,
  );
  const deadline = task.deadline ?? assignment?.deadlineAt ?? null;
  const assignedAt = assignment?.createdAt ?? task.createdAt ?? null;
  const amount =
    task.assignedAmount != null ? Number(task.assignedAmount) : null;

  return {
    id: task.id,
    projectId: task.projectId,
    status: task.status,
    title: narration.title || 'متن نریشن',
    scriptPreview: scriptPreview(narration.script),
    assignedAt,
    deadline,
    submittedAt: task.submittedAt ?? null,
    approvedAt: task.approvedAt ?? null,
    assignedAmount: Number.isFinite(amount) ? amount : null,
    priority: computeNarrationPriority(task, deadline),
    overdue: isNarrationOverdue(task, deadline),
    revisionNotes:
      task.status === 'REVISION_REQUESTED' ? task.revisionNotes ?? null : null,
    updatedAt: task.updatedAt ?? null,
    projectStatus: task.project?.status ?? null,
    progress: buildProjectProgress({
      status: task.project?.status,
      audience: 'internal',
    }),
  };
}

/**
 * Full narrator workspace — no project/customer/team/confidential fields.
 */
export function serializeNarratorWorkspace(task, assignment) {
  const narration = parseNarrationContent(
    task.narrationScriptSnapshot ?? task.contentVersion?.narration,
  );

  return {
    id: task.id,
    projectId: task.projectId,
    status: task.status,
    title: narration.title,
    script: narration.script,
    assignedAt: assignment?.createdAt ?? null,
    deadline: task.deadline ?? assignment?.deadlineAt ?? null,
    revisionNotes: task.revisionNotes ?? null,
    submittedAt: task.submittedAt ?? null,
    approvedAt: task.approvedAt ?? null,
    audioFile: serializeAudioFile(task.audioFile),
    takes: serializeNarrationTakes(task),
  };
}

export function sanitizeNarratorNotificationBody(body) {
  if (!body || typeof body !== 'string') return null;
  return body
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return (
        t &&
        !t.startsWith('پروژه:') &&
        !t.startsWith('شناسه:') &&
        !t.startsWith('مشتری:')
      );
    })
    .join('\n')
    .trim();
}

export function serializeNarratorNotification(notification) {
  const meta =
    notification.meta && typeof notification.meta === 'object'
      ? notification.meta
      : {};
  return {
    id: notification.id,
    title: notification.title,
    body: sanitizeNarratorNotificationBody(notification.body),
    isRead: notification.isRead,
    createdAt: notification.createdAt,
    readAt: notification.readAt ?? null,
    type: meta.type || null,
    projectId: meta.projectId || null,
  };
}
