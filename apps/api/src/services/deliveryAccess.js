/**
 * Payment + manager-approval gates for clean-file delivery.
 * Keeps Project.paymentStatus / deliveryStatus / cleanFileAccess in sync.
 */

export function computeBalance(finance) {
  if (!finance) return null;
  return Number(finance.finalProjectPrice) - Number(finance.received);
}

/**
 * @returns {{
 *   balance: number|null,
 *   paymentSettled: boolean,
 *   managerApproved: boolean,
 *   cleanDownloadAllowed: boolean,
 *   paymentStatus: 'UNPAID'|'PARTIAL'|'PAID'|'OVERRIDE',
 *   deliveryStatus: string,
 *   cleanFileAccess: string,
 *   message: string|null,
 * }}
 */
export function evaluateDeliveryAccess({
  projectStatus,
  finance,
  downloadPermission,
  hasCleanFile = true,
}) {
  const balance = computeBalance(finance);
  const override = !!downloadPermission?.overrideBalance;
  const managerApproved = !!downloadPermission?.allowed && !downloadPermission?.revokedAt;
  const paymentSettled = balance != null && (balance <= 0 || override);

  let paymentStatus = 'UNPAID';
  if (override && balance > 0) paymentStatus = 'OVERRIDE';
  else if (balance == null) paymentStatus = 'UNPAID';
  else if (balance <= 0) paymentStatus = 'PAID';
  else if (Number(finance?.received) > 0) paymentStatus = 'PARTIAL';
  else paymentStatus = 'UNPAID';

  const lateStatuses = new Set([
    'WAITING_CLIENT_FINAL_APPROVAL',
    'WAITING_PAYMENT',
    'READY_TO_DOWNLOAD',
    'COMPLETED',
  ]);
  const inDeliveryPhase = lateStatuses.has(projectStatus) || managerApproved;

  let cleanFileAccess = 'HIDDEN';
  let deliveryStatus = 'NOT_READY';
  let message = null;

  if (projectStatus === 'COMPLETED') {
    deliveryStatus = 'COMPLETED';
    cleanFileAccess = paymentSettled && managerApproved ? 'AVAILABLE' : (paymentSettled ? 'LOCKED_APPROVAL' : 'LOCKED_PAYMENT');
  } else if (!inDeliveryPhase || !hasCleanFile) {
    deliveryStatus = 'NOT_READY';
    cleanFileAccess = 'HIDDEN';
  } else if (!paymentSettled) {
    deliveryStatus = 'AWAITING_PAYMENT';
    cleanFileAccess = 'LOCKED_PAYMENT';
    message = 'تا تسویه کامل مبلغ پروژه، نسخه پاک در دسترس نیست. می‌توانید نسخه پیش‌نمایش (لوگودار) را مشاهده کنید.';
  } else if (!managerApproved) {
    deliveryStatus = 'AWAITING_MANAGER_APPROVAL';
    cleanFileAccess = 'LOCKED_APPROVAL';
    message = 'پرداخت تکمیل شده است. پس از تأیید تحویل توسط مدیر، دانلود نسخه پاک فعال می‌شود.';
  } else {
    deliveryStatus = 'READY_FOR_DOWNLOAD';
    cleanFileAccess = 'AVAILABLE';
  }

  const cleanDownloadAllowed = cleanFileAccess === 'AVAILABLE';

  return {
    balance,
    paymentSettled,
    managerApproved,
    cleanDownloadAllowed,
    paymentStatus,
    deliveryStatus,
    cleanFileAccess,
    message,
  };
}

/** Persist denormalized delivery fields on Project. */
export async function syncProjectDeliveryFields(prismaOrTx, projectId, extras = {}) {
  const project = await prismaOrTx.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      finance: true,
      downloadPermission: true,
      files: {
        where: { kind: 'CLEAN_FINAL', deletedAt: null },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!project) return null;

  const evalResult = evaluateDeliveryAccess({
    projectStatus: project.status,
    finance: project.finance,
    downloadPermission: project.downloadPermission,
    hasCleanFile: project.files.length > 0,
  });

  let deliveryStatus = evalResult.deliveryStatus;
  if (project.status === 'COMPLETED') {
    deliveryStatus = 'COMPLETED';
  } else if (
    extras.markDelivered &&
    evalResult.cleanDownloadAllowed
  ) {
    deliveryStatus = 'DELIVERED';
  } else if (
    project.deliveryStatus === 'DELIVERED' &&
    evalResult.cleanDownloadAllowed &&
    project.status !== 'COMPLETED'
  ) {
    deliveryStatus = 'DELIVERED';
  }

  const data = {
    paymentStatus: evalResult.paymentStatus,
    deliveryStatus,
    cleanFileAccess: evalResult.cleanFileAccess,
    ...extras.projectPatch,
  };

  return prismaOrTx.project.update({
    where: { id: projectId },
    data,
  });
}

export function deliverySnapshot(evalResult) {
  return {
    paymentStatus: evalResult.paymentStatus,
    deliveryStatus: evalResult.deliveryStatus,
    cleanFileAccess: evalResult.cleanFileAccess,
    cleanDownloadAvailable: evalResult.cleanDownloadAllowed,
    paymentSettled: evalResult.paymentSettled,
    managerApproved: evalResult.managerApproved,
    balance: evalResult.balance,
    deliveryMessage: evalResult.message,
  };
}
