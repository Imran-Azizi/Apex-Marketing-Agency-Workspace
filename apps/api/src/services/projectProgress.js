/**
 * Centralized project workflow progress.
 * Single source of truth for stage order, labels, and percentages.
 *
 * Progress maps 1:1 to real ProjectStatus milestones (not fictional
 * scenario/storyboard steps). Audiences:
 *   - internal: full stage labels (manager / staff)
 *   - portal: customer-safe labels
 */

import { formatFaDateTime } from '../utils/datetime.js';

/**
 * Canonical workflow stages aligned with production reality.
 * Percentages advance monotonically through the happy path;
 * revision states stay near their parent milestone (no big drops).
 */
export const PROJECT_WORKFLOW_STAGES = Object.freeze([
  {
    key: 'NEW_MANAGER_REVIEW',
    label: 'بررسی اولیه مدیر',
    customerLabel: 'ثبت سفارش',
    progress: 8,
  },
  {
    key: 'CONTENT_GENERATION',
    label: 'تولید محتوا',
    customerLabel: 'آماده‌سازی محتوا',
    progress: 18,
  },
  {
    key: 'INTERNAL_CONTENT_REVIEW',
    label: 'بازبینی داخلی محتوا',
    customerLabel: 'آماده‌سازی محتوا',
    progress: 28,
  },
  {
    key: 'WAITING_CLIENT_CONTENT_APPROVAL',
    label: 'منتظر تأیید محتوا',
    customerLabel: 'منتظر تأیید شما',
    progress: 38,
  },
  {
    key: 'CONTENT_REVISION',
    label: 'اصلاح محتوا',
    customerLabel: 'در حال اصلاح',
    progress: 34,
  },
  {
    key: 'NARRATION_RECORDING',
    label: 'ضبط نریشن',
    customerLabel: 'در تولید',
    progress: 48,
  },
  {
    key: 'PRODUCTION_EDITING',
    label: 'تولید و ادیت ویدیو',
    customerLabel: 'در تولید',
    progress: 62,
  },
  {
    key: 'MANAGER_FINAL_REVIEW',
    label: 'بازبینی نهایی مدیر',
    customerLabel: 'بازبینی',
    progress: 72,
  },
  {
    key: 'FINAL_REVISION',
    label: 'اصلاح نهایی ویدیو',
    customerLabel: 'در حال اصلاح',
    progress: 68,
  },
  {
    key: 'WAITING_CLIENT_FINAL_APPROVAL',
    label: 'منتظر تأیید ویدیو نهایی',
    customerLabel: 'منتظر تأیید شما',
    progress: 82,
  },
  {
    key: 'WAITING_PAYMENT',
    label: 'منتظر پرداخت',
    customerLabel: 'منتظر پرداخت',
    progress: 90,
  },
  {
    key: 'READY_TO_DOWNLOAD',
    label: 'آماده تحویل',
    customerLabel: 'آماده دانلود',
    progress: 95,
  },
  {
    key: 'COMPLETED',
    label: 'تکمیل پروژه',
    customerLabel: 'تکمیل‌شده',
    progress: 100,
  },
  {
    key: 'ON_HOLD',
    label: 'متوقف',
    customerLabel: 'متوقف',
    progress: 15,
  },
]);

const TOTAL_STAGES = PROJECT_WORKFLOW_STAGES.length;

/**
 * Map internal ProjectStatus → workflow stage key (1:1 with real statuses).
 */
export const STATUS_TO_STAGE_KEY = Object.freeze({
  NEW_MANAGER_REVIEW: 'NEW_MANAGER_REVIEW',
  CONTENT_GENERATION: 'CONTENT_GENERATION',
  INTERNAL_CONTENT_REVIEW: 'INTERNAL_CONTENT_REVIEW',
  WAITING_CLIENT_CONTENT_APPROVAL: 'WAITING_CLIENT_CONTENT_APPROVAL',
  CONTENT_REVISION: 'CONTENT_REVISION',
  NARRATION_RECORDING: 'NARRATION_RECORDING',
  PRODUCTION_EDITING: 'PRODUCTION_EDITING',
  PRODUCTION: 'PRODUCTION_EDITING', // legacy alias
  MANAGER_FINAL_REVIEW: 'MANAGER_FINAL_REVIEW',
  FINAL_REVISION: 'FINAL_REVISION',
  WAITING_CLIENT_FINAL_APPROVAL: 'WAITING_CLIENT_FINAL_APPROVAL',
  WAITING_PAYMENT: 'WAITING_PAYMENT',
  READY_TO_DOWNLOAD: 'READY_TO_DOWNLOAD',
  COMPLETED: 'COMPLETED',
  ON_HOLD: 'ON_HOLD',
  CANCELED: 'NEW_MANAGER_REVIEW', // percent forced to 0 below
});

/** CustomerFacingStatus → stage (portal when only facing status is known). */
export const CUSTOMER_STATUS_TO_STAGE_KEY = Object.freeze({
  INFO_RECEIVED: 'NEW_MANAGER_REVIEW',
  PREPARING_CONTENT: 'CONTENT_GENERATION',
  WAITING_YOUR_APPROVAL: 'WAITING_CLIENT_CONTENT_APPROVAL',
  IN_PRODUCTION: 'PRODUCTION_EDITING',
  FINAL_REVIEW: 'MANAGER_FINAL_REVIEW',
  WAITING_PAYMENT: 'WAITING_PAYMENT',
  READY_DELIVERY: 'READY_TO_DOWNLOAD',
  COMPLETED: 'COMPLETED',
});

function stageIndexByKey(key) {
  const idx = PROJECT_WORKFLOW_STAGES.findIndex((s) => s.key === key);
  return idx >= 0 ? idx : 0;
}

export function resolveStageKey({ status, customerFacingStatus } = {}) {
  if (status && STATUS_TO_STAGE_KEY[status]) {
    return STATUS_TO_STAGE_KEY[status];
  }
  if (customerFacingStatus && CUSTOMER_STATUS_TO_STAGE_KEY[customerFacingStatus]) {
    return CUSTOMER_STATUS_TO_STAGE_KEY[customerFacingStatus];
  }
  return 'NEW_MANAGER_REVIEW';
}

/**
 * Build a progress snapshot for API / UI.
 * @param {object} opts
 * @param {string} [opts.status] internal ProjectStatus
 * @param {string} [opts.customerFacingStatus]
 * @param {'internal'|'portal'} [opts.audience='internal']
 */
export function buildProjectProgress({
  status,
  customerFacingStatus,
  audience = 'internal',
} = {}) {
  const isCanceled = status === 'CANCELED';
  const stageKey = isCanceled
    ? 'NEW_MANAGER_REVIEW'
    : resolveStageKey({ status, customerFacingStatus });
  const currentIndex = stageIndexByKey(stageKey);
  const stage = PROJECT_WORKFLOW_STAGES[currentIndex];
  const isComplete = stageKey === 'COMPLETED' && !isCanceled;
  const isOnHold = stageKey === 'ON_HOLD' && !isCanceled;

  const percent = isCanceled
    ? 0
    : isComplete
      ? 100
      : stage.progress;

  // Count only "happy-path" milestones for completed/remaining (exclude hold).
  const happyPathStages = PROJECT_WORKFLOW_STAGES.filter((s) => s.key !== 'ON_HOLD');
  const happyIndex = happyPathStages.findIndex((s) => s.key === stageKey);
  const happyTotal = happyPathStages.length;

  const completedCount = isCanceled
    ? 0
    : isComplete
      ? happyTotal
      : isOnHold
        ? 0
        : Math.max(0, happyIndex);

  const remainingCount = isCanceled
    ? happyTotal
    : isComplete
      ? 0
      : isOnHold
        ? happyTotal
        : Math.max(0, happyTotal - completedCount - 1);

  const useCustomerLabels = audience === 'portal';
  let label = useCustomerLabels ? stage.customerLabel : stage.label;
  if (isCanceled) {
    label = useCustomerLabels ? 'لغوشده' : 'لغوشده';
  }

  return {
    percent,
    totalStages: happyTotal,
    completedCount,
    remainingCount,
    currentStage: {
      key: stage.key,
      label,
      index: isOnHold || isCanceled ? 0 : Math.max(1, happyIndex + 1),
    },
    status: status || null,
    customerFacingStatus: customerFacingStatus || null,
    isComplete,
    isCanceled,
    isOnHold,
  };
}

/** Compact attach helper for list/detail serializers. */
export function attachProjectProgress(project, audience = 'internal') {
  if (!project) return project;
  const progress = buildProjectProgress({
    status: project.status,
    customerFacingStatus: project.customerFacingStatus,
    audience,
  });
  return { ...project, progress };
}

export function attachProjectProgressMany(projects, audience = 'internal') {
  return (projects || []).map((p) => attachProjectProgress(p, audience));
}

/** Significant progress = stage key changed (or jumped to completed/canceled). */
export function didProgressStageChange(prevStatus, nextStatus) {
  if (!nextStatus || prevStatus === nextStatus) return false;
  const prevKey = resolveStageKey({ status: prevStatus });
  const nextKey = resolveStageKey({ status: nextStatus });
  return prevKey !== nextKey;
}

export function formatProgressPercent(percent) {
  const n = Math.min(100, Math.max(0, Number(percent) || 0));
  return `${n.toLocaleString('fa-AF', { numberingSystem: 'latn' })}٪`;
}

/** Dari stage-enter messages for customer/staff notifications. */
const STAGE_ENTER_MESSAGES = Object.freeze({
  NEW_MANAGER_REVIEW: 'پروژه شما ثبت شد',
  CONTENT_GENERATION: 'پروژه شما وارد مرحله تولید محتوا شد',
  INTERNAL_CONTENT_REVIEW: 'پروژه شما وارد مرحله بازبینی محتوا شد',
  WAITING_CLIENT_CONTENT_APPROVAL: 'محتوای پروژه برای تأیید شما ارسال شد',
  CONTENT_REVISION: 'پروژه وارد مرحله اصلاح محتوا شد',
  NARRATION_RECORDING: 'پروژه وارد مرحله ضبط نریشن شد',
  PRODUCTION_EDITING: 'پروژه وارد مرحله تولید و ادیت ویدیو شد',
  MANAGER_FINAL_REVIEW: 'پروژه وارد مرحله بازبینی نهایی شد',
  FINAL_REVISION: 'پروژه وارد مرحله اصلاح نهایی شد',
  WAITING_CLIENT_FINAL_APPROVAL: 'ویدیوی نهایی برای تأیید شما ارسال شد',
  WAITING_PAYMENT: 'پروژه در انتظار تسویه پرداخت است',
  READY_TO_DOWNLOAD: 'پروژه آماده دانلود و تحویل است',
  COMPLETED: 'پروژه با موفقیت تکمیل شد',
  ON_HOLD: 'پروژه موقتاً متوقف شد',
});

export function buildProjectStageProgressNotification({
  projectId,
  projectTitle,
  projectCode,
  stageKey,
  percent,
  forPortal = false,
  at = new Date(),
}) {
  const when = formatFaDateTime(at);
  const stage = PROJECT_WORKFLOW_STAGES.find((s) => s.key === stageKey);
  const stageLabel = forPortal
    ? (stage?.customerLabel || stage?.label || 'مرحله جدید')
    : (stage?.label || 'مرحله جدید');
  const bodyMessage =
    STAGE_ENTER_MESSAGES[stageKey]
    || `پروژه وارد مرحله «${stageLabel}» شد`;

  const isComplete = stageKey === 'COMPLETED';
  return {
    eventKey: `project.progress:${projectId}:${stageKey}`,
    title: isComplete ? 'پروژه تکمیل شد' : 'به‌روزرسانی پیشرفت پروژه',
    body: [
      bodyMessage,
      projectTitle ? `پروژه: ${projectTitle}` : null,
      projectCode ? `شناسه: ${projectCode}` : null,
      `پیشرفت: ${formatProgressPercent(percent)}`,
      `مرحله: ${stageLabel}`,
      `تاریخ: ${when}`,
    ]
      .filter(Boolean)
      .join('\n'),
    link: forPortal
      ? `/portal/projects/${projectId}`
      : `/projects/${projectId}`,
    meta: {
      type: isComplete ? 'PROJECT_COMPLETED' : 'PROJECT_PROGRESS',
      projectId,
      projectName: projectTitle || null,
      projectCode: projectCode || null,
      stageKey,
      stageLabel,
      percent,
      createdAt: new Date(at).toISOString(),
    },
  };
}

/**
 * Status transitions that already emit a dedicated customer notification.
 * Progress hook must not create a second portal alert for these events.
 */
const PORTAL_PROGRESS_SKIP_STATUSES = new Set([
  'WAITING_CLIENT_CONTENT_APPROVAL', // content send → buildContentSentForApprovalNotification
]);

/**
 * Notify portal customer (+ managers on completion) when workflow stage advances.
 */
export async function notifyProjectProgressChange(
  db,
  {
    projectId,
    previousStatus,
    nextStatus,
    project: projectHint = null,
  },
) {
  if (!didProgressStageChange(previousStatus, nextStatus)) return null;

  const { createNotificationOnce, notifyManagersOnce } = await import(
    './notifications.js'
  );

  const project =
    projectHint
    || (await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: {
        id: true,
        title: true,
        code: true,
        status: true,
        customerFacingStatus: true,
        portalAccountId: true,
        crmCustomerId: true,
      },
    }));

  if (!project) return null;

  const progress = buildProjectProgress({
    status: nextStatus || project.status,
    customerFacingStatus: project.customerFacingStatus,
    audience: 'portal',
  });

  const payload = buildProjectStageProgressNotification({
    projectId: project.id,
    projectTitle: project.title,
    projectCode: project.code,
    stageKey: progress.currentStage.key,
    percent: progress.percent,
    forPortal: true,
  });

  const results = [];
  const skipPortalProgress = PORTAL_PROGRESS_SKIP_STATUSES.has(nextStatus);

  if (project.portalAccountId && !skipPortalProgress) {
    results.push(
      await createNotificationOnce(
        {
          portalAccountId: project.portalAccountId,
          audience: 'PORTAL',
          ...payload,
        },
        db,
      ),
    );
  }

  if (progress.isComplete) {
    results.push(
      ...(await notifyManagersOnce(
        {
          ...buildProjectStageProgressNotification({
            projectId: project.id,
            projectTitle: project.title,
            projectCode: project.code,
            stageKey: 'COMPLETED',
            percent: 100,
            forPortal: false,
          }),
          eventKey: `project.progress.mgr:${project.id}:COMPLETED`,
        },
        db,
      )),
    );
  }

  return { progress, results };
}
