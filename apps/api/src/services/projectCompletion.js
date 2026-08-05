/**
 * Shared project completion helpers — keep status / CRM / timeline consistent.
 */

/**
 * Mark a project COMPLETED idempotently.
 * @returns {{ completed: boolean, alreadyCompleted: boolean, completedAt: Date }}
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
  },
) {
  const current = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      status: true,
      completedAt: true,
      crmCustomerId: true,
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

  await db.project.update({
    where: { id: projectId },
    data: {
      status: 'COMPLETED',
      customerFacingStatus: 'COMPLETED',
      completedAt: at,
      deliveryStatus: 'COMPLETED',
    },
  });

  if (customerId) {
    await db.crmCustomer.update({
      where: { id: customerId },
      data: { pipelineStage: 'COMPLETED' },
    });
  }

  await db.opportunity.updateMany({
    where: { projectId },
    data: { pipelineStage: 'COMPLETED' },
  });

  await db.projectTimelineEvent.create({
    data: {
      projectId,
      type: timelineType,
      title: timelineTitle,
      body: timelineBody,
    },
  });

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
