/** Project poster (اپلود پوستر) workflow helpers */

export const POSTER_STATUSES = [
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "SENT_TO_CUSTOMER",
];

export const POSTER_STATUS_LABELS = {
  PENDING_REVIEW: "در انتظار تایید مدیریت",
  APPROVED: "تایید شده",
  REJECTED: "رد شده",
  SENT_TO_CUSTOMER: "ارسال شده به مشتری",
};

export const ACCEPTED_POSTER_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

export function isAcceptedPosterMime(mimeType, filename) {
  const mime = String(mimeType || "").toLowerCase();
  if (ACCEPTED_POSTER_MIMES.includes(mime) || mime.startsWith("image/")) {
    return true;
  }
  const name = String(filename || "").toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].some((ext) =>
    name.endsWith(ext),
  );
}

function userName(user) {
  return user?.fullName || null;
}

export function serializePoster(row, { forCustomer = false } = {}) {
  const file = row.file || {};
  const status = POSTER_STATUSES.includes(row.status)
    ? row.status
    : "PENDING_REVIEW";

  const publicFields = {
    id: row.id,
    projectId: row.projectId,
    crmCustomerId: row.crmCustomerId,
    fileId: row.fileId,
    version: row.version,
    notes: row.notes || null,
    status,
    statusLabel: POSTER_STATUS_LABELS[status] || status,
    name: file.name || `پوستر نسخه ${row.version}`,
    mimeType: file.mimeType || null,
    sizeBytes: file.sizeBytes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    uploadedByName: userName(row.uploadedBy),
    deliveredAt: row.deliveredAt || null,
  };

  if (forCustomer) {
    return {
      ...publicFields,
      uploadedByName: null,
      notes: null,
    };
  }

  return {
    ...publicFields,
    storageKey: file.storageKey || null,
    uploadedById: row.uploadedById || null,
    reviewedById: row.reviewedById || null,
    reviewedByName: userName(row.reviewedBy),
    reviewedAt: row.reviewedAt || null,
    rejectionReason: row.rejectionReason || null,
    deliveredById: row.deliveredById || null,
    deliveredByName: userName(row.deliveredBy),
  };
}

export function markLatestFlags(items) {
  if (!Array.isArray(items) || items.length === 0) return items;
  const latest = items.reduce((best, cur) =>
    (cur.version || 0) > (best.version || 0) ? cur : best,
  );
  const latestDelivered = items
    .filter((i) => i.status === "SENT_TO_CUSTOMER")
    .reduce((best, cur) => {
      if (!best) return cur;
      return (cur.version || 0) > (best.version || 0) ? cur : best;
    }, null);

  return items.map((item) => ({
    ...item,
    isLatest: item.id === latest.id,
    isLatestDelivered: latestDelivered ? item.id === latestDelivered.id : false,
  }));
}
