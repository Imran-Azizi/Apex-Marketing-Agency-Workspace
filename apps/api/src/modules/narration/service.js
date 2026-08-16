import { mergeStorageMeta } from '../../services/storage/media-manager.js';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/response.js';
import { writeAudit } from '../../middleware/audit.js';
import { rebuildProjectContext } from '../../services/projectContext.js';
import {
  parseAssignmentAmount,
  upsertLaborPayable,
  syncProjectLaborCosts,
} from '../../services/assignmentFinance.js';
import {
  createNotificationOnce,
  notifyManagersOnce,
  buildNarrationAssignedNotification,
  buildNarrationDeadlineReminderNotification,
  buildNarrationUploadedNotification,
  buildNarrationApprovedNotification,
  buildNarrationRevisionRequestedNotification,
} from '../../services/notifications.js';
import {
  serializeNarratorTaskSummary,
  serializeNarratorWorkspace,
} from './narratorView.js';

const AUDIO_MIME = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
]);

const AUDIO_EXT = /\.(mp3|wav|m4a)$/i;

const taskInclude = {
  narratorUser: { select: { id: true, fullName: true, email: true } },
  narratorTeamProfile: {
    select: { id: true, displayName: true, realName: true, languages: true, tone: true },
  },
  assignedBy: { select: { id: true, fullName: true } },
  audioFile: true,
  takes: {
    orderBy: { version: 'asc' },
    include: {
      projectFile: true,
      uploadedBy: { select: { id: true, fullName: true } },
    },
  },
  contentVersion: {
    select: {
      id: true,
      versionNumber: true,
      status: true,
      narration: true,
      isLocked: true,
      publishedToClient: true,
    },
  },
  project: {
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      managerId: true,
    },
  },
};

function assertAudioFile({ name, mimeType }) {
  const okMime = mimeType && AUDIO_MIME.has(String(mimeType).toLowerCase());
  const okExt = name && AUDIO_EXT.test(name);
  if (!okMime && !okExt) {
    throw new AppError('فقط فایل‌های MP3، WAV یا M4A مجاز است', 400, 'INVALID_AUDIO');
  }
}

async function loadApprovedContentVersion(projectId, tx = prisma) {
  return tx.contentVersion.findFirst({
    where: {
      projectId,
      status: 'APPROVED',
      publishedToClient: true,
      isLocked: true,
    },
    orderBy: { versionNumber: 'desc' },
  });
}

async function loadNarratorAssignment(projectId, userId) {
  if (!userId) return null;
  return prisma.projectAssignment.findFirst({
    where: {
      projectId,
      role: 'NARRATOR',
      userId,
      isActive: true,
    },
    select: { createdAt: true, deadlineAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Backfill NarrationTake rows for uploads that predate take tracking.
 * Safe to call on every read — no-ops when takes already exist.
 */
async function ensureNarrationTakeHistory(taskId, projectId, tx = prisma) {
  const count = await tx.narrationTake.count({ where: { taskId } });
  if (count > 0) return false;

  const files = await tx.projectFile.findMany({
    where: {
      projectId,
      kind: 'AUDIO',
      deletedAt: null,
      meta: { path: ['narrationTaskId'], equals: taskId },
    },
    orderBy: [{ createdAt: 'asc' }, { version: 'asc' }],
  });

  if (!files.length) return false;

  await tx.narrationTake.createMany({
    data: files.map((file, index) => ({
      taskId,
      projectFileId: file.id,
      version: file.version ?? index + 1,
      uploadedById: file.uploadedBy ?? null,
      createdAt: file.createdAt,
    })),
  });
  return true;
}

async function nextNarrationTakeVersion(taskId, tx = prisma) {
  const last = await tx.narrationTake.findFirst({
    where: { taskId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  return (last?.version ?? 0) + 1;
}

async function formatTaskResponse(task, auth, projectId) {
  if (auth.roleCode !== 'NARRATOR') return task;
  const assignment = await loadNarratorAssignment(projectId, auth.userId);
  return serializeNarratorWorkspace(task, assignment);
}

async function maybeRemindDeadline(task) {
  if (!task?.deadline || !task.narratorUserId) return;
  if (['APPROVED', 'NARRATION_SUBMITTED'].includes(task.status)) return;
  const now = Date.now();
  const deadlineMs = new Date(task.deadline).getTime();
  const hoursLeft = (deadlineMs - now) / (1000 * 60 * 60);
  if (hoursLeft > 48 || hoursLeft < 0) return;
  const dayKey = new Date().toISOString().slice(0, 10);
  await createNotificationOnce({
    ...buildNarrationDeadlineReminderNotification({
      projectId: task.projectId,
      projectTitle: task.project?.title || 'پروژه',
      projectCode: task.project?.code,
      deadline: task.deadline,
      dayKey,
    }),
    userId: task.narratorUserId,
    audience: 'INTERNAL',
  });
}

async function hydrateNarratorSummaries(tasks, userId) {
  if (!tasks.length) return [];
  const projectIds = [...new Set(tasks.map((t) => t.projectId).filter(Boolean))];
  const assignments = userId
    ? await prisma.projectAssignment.findMany({
        where: {
          projectId: { in: projectIds },
          role: 'NARRATOR',
          userId,
          isActive: true,
        },
        select: { projectId: true, createdAt: true, deadlineAt: true },
        orderBy: { createdAt: 'desc' },
      })
    : [];
  const byProject = new Map();
  for (const a of assignments) {
    if (!byProject.has(a.projectId)) byProject.set(a.projectId, a);
  }
  return tasks.map((task) =>
    serializeNarratorTaskSummary(task, byProject.get(task.projectId) || null),
  );
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfWeek(d = new Date()) {
  const day = d.getDay();
  // Saturday as week start for fa locale (0 Sun … 6 Sat)
  const diff = (day + 1) % 7;
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - diff);
  return start;
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function matchesDateFilter(assignedAt, dateFilter, from, to) {
  if (!dateFilter || dateFilter === 'all') return true;
  if (!assignedAt) return false;
  const t = new Date(assignedAt).getTime();
  if (dateFilter === 'today') return t >= startOfDay().getTime();
  if (dateFilter === 'week') return t >= startOfWeek().getTime();
  if (dateFilter === 'month') return t >= startOfMonth().getTime();
  if (dateFilter === 'custom') {
    if (from && t < new Date(from).getTime()) return false;
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      if (t > end.getTime()) return false;
    }
    return true;
  }
  return true;
}

function statusFilterMap(status) {
  if (!status || status === 'all') return null;
  const map = {
    new: 'PENDING_NARRATION',
    pending: 'PENDING_NARRATION',
    PENDING_NARRATION: 'PENDING_NARRATION',
    in_progress: 'RECORDING_IN_PROGRESS',
    RECORDING_IN_PROGRESS: 'RECORDING_IN_PROGRESS',
    submitted: 'NARRATION_SUBMITTED',
    NARRATION_SUBMITTED: 'NARRATION_SUBMITTED',
    revision: 'REVISION_REQUESTED',
    REVISION_REQUESTED: 'REVISION_REQUESTED',
    completed: 'APPROVED',
    approved: 'APPROVED',
    APPROVED: 'APPROVED',
  };
  return map[status] || status;
}

export const narrationService = {
  async listAvailableNarrators() {
    return prisma.teamProfile.findMany({
      where: {
        kind: 'NARRATOR',
        status: 'ACTIVE',
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
      },
      orderBy: { displayName: 'asc' },
      include: {
        user: { select: { id: true, fullName: true, email: true, isActive: true } },
        rates: { where: { isActive: true }, take: 3 },
        audioSamples: {
          where: { isPublished: true, deletedAt: null },
          take: 2,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  },

  async listMyTasks(auth) {
    const tasks = await prisma.narrationTask.findMany({
      where: { narratorUserId: auth.userId },
      orderBy: [{ status: 'asc' }, { deadline: 'asc' }, { updatedAt: 'desc' }],
      include: taskInclude,
    });
    await Promise.all(tasks.map((t) => maybeRemindDeadline(t)));

    if (auth.roleCode === 'NARRATOR') {
      return hydrateNarratorSummaries(tasks, auth.userId);
    }

    return tasks;
  },

  /**
   * Narrator dashboard analytics — least-privilege payload only.
   */
  async getNarratorDashboard(auth) {
    if (auth.roleCode !== 'NARRATOR' && auth.roleCode !== 'MANAGER' && auth.roleCode !== 'ADMIN') {
      throw new AppError('دسترسی مجاز نیست', 403, 'FORBIDDEN');
    }
    if (auth.roleCode !== 'NARRATOR') {
      throw new AppError('این داشبورد مخصوص نریتور است', 403, 'FORBIDDEN');
    }

    const tasks = await prisma.narrationTask.findMany({
      where: { narratorUserId: auth.userId },
      orderBy: [{ updatedAt: 'desc' }],
      include: taskInclude,
    });
    await Promise.all(tasks.map((t) => maybeRemindDeadline(t)));
    const items = await hydrateNarratorSummaries(tasks, auth.userId);

    const now = Date.now();
    const monthStart = startOfMonth().getTime();

    const stats = {
      total: items.length,
      pending: items.filter((t) => t.status === 'PENDING_NARRATION').length,
      inProgress: items.filter((t) => t.status === 'RECORDING_IN_PROGRESS').length,
      submitted: items.filter((t) => t.status === 'NARRATION_SUBMITTED').length,
      revisionRequested: items.filter((t) => t.status === 'REVISION_REQUESTED').length,
      completed: items.filter((t) => t.status === 'APPROVED').length,
      overdue: items.filter((t) => t.overdue).length,
      completedThisMonth: items.filter(
        (t) =>
          t.status === 'APPROVED' &&
          t.approvedAt &&
          new Date(t.approvedAt).getTime() >= monthStart,
      ).length,
      totalEarnings: items
        .filter((t) => t.status === 'APPROVED' && t.assignedAmount != null)
        .reduce((sum, t) => sum + Number(t.assignedAmount || 0), 0),
      estimatedEarnings: items
        .filter((t) => t.assignedAmount != null)
        .reduce((sum, t) => sum + Number(t.assignedAmount || 0), 0),
    };

    const statusBreakdown = [
      { status: 'PENDING_NARRATION', label: 'جدید', count: stats.pending },
      { status: 'RECORDING_IN_PROGRESS', label: 'در حال کار', count: stats.inProgress },
      { status: 'NARRATION_SUBMITTED', label: 'ارسال‌شده', count: stats.submitted },
      { status: 'REVISION_REQUESTED', label: 'نیاز به اصلاح', count: stats.revisionRequested },
      { status: 'APPROVED', label: 'تأیید / تکمیل', count: stats.completed },
    ];

    const recent = [...items]
      .sort((a, b) => new Date(b.assignedAt || 0).getTime() - new Date(a.assignedAt || 0).getTime())
      .slice(0, 6);

    const upcomingDeadlines = items
      .filter(
        (t) =>
          t.deadline &&
          !['APPROVED', 'NARRATION_SUBMITTED'].includes(t.status),
      )
      .map((t) => ({
        ...t,
        remainingMs: new Date(t.deadline).getTime() - now,
      }))
      .sort((a, b) => a.remainingMs - b.remainingMs)
      .slice(0, 8);

    return {
      stats,
      statusBreakdown,
      recent,
      upcomingDeadlines,
    };
  },

  /**
   * Paginated narrator projects list with search / filter.
   */
  async listNarratorProjects(auth, query = {}) {
    if (auth.roleCode !== 'NARRATOR') {
      throw new AppError('فقط نریتور به فهرست نریشن‌ها دسترسی دارد', 403, 'FORBIDDEN');
    }

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(query.pageSize, 10) || 12));
    const q = String(query.q || '').trim().toLowerCase();
    const status = statusFilterMap(query.status);
    const dateFilter = String(query.date || 'all');
    const from = query.from || null;
    const to = query.to || null;

    const tasks = await prisma.narrationTask.findMany({
      where: {
        narratorUserId: auth.userId,
        ...(status ? { status } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
      include: taskInclude,
    });

    let items = await hydrateNarratorSummaries(tasks, auth.userId);

    if (q) {
      items = items.filter((t) => {
        const hay = `${t.title} ${t.scriptPreview || ''} ${t.status}`.toLowerCase();
        return hay.includes(q);
      });
    }

    items = items.filter((t) => matchesDateFilter(t.assignedAt, dateFilter, from, to));

    items.sort(
      (a, b) =>
        new Date(b.assignedAt || 0).getTime() - new Date(a.assignedAt || 0).getTime(),
    );

    const total = items.length;
    const start = (page - 1) * pageSize;
    const pageItems = items.slice(start, start + pageSize);

    return {
      items: pageItems,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      hasMore: start + pageSize < total,
    };
  },

  async getNarratorWorkspace(projectId, auth) {
    if (auth.roleCode !== 'NARRATOR') {
      throw new AppError('فقط نریتور به این بخش دسترسی دارد', 403, 'FORBIDDEN');
    }
    const task = await this.getProjectTask(projectId, auth);
    if (!task) {
      throw new AppError('این نریشن هنوز به شما ارسال نشده است', 404, 'NOT_FOUND');
    }
    return task;
  },

  async getProjectTask(projectId, auth) {
    let task = await prisma.narrationTask.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: taskInclude,
    });

    // Managers may auto-create shell tasks; narrators only see manually sent work.
    if (!task && auth.roleCode !== 'NARRATOR') {
      const project = await prisma.project.findFirst({
        where: { id: projectId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (project?.status === 'NARRATION_RECORDING') {
        task = await this.ensureTaskForProject(projectId, { assignedById: auth.userId || null });
      }
    }

    if (task) {
      if (auth.roleCode === 'NARRATOR') {
        if (!task.narratorUserId || task.narratorUserId !== auth.userId) {
          throw new AppError('این نریشن هنوز به شما ارسال نشده است', 403, 'FORBIDDEN');
        }
      }
      const backfilled = await ensureNarrationTakeHistory(task.id, task.projectId);
      if (backfilled) {
        task = await prisma.narrationTask.findFirst({
          where: { id: task.id },
          include: taskInclude,
        });
      }
      await maybeRemindDeadline(task);
      return formatTaskResponse(task, auth, projectId);
    }
    return null;
  },

  /**
   * Create or refresh narration task after content approval / manager assign.
   * Can run inside an existing transaction via `tx`.
   */
  async ensureTaskForProject(
    projectId,
    {
      assignedById = null,
      narratorUserId = null,
      narratorTeamProfileId = null,
      deadline = null,
      contentVersionId = null,
      assignedAmount = null,
      tx = prisma,
    } = {},
  ) {
    const content =
      (contentVersionId
        ? await tx.contentVersion.findFirst({ where: { id: contentVersionId, projectId } })
        : null) || (await loadApprovedContentVersion(projectId, tx));

    const existing = await tx.narrationTask.findFirst({
      where: {
        projectId,
        status: { notIn: ['APPROVED'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    const scriptSnapshot = content?.narration || null;
    const data = {
      contentVersionId: content?.id || contentVersionId || null,
      narrationScriptSnapshot: scriptSnapshot,
      ...(narratorUserId != null ? { narratorUserId } : {}),
      ...(narratorTeamProfileId != null ? { narratorTeamProfileId } : {}),
      ...(deadline != null ? { deadline } : {}),
      ...(assignedAmount != null ? { assignedAmount } : {}),
      ...(assignedById ? { assignedById } : {}),
    };

    if (existing) {
      const nextStatus =
        existing.status === 'APPROVED'
          ? existing.status
          : narratorUserId || existing.narratorUserId
            ? existing.status === 'PENDING_NARRATION' || !existing.narratorUserId
              ? 'PENDING_NARRATION'
              : existing.status
            : existing.status;

      return tx.narrationTask.update({
        where: { id: existing.id },
        data: {
          ...data,
          status: nextStatus,
        },
        include: taskInclude,
      });
    }

    return tx.narrationTask.create({
      data: {
        projectId,
        status: 'PENDING_NARRATION',
        ...data,
      },
      include: taskInclude,
    });
  },

  /**
   * Manually send narration to a narrator (assignment + notification).
   * This is the only path that grants narrator access and triggers alerts.
   */
  async assignNarrator(
    projectId,
    { narratorProfileId, deadline, narrationCost, amount },
    auth,
    req,
  ) {
    if (!narratorProfileId) {
      throw new AppError('انتخاب نریتور الزامی است', 400, 'VALIDATION');
    }

    const assignedAmount = parseAssignmentAmount(narrationCost ?? amount, {
      fieldLabel: 'هزینه نریشن',
    });

    const profile = await prisma.teamProfile.findFirst({
      where: {
        id: narratorProfileId,
        kind: 'NARRATOR',
        status: 'ACTIVE',
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
      },
      include: { user: true },
    });
    if (!profile) {
      throw new AppError('نریتور یافت نشد یا غیرفعال است', 404, 'NOT_FOUND');
    }

    const deadlineAt = deadline ? new Date(deadline) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(deadlineAt.getTime())) {
      throw new AppError('مهلت نامعتبر است', 400, 'INVALID_DEADLINE');
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, title: true, code: true, status: true },
    });
    if (!project) throw new AppError('پروژه یافت نشد', 404, 'NOT_FOUND');

    const approvedContent = await loadApprovedContentVersion(projectId);
    if (!approvedContent?.narration) {
      throw new AppError(
        'متن نریشن تأییدشده برای ارسال موجود نیست',
        400,
        'NARRATION_NOT_READY',
      );
    }

    const assignedAt = new Date();
    const task = await prisma.$transaction(async (tx) => {
      await tx.projectAssignment.updateMany({
        where: { projectId, role: 'NARRATOR', isActive: true },
        data: { isActive: false },
      });
      await tx.projectAssignment.create({
        data: {
          projectId,
          role: 'NARRATOR',
          teamProfileId: profile.id,
          userId: profile.userId,
          deadlineAt,
          isActive: true,
        },
      });

      await upsertLaborPayable(tx, {
        projectId,
        teamProfileId: profile.id,
        roleLabel: 'NARRATOR',
        amount: assignedAmount,
      });

      if (project.status !== 'NARRATION_RECORDING' && project.status !== 'PRODUCTION_EDITING') {
        // Only force narration stage if content already approved or already in recording
        const approved = await loadApprovedContentVersion(projectId, tx);
        if (approved || project.status === 'NARRATION_RECORDING') {
          await tx.project.update({
            where: { id: projectId },
            data: {
              status: 'NARRATION_RECORDING',
              customerFacingStatus: 'IN_PRODUCTION',
            },
          });
        }
      }

      const created = await this.ensureTaskForProject(projectId, {
        tx,
        assignedById: auth.userId,
        narratorUserId: profile.userId,
        narratorTeamProfileId: profile.id,
        deadline: deadlineAt,
        assignedAmount,
      });

      await syncProjectLaborCosts(tx, projectId);

      await tx.projectTimelineEvent.create({
        data: {
          projectId,
          type: 'NARRATION_ASSIGNED',
          title: 'نریشن به نریتور ارسال شد',
          body: `${profile.displayName} — ${assignedAmount} AFN`,
          actorId: auth.userId,
        },
      });

      return created;
    });

    await createNotificationOnce({
      ...buildNarrationAssignedNotification({
        projectId,
        projectTitle: project.title,
        projectCode: project.code,
        deadline: deadlineAt,
        assignedAt,
      }),
      userId: profile.userId,
      audience: 'INTERNAL',
    });

    await writeAudit({
      userId: auth.userId,
      action: 'NARRATION_ASSIGN',
      entityType: 'NarrationTask',
      entityId: task.id,
      after: {
        narratorProfileId,
        deadline: deadlineAt.toISOString(),
        narrationCost: assignedAmount,
      },
      req,
    });

    const updated = await this.getProjectTask(projectId, auth);
    return updated;
  },

  async updateDeadline(projectId, { deadline }, auth, req) {
    if (!deadline) throw new AppError('مهلت الزامی است', 400, 'VALIDATION');
    const deadlineAt = new Date(deadline);
    if (Number.isNaN(deadlineAt.getTime())) {
      throw new AppError('مهلت نامعتبر است', 400, 'INVALID_DEADLINE');
    }

    const task = await prisma.narrationTask.findFirst({
      where: { projectId, status: { not: 'APPROVED' } },
      orderBy: { createdAt: 'desc' },
    });
    if (!task) throw new AppError('تکلیف نریشن یافت نشد', 404, 'NOT_FOUND');

    await prisma.$transaction([
      prisma.narrationTask.update({
        where: { id: task.id },
        data: { deadline: deadlineAt },
      }),
      prisma.projectAssignment.updateMany({
        where: { projectId, role: 'NARRATOR', isActive: true },
        data: { deadlineAt },
      }),
    ]);

    await writeAudit({
      userId: auth.userId,
      action: 'NARRATION_DEADLINE_UPDATE',
      entityType: 'NarrationTask',
      entityId: task.id,
      after: { deadline: deadlineAt.toISOString() },
      req,
    });

    return this.getProjectTask(projectId, auth);
  },

  async submitAudio(
    projectId,
    { storageKey, name, mimeType, sizeBytes, storageMeta },
    auth,
    req,
  ) {
    if (!storageKey) throw new AppError('فایل الزامی است', 400, 'VALIDATION');
    assertAudioFile({ name, mimeType });

    const task = await prisma.narrationTask.findFirst({
      where: { projectId, status: { not: 'APPROVED' } },
      orderBy: { createdAt: 'desc' },
      include: { project: { select: { id: true, title: true, code: true } }, narratorUser: true },
    });
    if (!task) throw new AppError('تکلیف نریشن یافت نشد', 404, 'NOT_FOUND');

    if (auth.roleCode === 'NARRATOR') {
      if (!task.narratorUserId || task.narratorUserId !== auth.userId) {
        throw new AppError('این نریشن هنوز به شما ارسال نشده است', 403, 'FORBIDDEN');
      }
    }
    if (!['PENDING_NARRATION', 'RECORDING_IN_PROGRESS', 'REVISION_REQUESTED'].includes(task.status)) {
      throw new AppError('در این وضعیت امکان آپلود وجود ندارد', 400, 'INVALID_STATUS');
    }

    const submittedAt = new Date();

    let nextVersion = 1;
    await prisma.$transaction(async (tx) => {
      await ensureNarrationTakeHistory(task.id, projectId, tx);
      nextVersion = await nextNarrationTakeVersion(task.id, tx);

      const file = await tx.projectFile.create({
        data: {
          projectId,
          kind: 'AUDIO',
          name: name || `narration-v${nextVersion}.mp3`,
          storageKey,
          mimeType: mimeType || null,
          sizeBytes: sizeBytes != null ? Number(sizeBytes) : null,
          version: nextVersion,
          uploadedBy: auth.userId,
          meta: mergeStorageMeta({ narrationTaskId: task.id }, storageMeta),
        },
      });

      await tx.narrationTake.create({
        data: {
          taskId: task.id,
          projectFileId: file.id,
          version: nextVersion,
          uploadedById: auth.userId,
        },
      });

      await tx.narrationTask.update({
        where: { id: task.id },
        data: {
          status: 'NARRATION_SUBMITTED',
          audioFileId: file.id,
          submittedAt,
          revisionNotes: null,
        },
      });

      await tx.projectTimelineEvent.create({
        data: {
          projectId,
          type: 'VOICE_UPLOAD',
          title: 'آپلود صدای نریشن',
          body: `نسخه ${nextVersion} فایل صوتی آپلود شد`,
          actorId: auth.userId,
        },
      });
    });

    await notifyManagersOnce(
      buildNarrationUploadedNotification({
        projectId,
        projectTitle: task.project.title,
        projectCode: task.project.code,
        narratorName: task.narratorUser?.fullName || auth.fullName || null,
        uploadedAt: submittedAt,
      }),
    );

    await writeAudit({
      userId: auth.userId,
      action: 'NARRATION_SUBMIT',
      entityType: 'NarrationTask',
      entityId: task.id,
      after: { storageKey, version: nextVersion },
      req,
    });

    return this.getProjectTask(projectId, auth);
  },

  async markInProgress(projectId, auth) {
    const task = await prisma.narrationTask.findFirst({
      where: { projectId, status: 'PENDING_NARRATION' },
      orderBy: { createdAt: 'desc' },
    });
    if (!task) return this.getProjectTask(projectId, auth);
    if (auth.roleCode === 'NARRATOR') {
      if (!task.narratorUserId || task.narratorUserId !== auth.userId) {
        throw new AppError('این نریشن هنوز به شما ارسال نشده است', 403, 'FORBIDDEN');
      }
    }
    await prisma.narrationTask.update({
      where: { id: task.id },
      data: { status: 'RECORDING_IN_PROGRESS' },
    });
    return this.getProjectTask(projectId, auth);
  },

  async acceptNarration(projectId, auth, req) {
    const task = await prisma.narrationTask.findFirst({
      where: { projectId, status: 'NARRATION_SUBMITTED' },
      orderBy: { createdAt: 'desc' },
      include: { project: true },
    });
    if (!task) throw new AppError('نریشن ارسال‌شده‌ای برای تأیید نیست', 404, 'NOT_FOUND');

    const approvedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.narrationTask.update({
        where: { id: task.id },
        data: { status: 'APPROVED', approvedAt, revisionNotes: null },
      });
      await tx.approval.create({
        data: {
          projectId,
          type: 'VOICE_ACCEPT',
          decision: 'APPROVED',
          actorType: 'MANAGER',
          actorId: auth.userId,
        },
      });
      await tx.employeePayable.updateMany({
        where: { projectId, roleLabel: 'NARRATOR', status: 'ESTIMATED' },
        data: { status: 'CONFIRMED' },
      });
      await tx.project.update({
        where: { id: projectId },
        data: { status: 'PRODUCTION_EDITING', customerFacingStatus: 'IN_PRODUCTION' },
      });
      await tx.projectTimelineEvent.create({
        data: {
          projectId,
          type: 'VOICE_ACCEPT',
          title: 'تأیید نریشن صوتی',
          actorId: auth.userId,
        },
      });
      await rebuildProjectContext(projectId, tx);
    });

    if (task.narratorUserId) {
      await createNotificationOnce({
        ...buildNarrationApprovedNotification({
          projectId,
          projectTitle: task.project.title,
          projectCode: task.project.code,
          approvedAt,
        }),
        userId: task.narratorUserId,
        audience: 'INTERNAL',
      });
    }

    await writeAudit({
      userId: auth.userId,
      action: 'NARRATION_ACCEPT',
      entityType: 'NarrationTask',
      entityId: task.id,
      req,
    });

    return this.getProjectTask(projectId, auth);
  },

  async requestRevision(projectId, { notes }, auth, req) {
    const revisionNotes = String(notes || '').trim();
    if (!revisionNotes) {
      throw new AppError('توضیح اصلاح الزامی است', 400, 'REVISION_NOTES_REQUIRED');
    }

    const task = await prisma.narrationTask.findFirst({
      where: { projectId, status: 'NARRATION_SUBMITTED' },
      orderBy: { createdAt: 'desc' },
      include: { project: true },
    });
    if (!task) throw new AppError('نریشن ارسال‌شده‌ای برای اصلاح نیست', 404, 'NOT_FOUND');

    const requestedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.narrationTask.update({
        where: { id: task.id },
        data: {
          status: 'REVISION_REQUESTED',
          revisionNotes,
        },
      });
      await tx.approval.create({
        data: {
          projectId,
          type: 'VOICE_ACCEPT',
          decision: 'RETURNED',
          comment: revisionNotes,
          actorType: 'MANAGER',
          actorId: auth.userId,
        },
      });
      await tx.project.update({
        where: { id: projectId },
        data: { status: 'NARRATION_RECORDING', customerFacingStatus: 'IN_PRODUCTION' },
      });
      await tx.projectTimelineEvent.create({
        data: {
          projectId,
          type: 'VOICE_RETURN',
          title: 'درخواست اصلاح نریشن',
          body: revisionNotes,
          actorId: auth.userId,
        },
      });
    });

    if (task.narratorUserId) {
      await createNotificationOnce({
        ...buildNarrationRevisionRequestedNotification({
          projectId,
          projectTitle: task.project.title,
          projectCode: task.project.code,
          notes: revisionNotes,
          requestedAt,
        }),
        userId: task.narratorUserId,
        audience: 'INTERNAL',
      });
    }

    await writeAudit({
      userId: auth.userId,
      action: 'NARRATION_REVISION_REQUEST',
      entityType: 'NarrationTask',
      entityId: task.id,
      after: { notes: revisionNotes },
      req,
    });

    return this.getProjectTask(projectId, auth);
  },
};
