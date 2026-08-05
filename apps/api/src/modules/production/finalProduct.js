/** Final product (محصول نهایی) helpers — status lives on ProjectFile.meta */

export const FINAL_VIDEO_STATUSES = [
  'DRAFT',
  'UPLOADED',
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
  UPLOADED: 'آپلود شده',
  APPROVED: 'تأیید شده',
  SENT_TO_CUSTOMER: 'ارسال‌شده برای مشتری',
  VIEWED_BY_CUSTOMER: 'مشاهده‌شده توسط مشتری',
  APPROVED_BY_CUSTOMER: 'ویدیو تایید شد',
};

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

export function serializeFinalVideo(file, { projectStatus, uploaderName, customerApproved = false } = {}) {
  const meta = asMeta(file.meta);
  const videoType = resolveVideoType(file.kind, meta);
  const rawStatus = resolveVideoStatus(meta);
  const sent = isSentToCustomer(file, projectStatus);

  let status =
    sent && !POST_SEND_STATUSES.has(rawStatus) ? 'SENT_TO_CUSTOMER' : rawStatus;

  // Customer confirmed final product → watermarked (and sent clean) show as approved.
  const treatAsCustomerApproved =
    customerApproved === true ||
    rawStatus === 'APPROVED_BY_CUSTOMER' ||
    meta.approvedByCustomer === true ||
    !!meta.customerApprovedAt;

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
    version: file.version,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    storageKey: file.storageKey,
    uploadedBy: file.uploadedBy || null,
    uploadedByName: uploaderName || null,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    sentToCustomer: sent || status === 'APPROVED_BY_CUSTOMER',
    sentAt: meta.sentAt || null,
    allowDownload: meta.allowDownload === true,
    approvedAt: meta.approvedAt || null,
    viewedAt: meta.viewedAt || null,
    customerApprovedAt: meta.customerApprovedAt || null,
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

export function markSentMeta(meta, { allowDownload = false, sentAt = new Date() } = {}) {
  return {
    ...asMeta(meta),
    status: 'SENT_TO_CUSTOMER',
    sentToCustomer: true,
    sentAt: sentAt.toISOString(),
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
