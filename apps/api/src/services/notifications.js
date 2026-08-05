import { prisma } from '../db/prisma.js';
import { formatFaDateTime } from '../modules/portal/helpers.js';

/** In-process gate so concurrent identical eventKeys cannot double-insert. */
const inFlightByKey = new Map();

function recipientLockKey(eventKey, userId, portalAccountId) {
  return `${eventKey}::${userId || ''}::${portalAccountId || ''}`;
}

/**
 * Idempotent notification create.
 * Skips insert when the same recipient already has this eventKey.
 * Concurrent callers for the same key share one create attempt.
 */
export async function createNotificationOnce(
  {
    userId = null,
    portalAccountId = null,
    audience = 'INTERNAL',
    title,
    body = null,
    link = null,
    meta = {},
    eventKey,
  },
  tx = prisma,
) {
  if (!eventKey) {
    throw new Error('eventKey is required for idempotent notifications');
  }

  const lockKey = recipientLockKey(eventKey, userId, portalAccountId);
  const existingFlight = inFlightByKey.get(lockKey);
  if (existingFlight) return existingFlight;

  const work = (async () => {
    const recipientFilter = userId
      ? { userId }
      : { portalAccountId };

    const existing = await tx.notification.findFirst({
      where: {
        ...recipientFilter,
        meta: { path: ['eventKey'], equals: eventKey },
      },
      select: { id: true },
    });

    if (existing) return { created: false, id: existing.id };

    const row = await tx.notification.create({
      data: {
        userId,
        portalAccountId,
        audience,
        title,
        body,
        link,
        meta: { ...meta, eventKey },
      },
    });

    return { created: true, id: row.id };
  })();

  inFlightByKey.set(lockKey, work);
  try {
    return await work;
  } finally {
    if (inFlightByKey.get(lockKey) === work) {
      inFlightByKey.delete(lockKey);
    }
  }
}

/** Notify all active managers once per eventKey. */
export async function notifyManagersOnce(payload, tx = prisma) {
  const managers = await tx.user.findMany({
    where: { role: { code: { in: ['MANAGER', 'ADMIN'] } }, isActive: true, deletedAt: null },
    select: { id: true },
  });

  const results = [];
  for (const mgr of managers) {
    results.push(
      await createNotificationOnce(
        {
          ...payload,
          userId: mgr.id,
          audience: 'INTERNAL',
          eventKey: `${payload.eventKey}:user:${mgr.id}`,
        },
        tx,
      ),
    );
  }
  return results;
}

export function buildProjectCreatedNotification({
  projectId,
  projectCode,
  projectTitle,
  customerName,
  createdAt = new Date(),
}) {
  const createdLabel = formatFaDateTime(createdAt);
  return {
    eventKey: `project.created:${projectId}`,
    title: 'پروژه جدید ایجاد گردید',
    body: [
      `مشتری: ${customerName}`,
      `پروژه: ${projectTitle}`,
      `شناسه: ${projectCode}`,
      `تاریخ: ${createdLabel}`,
      'وضعیت: منتظر بررسی',
    ].join('\n'),
    link: `/projects/${projectId}`,
    meta: {
      type: 'PROJECT_CREATED',
      projectId,
      projectCode,
      projectName: projectTitle,
      customerName,
      status: 'NEW_MANAGER_REVIEW',
      statusLabel: 'منتظر بررسی',
      createdAt: createdAt.toISOString(),
    },
  };
}

export function buildLeadCreatedNotification({ customerId, personName, phone }) {
  return {
    eventKey: `lead.created:${customerId}`,
    title: 'سرنخ جدید',
    body: `${personName}${phone ? ` — ${phone}` : ''}`,
    link: `/crm/${customerId}`,
    meta: {
      type: 'LEAD_CREATED',
      customerId,
      customerName: personName,
      phone: phone || null,
    },
  };
}

export function buildContentSentForApprovalNotification({
  projectId,
  projectTitle,
  projectCode,
  versionNumber,
  sentAt = new Date(),
}) {
  // Stable per project+version so retries / double-clicks cannot spam the portal.
  return {
    eventKey: `content.sent:${projectId}:v${versionNumber}`,
    title: 'مدیر اطلاعات پروژه را ارسال کرد',
    body: null,
    link: `/portal/projects/${projectId}?tab=approval`,
    meta: {
      type: 'CONTENT_SENT_FOR_APPROVAL',
      projectId,
      projectName: projectTitle,
      projectCode,
      versionNumber,
      actionType: 'SENT_FOR_APPROVAL',
      createdAt: sentAt.toISOString(),
    },
  };
}

export function buildContentApprovedByCustomerNotification({
  projectId,
  projectTitle,
  projectCode,
  versionNumber,
  approvedAt = new Date(),
}) {
  const when = formatFaDateTime(approvedAt);
  return {
    eventKey: `content.approved:${projectId}:v${versionNumber}:${approvedAt.toISOString()}`,
    title: `مشتری نسخه ${versionNumber} را تأیید کرد`,
    body: [
      `پروژه: ${projectTitle}`,
      projectCode ? `شناسه: ${projectCode}` : null,
      `نسخه: ${versionNumber}`,
      `تاریخ: ${when}`,
    ]
      .filter(Boolean)
      .join('\n'),
    link: `/projects/${projectId}?tab=narration`,
    meta: {
      type: 'CONTENT_APPROVED_BY_CUSTOMER',
      projectId,
      projectName: projectTitle,
      projectCode,
      versionNumber,
      actionType: 'CUSTOMER_APPROVED',
      createdAt: approvedAt.toISOString(),
    },
  };
}

export function buildContentRevisionRequestedNotification({
  projectId,
  projectTitle,
  projectCode,
  versionNumber,
  feedbackPreview,
  requestedAt = new Date(),
}) {
  const when = formatFaDateTime(requestedAt);
  const preview = feedbackPreview
    ? feedbackPreview.length > 120
      ? `${feedbackPreview.slice(0, 120)}…`
      : feedbackPreview
    : null;
  return {
    eventKey: `content.revision:${projectId}:v${versionNumber}:${requestedAt.toISOString()}`,
    title: `مشتری برای نسخه ${versionNumber} درخواست اصلاح داد`,
    body: [
      `پروژه: ${projectTitle}`,
      projectCode ? `شناسه: ${projectCode}` : null,
      `نسخه: ${versionNumber}`,
      preview ? `بازخورد: ${preview}` : null,
      `تاریخ: ${when}`,
    ]
      .filter(Boolean)
      .join('\n'),
    link: `/projects/${projectId}?tab=ai&panel=feedback`,
    meta: {
      type: 'CONTENT_REVISION_REQUESTED',
      projectId,
      projectName: projectTitle,
      projectCode,
      versionNumber,
      actionType: 'REVISION_REQUESTED',
      createdAt: requestedAt.toISOString(),
    },
  };
}

export function buildNarrationAssignedNotification({
  projectId,
  projectTitle,
  projectCode,
  deadline,
  assignedAt = new Date(),
}) {
  const when = formatFaDateTime(assignedAt);
  const deadlineLabel = deadline ? formatFaDateTime(deadline) : null;
  return {
    eventKey: `narration.assigned:${projectId}:${assignedAt.toISOString()}`,
    title: 'نریشن جدید به شما داده شد',
    body: [
      `پروژه: ${projectTitle}`,
      projectCode ? `شناسه: ${projectCode}` : null,
      deadlineLabel ? `مهلت: ${deadlineLabel}` : null,
      `تاریخ ارسال: ${when}`,
    ]
      .filter(Boolean)
      .join('\n'),
    link: `/narrator/tasks/${projectId}`,
    meta: {
      type: 'NARRATION_ASSIGNED',
      projectId,
      projectName: projectTitle,
      projectCode,
      actionType: 'NARRATION_ASSIGNED',
      createdAt: assignedAt.toISOString(),
    },
  };
}

export function buildNarrationDeadlineReminderNotification({
  projectId,
  projectTitle,
  projectCode,
  deadline,
  dayKey,
}) {
  const deadlineLabel = deadline ? formatFaDateTime(deadline) : '—';
  return {
    eventKey: `narration.deadline:${projectId}:${dayKey}`,
    title: 'مهلت ارسال نریشن نزدیک است',
    body: [
      `پروژه: ${projectTitle}`,
      projectCode ? `شناسه: ${projectCode}` : null,
      `مهلت: ${deadlineLabel}`,
    ]
      .filter(Boolean)
      .join('\n'),
    link: `/narrator/tasks/${projectId}`,
    meta: {
      type: 'NARRATION_DEADLINE_REMINDER',
      projectId,
      projectName: projectTitle,
      projectCode,
      actionType: 'DEADLINE_REMINDER',
      createdAt: new Date().toISOString(),
    },
  };
}

export function buildNarrationUploadedNotification({
  projectId,
  projectTitle,
  projectCode,
  narratorName,
  uploadedAt = new Date(),
}) {
  const when = formatFaDateTime(uploadedAt);
  return {
    eventKey: `narration.uploaded:${projectId}:${uploadedAt.toISOString()}`,
    title: 'نریشن صوتی آپلود شد',
    body: [
      `پروژه: ${projectTitle}`,
      projectCode ? `شناسه: ${projectCode}` : null,
      narratorName ? `نریتور: ${narratorName}` : null,
      `تاریخ: ${when}`,
    ]
      .filter(Boolean)
      .join('\n'),
    link: `/projects/${projectId}?tab=narration`,
    meta: {
      type: 'NARRATION_UPLOADED',
      projectId,
      projectName: projectTitle,
      projectCode,
      actionType: 'NARRATION_UPLOADED',
      createdAt: uploadedAt.toISOString(),
    },
  };
}

export function buildNarrationApprovedNotification({
  projectId,
  projectTitle,
  projectCode,
  approvedAt = new Date(),
}) {
  const when = formatFaDateTime(approvedAt);
  return {
    eventKey: `narration.approved:${projectId}:${approvedAt.toISOString()}`,
    title: 'نریشن صوتی تأیید شد',
    body: [
      `پروژه: ${projectTitle}`,
      projectCode ? `شناسه: ${projectCode}` : null,
      `تاریخ: ${when}`,
    ]
      .filter(Boolean)
      .join('\n'),
    link: `/narrator/tasks/${projectId}`,
    meta: {
      type: 'NARRATION_APPROVED',
      projectId,
      projectName: projectTitle,
      projectCode,
      actionType: 'NARRATION_APPROVED',
      createdAt: approvedAt.toISOString(),
    },
  };
}

export function buildNarrationRevisionRequestedNotification({
  projectId,
  projectTitle,
  projectCode,
  notes,
  requestedAt = new Date(),
}) {
  const when = formatFaDateTime(requestedAt);
  const preview = notes
    ? notes.length > 120
      ? `${notes.slice(0, 120)}…`
      : notes
    : null;
  return {
    eventKey: `narration.revision:${projectId}:${requestedAt.toISOString()}`,
    title: 'درخواست اصلاح نریشن',
    body: [
      `پروژه: ${projectTitle}`,
      projectCode ? `شناسه: ${projectCode}` : null,
      preview ? `توضیحات: ${preview}` : null,
      `تاریخ: ${when}`,
    ]
      .filter(Boolean)
      .join('\n'),
    link: `/narrator/tasks/${projectId}`,
    meta: {
      type: 'NARRATION_REVISION_REQUESTED',
      projectId,
      projectName: projectTitle,
      projectCode,
      actionType: 'NARRATION_REVISION_REQUESTED',
      createdAt: requestedAt.toISOString(),
    },
  };
}

export function buildEditingAssignedNotification({
  projectId,
  projectTitle,
  projectCode,
  deadline,
  assignedAt = new Date(),
}) {
  const when = formatFaDateTime(assignedAt);
  const deadlineLabel = deadline ? formatFaDateTime(deadline) : null;
  return {
    eventKey: `editing.assigned:${projectId}:${assignedAt.toISOString()}`,
    title: 'پروژه جدید توسط مدیر برای شما ارسال شد',
    body: [
      `پروژه جدید برای ادیت ارجاع شد: ${projectTitle}`,
      projectCode ? `شناسه: ${projectCode}` : null,
      deadlineLabel ? `مهلت: ${deadlineLabel}` : null,
      `تاریخ ارجاع: ${when}`,
    ]
      .filter(Boolean)
      .join('\n'),
    link: `/editor/tasks/${projectId}`,
    meta: {
      type: 'EDITING_ASSIGNED',
      projectId,
      projectName: projectTitle,
      projectCode,
      actionType: 'EDITING_ASSIGNED',
      createdAt: assignedAt.toISOString(),
    },
  };
}

export function buildEditingSubmittedNotification({
  projectId,
  projectTitle,
  projectCode,
  version,
  editorName,
  videoTypeLabel,
  submittedAt = new Date(),
}) {
  const when = formatFaDateTime(submittedAt);
  const editor = editorName || 'ادیتور';
  const typePart = videoTypeLabel ? ` (${videoTypeLabel})` : '';
  return {
    eventKey: `editing.submitted:${projectId}:v${version}:${submittedAt.toISOString()}`,
    title: 'ویدیوی نهایی آپلود شد',
    body: [
      `ادیتور ${editor} نسخه نهایی پروژه «${projectTitle}»${typePart} را آپلود کرد.`,
      projectCode ? `شناسه: ${projectCode}` : null,
      version ? `نسخه: ${version}` : null,
      `تاریخ: ${when}`,
    ]
      .filter(Boolean)
      .join('\n'),
    link: `/projects/${projectId}?tab=production&workspace=final`,
    meta: {
      type: 'EDITING_SUBMITTED',
      projectId,
      projectName: projectTitle,
      projectCode,
      version,
      editorName: editor,
      videoTypeLabel: videoTypeLabel || null,
      actionType: 'EDITING_SUBMITTED',
      createdAt: submittedAt.toISOString(),
    },
  };
}

/** Manager: a single final video file was uploaded by an editor. */
export function buildFinalVideoUploadedNotification({
  projectId,
  projectTitle,
  projectCode,
  editorName,
  videoType,
  videoTypeLabel,
  fileId,
  version,
  uploadedAt = new Date(),
}) {
  const when = formatFaDateTime(uploadedAt);
  const editor = editorName || 'ادیتور';
  const label = videoTypeLabel || (videoType === 'CLEAN' ? 'بدون واترمارک' : 'دارای واترمارک');
  return {
    eventKey: `final.uploaded:${projectId}:${fileId || uploadedAt.toISOString()}`,
    title: 'ویدیوی نهایی پروژه آپلود شد',
    body: [
      `ادیتور ${editor} نسخه نهایی پروژه «${projectTitle}» را آپلود کرد.`,
      `نوع: ${label}`,
      projectCode ? `شناسه: ${projectCode}` : null,
      version ? `نسخه: ${version}` : null,
      `تاریخ: ${when}`,
    ]
      .filter(Boolean)
      .join('\n'),
    link: `/projects/${projectId}?tab=production&workspace=final`,
    meta: {
      type: 'FINAL_VIDEO_UPLOADED',
      projectId,
      projectName: projectTitle,
      projectCode,
      editorName: editor,
      videoType: videoType || null,
      videoTypeLabel: label,
      fileId: fileId || null,
      version: version || null,
      actionType: 'FINAL_VIDEO_UPLOADED',
      createdAt: uploadedAt.toISOString(),
    },
  };
}

/** Editor: confirmation after successful final upload. */
export function buildFinalVideoUploadConfirmedNotification({
  projectId,
  projectTitle,
  projectCode,
  videoTypeLabel,
  uploadedAt = new Date(),
}) {
  const when = formatFaDateTime(uploadedAt);
  return {
    eventKey: `final.upload_confirmed:${projectId}:${videoTypeLabel || 'all'}:${uploadedAt.toISOString()}`,
    title: 'آپلود ویدیوی نهایی ثبت شد',
    body: [
      `ویدیوی نهایی پروژه «${projectTitle}» با موفقیت آپلود شد.`,
      videoTypeLabel ? `نوع: ${videoTypeLabel}` : null,
      projectCode ? `شناسه: ${projectCode}` : null,
      `تاریخ: ${when}`,
    ]
      .filter(Boolean)
      .join('\n'),
    link: `/editor/tasks/${projectId}`,
    meta: {
      type: 'FINAL_VIDEO_UPLOAD_CONFIRMED',
      projectId,
      projectName: projectTitle,
      projectCode,
      videoTypeLabel: videoTypeLabel || null,
      actionType: 'FINAL_VIDEO_UPLOAD_CONFIRMED',
      createdAt: uploadedAt.toISOString(),
    },
  };
}

export function buildEditingRevisionRequestedNotification({
  projectId,
  projectTitle,
  projectCode,
  notes,
  source = 'MANAGER',
  requestedAt = new Date(),
}) {
  const when = formatFaDateTime(requestedAt);
  const preview = notes
    ? notes.length > 120
      ? `${notes.slice(0, 120)}…`
      : notes
    : null;
  const from = source === 'CUSTOMER' ? 'مشتری' : 'مدیر';
  return {
    eventKey: `editing.revision:${projectId}:${source}:${requestedAt.toISOString()}`,
    title: 'درخواست اصلاح ویدیو',
    body: [
      `${from} اصلاح ویدیو برای پروژه «${projectTitle}» را درخواست کرد.`,
      projectCode ? `شناسه: ${projectCode}` : null,
      preview ? `توضیحات: ${preview}` : null,
      `تاریخ: ${when}`,
    ]
      .filter(Boolean)
      .join('\n'),
    link: `/editor/tasks/${projectId}`,
    meta: {
      type: 'EDITING_REVISION_REQUESTED',
      projectId,
      projectName: projectTitle,
      projectCode,
      source,
      actionType: 'EDITING_REVISION_REQUESTED',
      createdAt: requestedAt.toISOString(),
    },
  };
}

export function buildEditingManagerFeedbackNotification({
  projectId,
  projectTitle,
  projectCode,
  notes,
  at = new Date(),
}) {
  const when = formatFaDateTime(at);
  const preview = notes
    ? notes.length > 160
      ? `${notes.slice(0, 160)}…`
      : notes
    : 'بدون توضیح اضافی';
  return {
    eventKey: `editing.manager_feedback:${projectId}:${at.toISOString()}`,
    title: 'بازخورد مدیر روی ادیت',
    body: [
      `پروژه: ${projectTitle}`,
      projectCode ? `شناسه: ${projectCode}` : null,
      `بازخورد: ${preview}`,
      `تاریخ: ${when}`,
    ]
      .filter(Boolean)
      .join('\n'),
    link: `/editor/tasks/${projectId}`,
    meta: {
      type: 'EDITING_MANAGER_FEEDBACK',
      projectId,
      projectName: projectTitle,
      projectCode,
      actionType: 'EDITING_MANAGER_FEEDBACK',
      createdAt: at.toISOString(),
    },
  };
}

export function buildEditingReadyForCustomerNotification({
  projectId,
  projectTitle,
  projectCode,
  at = new Date(),
}) {
  const when = formatFaDateTime(at);
  return {
    eventKey: `editing.ready_customer:${projectId}:${at.toISOString()}`,
    title: 'ویدیوی نهایی پروژه شما آماده مشاهده است',
    body: [
      `مدیر پروژه یک ویدیوی نهایی جدید برای پروژه «${projectTitle}» ارسال کرده است.`,
      projectCode ? `شناسه: ${projectCode}` : null,
      `تاریخ: ${when}`,
      'می‌توانید مشاهده کنید، تأیید کنید یا درخواست اصلاح بدهید.',
    ]
      .filter(Boolean)
      .join('\n'),
    link: `/portal/projects/${projectId}?tab=final`,
    meta: {
      type: 'EDITING_READY_FOR_CUSTOMER',
      projectId,
      projectName: projectTitle,
      projectCode,
      actionType: 'EDITING_READY_FOR_CUSTOMER',
      createdAt: at.toISOString(),
    },
  };
}

export function buildEditingCompletedNotification({
  projectId,
  projectTitle,
  projectCode,
  customerName,
  forEditor = false,
  at = new Date(),
}) {
  const when = formatFaDateTime(at);
  const name = (customerName || '').trim() || 'مشتری';
  return {
    // Stable key — one completion notice per project per audience role.
    eventKey: `project.completed.clean-approval:${projectId}:${forEditor ? 'editor' : 'mgr'}`,
    title: 'مشتری نسخه نهایی پروژه را تایید کرد و پروژه تکمیل شد',
    body: [
      `${name} نسخه بدون واترمارک پروژه «${projectTitle}» را تأیید کرد.`,
      projectCode ? `شناسه: ${projectCode}` : null,
      `تاریخ تکمیل: ${when}`,
    ]
      .filter(Boolean)
      .join('\n'),
    link: forEditor
      ? `/editor/tasks/${projectId}`
      : `/projects/${projectId}?tab=production&workspace=final`,
    meta: {
      type: 'PROJECT_COMPLETED_BY_CUSTOMER',
      projectId,
      projectName: projectTitle,
      projectCode,
      customerName: name,
      actionType: 'CLEAN_FINAL_APPROVED',
      createdAt: at.toISOString(),
    },
  };
}

export function recipientWhere(auth) {
  return auth.audience === 'PORTAL'
    ? { portalAccountId: auth.portalAccountId }
    : { userId: auth.userId };
}
