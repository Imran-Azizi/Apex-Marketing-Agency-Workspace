/**
 * Shared project completion helpers — keep status / CRM / timeline consistent.
 *
 * Auto-complete rule (product requirement):
 *   COMPLETED only when BOTH are true:
 *   1) Customer has confirmed/approved the final video(s)
 *   2) Full project amount has been paid (balance <= 0)
 * Either condition alone must NOT mark the project completed.
 * Managers may still force-complete via markProjectCompleted / delivery.complete.
 */

import { AppError } from '../utils/response.js';

/** Actual payment settled — ignores manager download override. */
export function isPaymentFullySettled(finance) {
  if (!finance) return false;
  const price = Number(finance.finalProjectPrice);
  const received = Number(finance.received);
  if (!Number.isFinite(price) || !Number.isFinite(received)) return false;
  return received >= price && price >= 0;
}

/**
 * True when the customer has confirmed the final product package.
 * Status past the approval gate, or every manager-sent final file is customer-approved.
 * A single CLIENT_FINAL row is not enough (one row is written per video approval).
 */
export function hasCustomerFinalVideoApproval({
  projectStatus,
} = {}) {
  return (
    projectStatus === 'WAITING_PAYMENT' ||
    projectStatus === 'READY_TO_DOWNLOAD' ||
    projectStatus === 'COMPLETED'
  );
}

export async function evaluateCustomerFinalApproval(db, project) {
  if (!project) return false;
  if (hasCustomerFinalVideoApproval({ projectStatus: project.status })) {
    return true;
  }

  const {
    isFinalPackageCustomerConfirmed,
  } = await import('../modules/production/finalProduct.js');

  const files =
    project.files ||
    (await db.projectFile.findMany({
      where: {
        projectId: project.id,
        kind: { in: ['CLEAN_FINAL', 'WATERMARKED_FINAL'] },
        deletedAt: null,
      },
    }));

  return isFinalPackageCustomerConfirmed(files, project.status);
}

/**
 * Mark a project COMPLETED idempotently.
 * @returns {{ completed: boolean, alreadyCompleted: boolean, completedAt: Date|null }}
 */
export async function markProjectCompleted(
  db,
  {
    projectId,
    crmCustomerId,
    previousStatus,
    completedAt = new Date(),
    timelineType = 'PROJECT_COMPLETED',
    timelineTitle = 'پروژه تکمیل شد',
    timelineBody = null,
    notifyProgress = false,
    actorId = null,
  },
) {
  const current = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      status: true,
      completedAt: true,
      crmCustomerId: true,
      title: true,
      code: true,
    },
  });
  if (!current) return { completed: false, alreadyCompleted: false, completedAt: null };

  if (current.status === 'COMPLETED' && current.completedAt) {
    return {
      completed: true,
      alreadyCompleted: true,
      completedAt: current.completedAt,
    };
  }

  const customerId = crmCustomerId || current.crmCustomerId;
  const at = completedAt instanceof Date ? completedAt : new Date(completedAt);

  await db.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: {
        status: 'COMPLETED',
        customerFacingStatus: 'COMPLETED',
        completedAt: at,
        deliveryStatus: 'COMPLETED',
      },
    });

    await tx.editingTask.updateMany({
      where: {
        projectId,
        status: { not: 'COMPLETED' },
      },
      data: { status: 'COMPLETED', completedAt: at },
    });

    if (tx.narrationTask?.updateMany) {
      await tx.narrationTask.updateMany({
        where: {
          projectId,
          status: { not: 'APPROVED' },
        },
        data: { status: 'APPROVED', approvedAt: at },
      });
    }

    await tx.projectTimelineEvent.create({
      data: {
        projectId,
        type: timelineType,
        title: timelineTitle,
        body: timelineBody,
        actorId: actorId || undefined,
      },
    });
  });

  if (customerId) {
    const { applyCrmEvent } = await import('../modules/crm/sync.js');
    const { CRM_EVENTS } = await import('../modules/crm/pipeline.js');
    await applyCrmEvent(db, {
      customerId,
      event: CRM_EVENTS.PROJECT_DELIVERED,
      source: 'PROJECT',
      relatedType: 'Project',
      relatedId: projectId,
      title: 'پروژه تحویل شد',
      actorId: actorId || undefined,
      actorType: actorId ? 'USER' : undefined,
    });
  }

  // Notify assigned editors so their panels reflect completion.
  try {
    const { createNotificationOnce, buildEditingCompletedNotification } =
      await import('./notifications.js');
    const tasks = await db.editingTask.findMany({
      where: { projectId },
      select: { editorUserId: true },
      distinct: ['editorUserId'],
    });
    for (const task of tasks) {
      if (!task.editorUserId) continue;
      await createNotificationOnce({
        ...buildEditingCompletedNotification({
          projectId,
          projectTitle: current.title,
          projectCode: current.code,
          forEditor: true,
          at,
        }),
        userId: task.editorUserId,
        audience: 'INTERNAL',
      }, db);
    }
  } catch (err) {
    console.error('[completion] editor notify', err?.message || err);
  }

  // Notify assigned narrators.
  try {
    const { createNotificationOnce } = await import('./notifications.js');
    if (db.narrationTask?.findMany) {
      const narrationTasks = await db.narrationTask.findMany({
        where: { projectId, narratorUserId: { not: null } },
        select: { narratorUserId: true },
        distinct: ['narratorUserId'],
      });
      for (const task of narrationTasks) {
        if (!task.narratorUserId) continue;
        await createNotificationOnce(
          {
            eventKey: `project.completed.narrator:${projectId}:${task.narratorUserId}`,
            userId: task.narratorUserId,
            audience: 'INTERNAL',
            title: `پروژه «${current.title || 'پروژه'}» تکمیل شد`,
            body: [
              `پروژه «${current.title || 'پروژه'}» توسط سیستم به‌عنوان تکمیل‌شده ثبت شد.`,
              current.code ? `شناسه: ${current.code}` : null,
            ]
              .filter(Boolean)
              .join('\n'),
            link: `/narrator/projects`,
            meta: {
              type: 'PROJECT_COMPLETED',
              projectId,
              projectName: current.title,
              projectCode: current.code,
              actionType: 'PROJECT_COMPLETED',
              createdAt: at.toISOString(),
            },
          },
          db,
        );
      }
    }
  } catch (err) {
    console.error('[completion] narrator notify', err?.message || err);
  }

  if (notifyProgress) {
    try {
      const { notifyProjectProgressChange } = await import('./projectProgress.js');
      await notifyProjectProgressChange(db, {
        projectId,
        previousStatus: previousStatus || current.status,
        nextStatus: 'COMPLETED',
      });
    } catch (err) {
      console.error('[progress] notify on project complete', err?.message || err);
    }
  }

  try {
    const { syncProjectDeliveryFields } = await import('./deliveryAccess.js');
    await syncProjectDeliveryFields(db, projectId, {
      projectPatch: { deliveryStatus: 'COMPLETED', cleanFileAccess: 'AVAILABLE' },
    });
  } catch (err) {
    console.error('[delivery] sync on project complete', err?.message || err);
  }

  return { completed: true, alreadyCompleted: false, completedAt: at };
}

/**
 * Auto-complete when customer final approval AND full payment are both satisfied.
 * Safe to call after payment verify or after customer final approve.
 *
 * @returns {{
 *   completed: boolean,
 *   alreadyCompleted: boolean,
 *   completedAt: Date|null,
 *   reason: 'ALREADY_COMPLETED'|'MISSING_PAYMENT'|'MISSING_APPROVAL'|'COMPLETED'|'NOT_FOUND',
 *   paymentSettled: boolean,
 *   customerApproved: boolean,
 * }}
 */
export async function tryAutoCompleteProject(
  db,
  projectId,
  {
    completedAt = new Date(),
    timelineType = 'PROJECT_COMPLETED',
    timelineTitle = 'پروژه تکمیل شد',
    timelineBody = 'تأیید نهایی مشتری و تسویه کامل پرداخت',
    notifyProgress = true,
    actorId = null,
    /** Caller already verified package-level customer approval in this request. */
    customerApprovedOverride = null,
  } = {},
) {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      finance: true,
      files: {
        where: {
          kind: { in: ['CLEAN_FINAL', 'WATERMARKED_FINAL'] },
          deletedAt: null,
        },
      },
    },
  });

  if (!project) {
    return {
      completed: false,
      alreadyCompleted: false,
      completedAt: null,
      reason: 'NOT_FOUND',
      paymentSettled: false,
      customerApproved: false,
    };
  }

  if (project.status === 'COMPLETED' && project.completedAt) {
    return {
      completed: true,
      alreadyCompleted: true,
      completedAt: project.completedAt,
      reason: 'ALREADY_COMPLETED',
      paymentSettled: true,
      customerApproved: true,
    };
  }

  const paymentSettled = isPaymentFullySettled(project.finance);
  const customerApproved =
    customerApprovedOverride === true ||
    customerApprovedOverride === false
      ? customerApprovedOverride
      : await evaluateCustomerFinalApproval(db, project);

  if (!paymentSettled) {
    return {
      completed: false,
      alreadyCompleted: false,
      completedAt: null,
      reason: 'MISSING_PAYMENT',
      paymentSettled: false,
      customerApproved,
    };
  }

  if (!customerApproved) {
    return {
      completed: false,
      alreadyCompleted: false,
      completedAt: null,
      reason: 'MISSING_APPROVAL',
      paymentSettled: true,
      customerApproved: false,
    };
  }

  const result = await markProjectCompleted(db, {
    projectId,
    crmCustomerId: project.crmCustomerId,
    previousStatus: project.status,
    completedAt,
    timelineType,
    timelineTitle,
    timelineBody,
    notifyProgress,
    actorId,
  });

  try {
    const { markSentFinalsApprovedByCustomer } = await import(
      '../modules/production/finalProduct.js'
    );
    await markSentFinalsApprovedByCustomer(db, projectId, {
      approvedAt: completedAt instanceof Date ? completedAt : new Date(completedAt),
      includeClean: true,
    });
  } catch (err) {
    console.error(
      '[completion] mark finals approved after complete',
      err?.message || err,
    );
  }

  return {
    ...result,
    reason: result.alreadyCompleted ? 'ALREADY_COMPLETED' : 'COMPLETED',
    paymentSettled: true,
    customerApproved: true,
  };
}

/** Manager/admin force-complete — does not require payment + approval gates. */
export async function forceCompleteProject(
  db,
  {
    projectId,
    actorId,
    reason = null,
  },
) {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      status: true,
      completedAt: true,
      crmCustomerId: true,
      title: true,
      code: true,
    },
  });
  if (!project) throw new AppError('پروژه یافت نشد', 404, 'NOT_FOUND');

  if (project.status === 'COMPLETED' && project.completedAt) {
    return {
      completed: true,
      alreadyCompleted: true,
      completedAt: project.completedAt,
      project,
    };
  }

  if (project.status === 'CANCELED' || project.status === 'CANCELLED') {
    throw new AppError('پروژه لغوشده قابل تکمیل نیست', 400, 'PROJECT_CANCELED');
  }

  const completedAt = new Date();
  const result = await markProjectCompleted(db, {
    projectId,
    crmCustomerId: project.crmCustomerId,
    previousStatus: project.status,
    completedAt,
    timelineType: 'PROJECT_COMPLETED',
    timelineTitle: 'پروژه توسط مدیر تکمیل شد',
    timelineBody: reason
      ? `تکمیل دستی توسط مدیر — ${reason}`
      : 'تکمیل دستی توسط مدیر',
    notifyProgress: true,
    actorId,
  });

  // Re-read authoritative status for the API response.
  const refreshed = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      status: true,
      customerFacingStatus: true,
      completedAt: true,
      deliveryStatus: true,
      crmCustomerId: true,
      title: true,
      code: true,
    },
  });

  return { ...result, project: refreshed || project };
}
