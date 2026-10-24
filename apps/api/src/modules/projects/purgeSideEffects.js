/**
 * Wipe operational rows tied to soft-deleted projects so they cannot
 * resurface in editor/narrator/finance/notification surfaces.
 *
 * Call inside an existing Prisma transaction.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string[]} projectIds
 */
export async function purgeProjectOperationalSideEffects(tx, projectIds) {
  const ids = Array.isArray(projectIds)
    ? [...new Set(projectIds.filter(Boolean))]
    : [];
  if (!ids.length) return { assignments: 0, narrationTasks: 0, editingTasks: 0 };

  const assignments = await tx.projectAssignment.updateMany({
    where: { projectId: { in: ids }, isActive: true },
    data: { isActive: false },
  });

  await tx.narrationTask.updateMany({
    where: { projectId: { in: ids } },
    data: {
      audioFileId: null,
      narratorUserId: null,
      narratorTeamProfileId: null,
    },
  });
  const narrationTasks = await tx.narrationTask.deleteMany({
    where: { projectId: { in: ids } },
  });

  await tx.editingTask.updateMany({
    where: { projectId: { in: ids } },
    data: {
      watermarkedFileId: null,
      cleanFileId: null,
      editorUserId: null,
      editorTeamProfileId: null,
    },
  });
  const editingTasks = await tx.editingTask.deleteMany({
    where: { projectId: { in: ids } },
  });

  await tx.projectFinance.deleteMany({
    where: { projectId: { in: ids } },
  });

  // Drop notifications that deep-link to these projects (internal + portal).
  for (const projectId of ids) {
    await tx.notification.deleteMany({
      where: {
        OR: [
          { link: `/projects/${projectId}` },
          { link: { startsWith: `/projects/${projectId}?` } },
          { link: { startsWith: `/projects/${projectId}/` } },
          { link: `/portal/projects/${projectId}` },
          { link: { startsWith: `/portal/projects/${projectId}` } },
          { link: `/portal/contracts/${projectId}` },
          { link: { startsWith: `/portal/contracts/${projectId}` } },
          { meta: { path: ["projectId"], equals: projectId } },
        ],
      },
    });
  }

  return {
    assignments: assignments.count,
    narrationTasks: narrationTasks.count,
    editingTasks: editingTasks.count,
  };
}

/**
 * Detach a soft-deleted employee from live work so their old tasks/assignments
 * no longer appear on editor/narrator panels.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {{ userId: string, teamProfileIds?: string[] }} params
 */
export async function purgeEmployeeOperationalSideEffects(tx, { userId, teamProfileIds = [] }) {
  if (!userId) return;

  await tx.projectAssignment.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  });

  if (teamProfileIds.length) {
    await tx.projectAssignment.updateMany({
      where: { teamProfileId: { in: teamProfileIds }, isActive: true },
      data: { isActive: false },
    });
  }

  await tx.narrationTask.updateMany({
    where: { narratorUserId: userId },
    data: { narratorUserId: null, narratorTeamProfileId: null },
  });

  await tx.editingTask.updateMany({
    where: { editorUserId: userId },
    data: { editorUserId: null, editorTeamProfileId: null },
  });

  await tx.notification.deleteMany({
    where: { userId },
  });
}
