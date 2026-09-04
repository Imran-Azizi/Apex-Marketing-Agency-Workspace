/** Final product (محصول نهایی) helpers — status lives on ProjectFile.meta */

export const FINAL_VIDEO_STATUSES = [
  'DRAFT',
  'UPLOADED',
  'PENDING_REVIEW',
  'REVISION_REQUESTED',
  'APPROVED',
  'SENT_TO_CUSTOMER',
  'VIEWED_BY_CUSTOMER',
  'APPROVED_BY_CUSTOMER',
];

export const VIDEO_TYPE_LABELS = {
  WATERMARKED: 'نسخه دارای واترمارک',
  CLEAN: 'نسخه بدون واترمارک',
};

export const STATUS_LABELS = {
  DRAFT: 'پیش‌نویس',
  UPLOADED: 'در انتظار بررسی',
  PENDING_REVIEW: 'در انتظار بررسی',
  REVISION_REQUESTED: 'نیازمند اصلاح',
  APPROVED: 'تأیید شده',
  SENT_TO_CUSTOMER: 'ارسال‌شده برای مشتری',
  VIEWED_BY_CUSTOMER: 'مشاهده‌شده توسط مشتری',
  APPROVED_BY_CUSTOMER: 'ویدیو تایید شد',
};

/** Per-file delivery grouping for manager/editor/portal workflows. */
export const DELIVERY_STATES = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  AWAITING_DELIVERY: 'AWAITING_DELIVERY',
  REVISION: 'REVISION',
  SENT: 'SENT',
};

export const DELIVERY_STATE_LABELS = {
  PENDING_REVIEW: 'ویدیوی جدید — در انتظار بررسی',
  AWAITING_DELIVERY: 'آماده ارسال به مشتری',
  REVISION: 'نیازمند اصلاح',
  SENT: 'ارسال‌شده به مشتری',
};

/** Project statuses that must not be rolled back when extra videos are uploaded or sent. */
export const PRESERVE_PROJECT_STATUSES = [
  'WAITING_CLIENT_FINAL_APPROVAL',
  'WAITING_PAYMENT',
  'READY_TO_DOWNLOAD',
  'COMPLETED',
];

const CLIENT_VISIBLE_PROJECT_STATUSES = [
  'WAITING_CLIENT_FINAL_APPROVAL',
  'WAITING_PAYMENT',
  'READY_TO_DOWNLOAD',
  'COMPLETED',
];

/** Statuses that must not be downgraded back to SENT_TO_CUSTOMER when serializing. */
const POST_SEND_STATUSES = new Set(['VIEWED_BY_CUSTOMER', 'APPROVED_BY_CUSTOMER']);

export function asMeta(meta) {
  return meta && typeof meta === 'object' && !Array.isArray(meta) ? { ...meta } : {};
}

export function resolveVideoType(kind, meta = {}) {
  if (meta.videoType === 'WATERMARKED' || meta.videoType === 'CLEAN') return meta.videoType;
  if (kind === 'WATERMARKED_FINAL') return 'WATERMARKED';
  if (kind === 'CLEAN_FINAL') return 'CLEAN';
  return null;
}

export function resolveVideoStatus(meta = {}) {
  const status = meta.status;
  if (FINAL_VIDEO_STATUSES.includes(status)) return status;
  if (meta.customerApprovedAt || meta.approvedByCustomer === true) {
    return 'APPROVED_BY_CUSTOMER';
  }
  if (meta.sentToCustomer) return 'SENT_TO_CUSTOMER';
  return 'UPLOADED';
}

export function isSentToCustomer(file, projectStatus) {
  const meta = asMeta(file.meta);
  if (meta.sentToCustomer === true) return true;
  if (meta.sentToCustomer === false) return false;
  // Legacy: manager approved the whole package before per-file flags existed
  return (
    file.kind === 'WATERMARKED_FINAL' &&
    CLIENT_VISIBLE_PROJECT_STATUSES.includes(projectStatus)
  );
}

/** True only when this file was actually released — never inferred from project status. */
export function wasExplicitlySent(file) {
  const meta = asMeta(file.meta);
  if (meta.sentToCustomer === true) return true;
  const status = resolveVideoStatus(meta);
  return (
    status === 'SENT_TO_CUSTOMER' ||
    POST_SEND_STATUSES.has(status)
  );
}

export function isAlreadyDelivered(file, projectStatus) {
  return wasExplicitlySent(file) || isSentToCustomer(file, projectStatus);
}

export function shouldPreserveProjectStatus(status) {
  return PRESERVE_PROJECT_STATUSES.includes(status);
}

export function projectStatusPatchAfterSend(currentStatus) {
  if (shouldPreserveProjectStatus(currentStatus)) return null;
  return {
    status: 'WAITING_CLIENT_FINAL_APPROVAL',
    customerFacingStatus: 'WAITING_YOUR_APPROVAL',
  };
}

export function resolveDeliveryState(file, projectStatus) {
  const meta = asMeta(file.meta);
  const raw = resolveVideoStatus(meta);
  if (isAlreadyDelivered(file, projectStatus) || POST_SEND_STATUSES.has(raw) || raw === 'SENT_TO_CUSTOMER') {
    return DELIVERY_STATES.SENT;
  }
  if (raw === 'REVISION_REQUESTED') return DELIVERY_STATES.REVISION;
  if (raw === 'APPROVED') return DELIVERY_STATES.AWAITING_DELIVERY;
  return DELIVERY_STATES.PENDING_REVIEW;
}

/**
 * Portal "جدید" badge — only for videos the manager explicitly released
 * and the customer has not opened yet.
 */
export function isNewForCustomer(file, projectStatus) {
  if (!isSentToCustomer(file, projectStatus)) return false;
  const meta = asMeta(file.meta);
  if (meta.sentToCustomer !== true && !meta.sentAt) return false;
  if (meta.viewedAt) return false;
  const status = resolveVideoStatus(meta);
  if (POST_SEND_STATUSES.has(status)) return false;
  return true;
}

export function isCustomerApprovedFile(file) {
  const meta = asMeta(file.meta);
  const status = resolveVideoStatus(meta);
  return (
    status === 'APPROVED_BY_CUSTOMER' ||
    meta.approvedByCustomer === true ||
    !!meta.customerApprovedAt
  );
}

export function sentToCustomerFiles(files, projectStatus) {
  return (files || []).filter((f) => isSentToCustomer(f, projectStatus));
}

/** True when every manager-sent video has been accepted by the customer. */
export function allSentFilesCustomerApproved(files, projectStatus) {
  const sent = sentToCustomerFiles(files, projectStatus);
  if (!sent.length) return false;
  return sent.every((f) => isCustomerApprovedFile(f));
}

function portalSortTimestamp(file) {
  const meta = asMeta(file.meta);
  const raw = meta.sentAt || file.createdAt;
  const ms = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

/** Newly sent videos first, then most recently sent; stable version tie-break. */
export function sortPortalFinalVideos(files, projectStatus) {
  return [...files].sort((a, b) => {
    const aNew = isNewForCustomer(a, projectStatus);
    const bNew = isNewForCustomer(b, projectStatus);
    if (aNew !== bNew) return aNew ? -1 : 1;
    const sentCmp = portalSortTimestamp(b) - portalSortTimestamp(a);
    if (sentCmp !== 0) return sentCmp;
    return (b.version || 0) - (a.version || 0);
  });
}

export function serializeFinalVideo(file, {
  projectStatus,
  uploaderName,
  sentByName,
  customerApproved = false,
} = {}) {
  const meta = asMeta(file.meta);
  const videoType = resolveVideoType(file.kind, meta);
  const rawStatus = resolveVideoStatus(meta);
  const sent = isSentToCustomer(file, projectStatus);
  const deliveryState = resolveDeliveryState(file, projectStatus);

  let status =
    sent && !POST_SEND_STATUSES.has(rawStatus) ? 'SENT_TO_CUSTOMER' : rawStatus;

  // Customer confirmation is per delivered file — never paint unsent uploads as approved.
  const fileCustomerApproved =
    rawStatus === 'APPROVED_BY_CUSTOMER' ||
    meta.approvedByCustomer === true ||
    !!meta.customerApprovedAt;
  const treatAsCustomerApproved = sent && (customerApproved === true || fileCustomerApproved);

  if (treatAsCustomerApproved) {
    if (file.kind === 'WATERMARKED_FINAL' || videoType === 'WATERMARKED') {
      status = 'APPROVED_BY_CUSTOMER';
    } else if (file.kind === 'CLEAN_FINAL' && sent) {
      status = 'APPROVED_BY_CUSTOMER';
    }
  }

  return {
    id: file.id,
    name: file.name,
    kind: file.kind,
    videoType,
    videoTypeLabel: VIDEO_TYPE_LABELS[videoType] || videoType,
    status,
    statusLabel: STATUS_LABELS[status] || status,
    deliveryState,
    deliveryStateLabel: DELIVERY_STATE_LABELS[deliveryState] || deliveryState,
    isNew: deliveryState === DELIVERY_STATES.PENDING_REVIEW,
    awaitingDelivery: deliveryState === DELIVERY_STATES.AWAITING_DELIVERY,
    alreadySent: deliveryState === DELIVERY_STATES.SENT,
    version: file.version,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    storageKey: file.storageKey,
    uploadedBy: file.uploadedBy || null,
    uploadedByName: uploaderName || null,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    sentToCustomer: sent,
    sentAt: meta.sentAt || null,
    sentBy: meta.sentBy || null,
    sentByName: sentByName || null,
    allowDownload: meta.allowDownload === true,
    approvedAt: meta.approvedAt || null,
    revisionNotes: meta.revisionNotes || null,
    revisionRequestedAt: meta.revisionRequestedAt || null,
    reviewedBy: meta.reviewedBy || null,
    viewedAt: meta.viewedAt || null,
    isNewForCustomer: sent ? isNewForCustomer(file, projectStatus) : false,
    customerApprovedAt: sent ? (meta.customerApprovedAt || null) : null,
    meta,
  };
}

export function buildFinalFileMeta({
  videoType,
  status = 'UPLOADED',
  previous = {},
  extras = {},
}) {
  return {
    ...asMeta(previous),
    purpose: videoType === 'CLEAN' ? 'final_delivery' : 'customer_review',
    videoType,
    status,
    hiddenFromCustomer: videoType === 'CLEAN' ? true : previous.hiddenFromCustomer === true,
    sentToCustomer: previous.sentToCustomer === true,
    allowDownload: previous.allowDownload === true,
    ...extras,
  };
}

export function markSentMeta(meta, { allowDownload = false, sentAt = new Date(), sentBy = null } = {}) {
  const current = asMeta(meta);
  return {
    ...current,
    status: 'SENT_TO_CUSTOMER',
    sentToCustomer: true,
    sentAt: sentAt.toISOString(),
    sentBy: sentBy || current.sentBy || null,
    allowDownload: Boolean(allowDownload),
    hiddenFromCustomer: false,
  };
}

export function markApprovedMeta(meta, approvedAt = new Date()) {
  const current = asMeta(meta);
  return {
    ...current,
    status: current.sentToCustomer ? 'SENT_TO_CUSTOMER' : 'APPROVED',
    approvedAt: approvedAt.toISOString(),
    revisionNotes: null,
    revisionRequestedAt: null,
  };
}

export function markRevisionRequestedMeta(
  meta,
  { notes, requestedAt = new Date(), reviewedBy = null } = {},
) {
  return {
    ...asMeta(meta),
    status: 'REVISION_REQUESTED',
    revisionNotes: String(notes || '').trim(),
    revisionRequestedAt: requestedAt.toISOString(),
    reviewedBy,
    approvedAt: null,
  };
}

export function markViewedMeta(meta, viewedAt = new Date()) {
  return {
    ...asMeta(meta),
    status: 'VIEWED_BY_CUSTOMER',
    viewedAt: viewedAt.toISOString(),
  };
}

/** Customer accepted the final product — keep sent flags, upgrade status label. */
export function markCustomerApprovedMeta(meta, approvedAt = new Date()) {
  const current = asMeta(meta);
  return {
    ...current,
    status: 'APPROVED_BY_CUSTOMER',
    approvedByCustomer: true,
    customerApprovedAt: approvedAt.toISOString(),
    sentToCustomer: true,
    hiddenFromCustomer: false,
  };
}

/**
 * Mark final videos as approved by the customer (manager panel status).
 * Always upgrades watermarked cards; upgrades clean only when already sent.
 * @returns {Promise<number>} number of files updated
 */
export async function markSentFinalsApprovedByCustomer(db, projectId, {
  approvedAt = new Date(),
} = {}) {
  const files = await db.projectFile.findMany({
    where: {
      projectId,
      kind: { in: ['WATERMARKED_FINAL', 'CLEAN_FINAL'] },
      deletedAt: null,
    },
  });

  let updated = 0;
  for (const file of files) {
    const meta = asMeta(file.meta);
    const isWatermarked = file.kind === 'WATERMARKED_FINAL';
    const cleanWasSent =
      file.kind === 'CLEAN_FINAL' &&
      (meta.sentToCustomer === true ||
        meta.status === 'SENT_TO_CUSTOMER' ||
        meta.status === 'VIEWED_BY_CUSTOMER' ||
        meta.status === 'APPROVED_BY_CUSTOMER');

    // Newly uploaded files are stored with sentToCustomer: false and must
    // stay pending until a manager explicitly releases them.
    if (meta.sentToCustomer === false) continue;
    if (!isWatermarked && !cleanWasSent) continue;

    const nextMeta = markCustomerApprovedMeta(file.meta, approvedAt);
    // Force Prisma to persist Json changes even when object shape looks similar.
    await db.projectFile.update({
      where: { id: file.id },
      data: { meta: nextMeta },
    });
    updated += 1;
  }
  return updated;
}
