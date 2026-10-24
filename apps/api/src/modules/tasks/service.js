import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/response.js';
import { isFullAccessRole } from '../../services/permissions/catalog.js';
import { hasAnyPermission } from '../../services/permissions/effective.js';
import {
  ASSIGNABLE_ROLE_CODES,
  OPEN_TASK_STATUSES,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from './constants.js';
import {
  buildTaskStatusNotification,
  buildTaskUpdatedNotification,
  notifyTaskAssigned,
  notifyTaskDetailsChanged,
  notifyTaskStatusChange,
  notifyTaskUser,
  queueTaskNotify,
} from './notifications.js';

const userBriefSelect = {
  id: true,
  fullName: true,
  email: true,
  profileImage: true,
  role: { select: { code: true, name: true } },
};

const taskInclude = {
  assignee: { select: userBriefSelect },
  createdBy: { select: userBriefSelect },
  approvedBy: { select: userBriefSelect },
};

function canManageTasks(auth) {
  if (!auth) return false;
  if (isFullAccessRole(auth.roleCode)) return true;
  return hasAnyPermission(
    auth.permissions,
    ['tasks.manage', 'tasks.create', 'tasks.edit'],
    auth.roleCode,
  );
}

function canCreateTasks(auth) {
  if (!auth) return false;
  if (isFullAccessRole(auth.roleCode)) return true;
  return hasAnyPermission(auth.permissions, ['tasks.create'], auth.roleCode);
}

function canEditTasks(auth) {
  if (!auth) return false;
  if (isFullAccessRole(auth.roleCode)) return true;
  return hasAnyPermission(
    auth.permissions,
    ['tasks.edit', 'tasks.create'],
    auth.roleCode,
  );
}

function canApproveTasks(auth) {
  if (!auth) return false;
  if (isFullAccessRole(auth.roleCode)) return true;
  return hasAnyPermission(auth.permissions, ['tasks.manage'], auth.roleCode);
}

function canDeleteTasks(auth) {
  if (!auth) return false;
  if (isFullAccessRole(auth.roleCode)) return true;
  return hasAnyPermission(auth.permissions, ['tasks.delete'], auth.roleCode);
}

function parseDeadline(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError('مهلت وظیفه الزامی است', 400, 'TASK_DEADLINE_REQUIRED');
  }
  const raw = value.trim();
  const local = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (local) {
    const [, y, mo, d, h, mi, s] = local;
    const date = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s || 0),
    );
    if (Number.isNaN(date.getTime())) {
      throw new AppError('مهلت نامعتبر است', 400, 'TASK_DEADLINE_INVALID');
    }
    return date;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new AppError('مهلت نامعتبر است', 400, 'TASK_DEADLINE_INVALID');
  }
  return date;
}

function isOverdue(task, now = new Date()) {
  if (!task?.deadline) return false;
  if (!OPEN_TASK_STATUSES.includes(task.status)) return false;
  return new Date(task.deadline).getTime() < now.getTime();
}

function serializeTask(task, now = new Date()) {
  if (!task) return null;
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    statusLabel: TASK_STATUS_LABELS[task.status] || task.status,
    priorityLabel: TASK_PRIORITY_LABELS[task.priority] || task.priority,
    assigneeId: task.assigneeId,
    assignee: task.assignee
      ? {
          id: task.assignee.id,
          fullName: task.assignee.fullName,
          email: task.assignee.email,
          profileImage: task.assignee.profileImage,
          roleCode: task.assignee.role?.code || null,
          roleName: task.assignee.role?.name || null,
        }
      : null,
    createdById: task.createdById,
    createdBy: task.createdBy
      ? {
          id: task.createdBy.id,
          fullName: task.createdBy.fullName,
          email: task.createdBy.email,
          profileImage: task.createdBy.profileImage,
          roleCode: task.createdBy.role?.code || null,
        }
      : null,
    approvedById: task.approvedById,
    approvedBy: task.approvedBy
      ? {
          id: task.approvedBy.id,
          fullName: task.approvedBy.fullName,
          profileImage: task.approvedBy.profileImage,
        }
      : null,
    deadline: task.deadline,
    isOverdue: isOverdue(task, now),
    acceptedAt: task.acceptedAt,
    declinedAt: task.declinedAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    approvedAt: task.approvedAt,
    issueReportedAt: task.issueReportedAt,
    cancelledAt: task.cancelledAt,
    declineNote: task.declineNote,
    issueNote: task.issueNote,
    rejectionNote: task.rejectionNote,
    completionNote: task.completionNote,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    activities: Array.isArray(task.activities)
      ? task.activities.map((a) => ({
          id: a.id,
          action: a.action,
          fromStatus: a.fromStatus,
          toStatus: a.toStatus,
          message: a.message,
          meta: a.meta,
          createdAt: a.createdAt,
          actor: a.actor
            ? {
                id: a.actor.id,
                fullName: a.actor.fullName,
                profileImage: a.actor.profileImage,
              }
            : null,
        }))
      : undefined,
  };
}

async function recordActivity(tx, {
  taskId,
  actorId,
  action,
  fromStatus = null,
  toStatus = null,
  message = null,
  meta = null,
}) {
  return tx.managementTaskActivity.create({
    data: {
      taskId,
      actorId,
      action,
      fromStatus,
      toStatus,
      message,
      meta: meta || undefined,
    },
  });
}

async function getTaskOrThrow(id, { includeActivities = false } = {}) {
  const task = await prisma.managementTask.findFirst({
    where: { id, deletedAt: null },
    include: {
      ...taskInclude,
      ...(includeActivities
        ? {
            activities: {
              orderBy: { createdAt: 'desc' },
              take: 100,
              include: {
                actor: {
                  select: {
                    id: true,
                    fullName: true,
                    profileImage: true,
                  },
                },
              },
            },
          }
        : {}),
    },
  });
  if (!task) {
    throw new AppError('وظیفه یافت نشد', 404, 'TASK_NOT_FOUND');
  }
  return task;
}

/** Lightweight load for status transitions — avoids joined users until after update. */
async function getTaskCoreOrThrow(id) {
  const task = await prisma.managementTask.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      title: true,
      priority: true,
      status: true,
      assigneeId: true,
      createdById: true,
      startedAt: true,
      deadline: true,
    },
  });
  if (!task) {
    throw new AppError('وظیفه یافت نشد', 404, 'TASK_NOT_FOUND');
  }
  return task;
}

function assertCanViewTask(auth, task) {
  if (canManageTasks(auth)) return;
  if (task.assigneeId === auth.userId) return;
  if (task.createdById === auth.userId) return;
  throw new AppError('دسترسی به این وظیفه مجاز نیست', 403, 'TASK_FORBIDDEN');
}

function assertAssignee(auth, task) {
  if (task.assigneeId !== auth.userId) {
    throw new AppError('فقط کارمند مسئول می‌تواند این عمل را انجام دهد', 403, 'TASK_ASSIGNEE_ONLY');
  }
}

async function assertAssignableUser(assigneeId) {
  const user = await prisma.user.findFirst({
    where: {
      id: assigneeId,
      deletedAt: null,
      isActive: true,
      role: { code: { in: ASSIGNABLE_ROLE_CODES } },
    },
    select: { id: true, fullName: true, email: true },
  });
  if (!user) {
    throw new AppError('کارمند انتخاب‌شده معتبر نیست', 400, 'TASK_ASSIGNEE_INVALID');
  }
  return user;
}

function scopeWhere(auth, filters = {}) {
  const where = { deletedAt: null };

  if (!canManageTasks(auth)) {
    where.OR = [{ assigneeId: auth.userId }, { createdById: auth.userId }];
  }

  if (filters.q) {
    const q = String(filters.q).trim();
    if (q) {
      const search = {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      };
      where.AND = [...(where.AND || []), search];
    }
  }

  if (filters.status && TASK_STATUSES.includes(filters.status)) {
    where.status = filters.status;
  }

  if (filters.priority && TASK_PRIORITIES.includes(filters.priority)) {
    where.priority = filters.priority;
  }

  if (filters.assigneeId) {
    where.assigneeId = filters.assigneeId;
  }

  if (filters.overdue === 'true' || filters.overdue === true) {
    where.status = { in: OPEN_TASK_STATUSES };
    where.deadline = { lt: new Date() };
  }

  if (filters.mine === 'true' || filters.mine === true) {
    where.assigneeId = auth.userId;
  }

  return where;
}

export const createTaskSchema = z.object({
  title: z.string().trim().min(2, 'عنوان باید حداقل ۲ حرف باشد').max(200),
  description: z.string().trim().max(10000).optional().nullable(),
  assigneeId: z.string().min(1, 'کارمند مسئول الزامی است'),
  priority: z.enum(TASK_PRIORITIES).default('MEDIUM'),
  deadline: z.string().min(1, 'مهلت الزامی است'),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(10000).optional().nullable(),
    assigneeId: z.string().min(1).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    deadline: z.string().min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'حداقل یک فیلد برای ویرایش لازم است',
  });

export const noteSchema = z.object({
  note: z.string().trim().max(5000).optional().nullable(),
});

export const issueSchema = z.object({
  note: z.string().trim().min(2, 'توضیح مشکل الزامی است').max(5000),
});

export const rejectSchema = z.object({
  note: z.string().trim().min(2, 'دلیل رد تکمیل الزامی است').max(5000),
});

export const tasksService = {
  canManageTasks,
  canCreateTasks,
  canEditTasks,
  canApproveTasks,
  canDeleteTasks,

  async listAssignees(auth) {
    if (!canCreateTasks(auth) && !canEditTasks(auth) && !canManageTasks(auth)) {
      throw new AppError('دسترسی مجاز نیست', 403, 'FORBIDDEN');
    }
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        role: { code: { in: ASSIGNABLE_ROLE_CODES } },
      },
      select: userBriefSelect,
      orderBy: { fullName: 'asc' },
    });
    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      profileImage: u.profileImage,
      roleCode: u.role?.code || null,
      roleName: u.role?.name || null,
    }));
  },

  async stats(auth) {
    const base = scopeWhere(auth);
    const now = new Date();
    const [
      total,
      pending,
      accepted,
      inProgress,
      completed,
      approved,
      issueReported,
      overdue,
      byPriority,
      byAssignee,
    ] = await Promise.all([
      prisma.managementTask.count({ where: base }),
      prisma.managementTask.count({ where: { ...base, status: 'PENDING' } }),
      prisma.managementTask.count({ where: { ...base, status: 'ACCEPTED' } }),
      prisma.managementTask.count({ where: { ...base, status: 'IN_PROGRESS' } }),
      prisma.managementTask.count({ where: { ...base, status: 'COMPLETED' } }),
      prisma.managementTask.count({ where: { ...base, status: 'APPROVED' } }),
      prisma.managementTask.count({ where: { ...base, status: 'ISSUE_REPORTED' } }),
      prisma.managementTask.count({
        where: {
          ...base,
          status: { in: OPEN_TASK_STATUSES },
          deadline: { lt: now },
        },
      }),
      prisma.managementTask.groupBy({
        by: ['priority'],
        where: base,
        _count: { _all: true },
      }),
      canManageTasks(auth)
        ? prisma.managementTask.groupBy({
            by: ['assigneeId'],
            where: base,
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    let assigneeBreakdown = [];
    if (byAssignee.length) {
      const ids = byAssignee.map((row) => row.assigneeId);
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, fullName: true, profileImage: true },
      });
      const map = new Map(users.map((u) => [u.id, u]));
      assigneeBreakdown = byAssignee
        .map((row) => ({
          assigneeId: row.assigneeId,
          fullName: map.get(row.assigneeId)?.fullName || '—',
          profileImage: map.get(row.assigneeId)?.profileImage || null,
          count: row._count._all,
        }))
        .sort((a, b) => b.count - a.count);
    }

    return {
      total,
      pending,
      accepted,
      inProgress,
      completed,
      approved,
      issueReported,
      overdue,
      byPriority: Object.fromEntries(
        TASK_PRIORITIES.map((p) => [
          p,
          byPriority.find((row) => row.priority === p)?._count._all || 0,
        ]),
      ),
      byAssignee: assigneeBreakdown,
    };
  },

  async list(auth, {
    q,
    status,
    priority,
    assigneeId,
    overdue,
    mine,
    sort = 'deadline',
    order = 'asc',
    page = 1,
    pageSize = 20,
  } = {}) {
    const where = scopeWhere(auth, { q, status, priority, assigneeId, overdue, mine });
    const sortField = ['deadline', 'createdAt', 'priority', 'status', 'updatedAt'].includes(sort)
      ? sort
      : 'deadline';
    const sortOrder = order === 'desc' ? 'desc' : 'asc';
    const skip = (Math.max(1, page) - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.managementTask.findMany({
        where,
        include: taskInclude,
        orderBy: [{ [sortField]: sortOrder }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      prisma.managementTask.count({ where }),
    ]);

    const now = new Date();
    return {
      items: items.map((t) => serializeTask(t, now)),
      total,
      page,
      pageSize,
    };
  },

  async getById(auth, id) {
    const task = await getTaskOrThrow(id, { includeActivities: true });
    assertCanViewTask(auth, task);
    return serializeTask(task);
  },

  async create(auth, input) {
    if (!canCreateTasks(auth)) {
      throw new AppError('ایجاد وظیفه مجاز نیست', 403, 'FORBIDDEN');
    }
    await assertAssignableUser(input.assigneeId);
    const deadline = parseDeadline(input.deadline);

    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.managementTask.create({
        data: {
          title: input.title.trim(),
          description: input.description?.trim() || null,
          priority: input.priority || 'MEDIUM',
          status: 'PENDING',
          assigneeId: input.assigneeId,
          createdById: auth.userId,
          deadline,
        },
        include: taskInclude,
      });

      await recordActivity(tx, {
        taskId: created.id,
        actorId: auth.userId,
        action: 'CREATED',
        toStatus: 'PENDING',
        message: `وظیفه به ${created.assignee?.fullName || 'کارمند'} محول شد`,
      });

      return created;
    });

    queueTaskNotify(() => notifyTaskAssigned(task));
    return serializeTask(task);
  },

  async update(auth, id, input) {
    if (!canEditTasks(auth)) {
      throw new AppError('ویرایش وظیفه مجاز نیست', 403, 'FORBIDDEN');
    }
    const existing = await getTaskOrThrow(id);
    if (['APPROVED', 'CANCELLED'].includes(existing.status)) {
      throw new AppError('این وظیفه قابل ویرایش نیست', 400, 'TASK_LOCKED');
    }

    const data = {};
    const changes = [];

    if (input.title != null && input.title.trim() !== existing.title) {
      data.title = input.title.trim();
      changes.push('عنوان');
    }
    if (input.description !== undefined) {
      const next = input.description?.trim() || null;
      if (next !== existing.description) {
        data.description = next;
        changes.push('توضیحات');
      }
    }
    if (input.priority && input.priority !== existing.priority) {
      data.priority = input.priority;
      changes.push(`اولویت ← ${TASK_PRIORITY_LABELS[input.priority]}`);
    }
    if (input.deadline) {
      const deadline = parseDeadline(input.deadline);
      if (deadline.getTime() !== new Date(existing.deadline).getTime()) {
        data.deadline = deadline;
        changes.push('مهلت');
      }
    }

    let reassigned = false;
    if (input.assigneeId && input.assigneeId !== existing.assigneeId) {
      await assertAssignableUser(input.assigneeId);
      data.assigneeId = input.assigneeId;
      data.status = 'PENDING';
      data.acceptedAt = null;
      data.declinedAt = null;
      data.startedAt = null;
      data.completedAt = null;
      data.issueReportedAt = null;
      data.declineNote = null;
      data.issueNote = null;
      data.rejectionNote = null;
      data.completionNote = null;
      reassigned = true;
      changes.push('مسئول');
    }

    if (!Object.keys(data).length) {
      return serializeTask(existing);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.managementTask.update({
        where: { id },
        data,
        include: taskInclude,
      });

      await recordActivity(tx, {
        taskId: id,
        actorId: auth.userId,
        action: reassigned ? 'REASSIGNED' : 'UPDATED',
        fromStatus: existing.status,
        toStatus: row.status,
        message: changes.join('، '),
        meta: { changes },
      });

      return row;
    });

    const actorName = auth.user?.fullName || 'مدیر';
    const payload = buildTaskUpdatedNotification({
      task: updated,
      actorName,
      changes,
    });
    notifyTaskDetailsChanged({
      payload,
      actorUserId: auth.userId,
      assigneeId: updated.assigneeId,
      createdById: updated.createdById,
    });
    if (reassigned && existing.assigneeId !== updated.assigneeId) {
      queueTaskNotify(() => notifyTaskAssigned(updated));
    }

    return serializeTask(updated);
  },

  async accept(auth, id) {
    const task = await getTaskCoreOrThrow(id);
    assertAssignee(auth, task);
    if (task.status !== 'PENDING') {
      throw new AppError('فقط وظایف در انتظار پذیرش قابل قبول هستند', 400, 'TASK_INVALID_TRANSITION');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.managementTask.update({
        where: { id },
        data: { status: 'ACCEPTED', acceptedAt: new Date(), declinedAt: null, declineNote: null },
        include: taskInclude,
      });
      await recordActivity(tx, {
        taskId: id,
        actorId: auth.userId,
        action: 'ACCEPTED',
        fromStatus: 'PENDING',
        toStatus: 'ACCEPTED',
      });
      return row;
    });

    notifyTaskStatusChange({
      payload: buildTaskStatusNotification({
        task: updated,
        actorName: updated.assignee?.fullName,
        status: 'ACCEPTED',
        eventSuffix: `accepted:${Date.now()}`,
        title: 'وظیفه پذیرفته شد',
      }),
      actorUserId: auth.userId,
      createdById: updated.createdById,
    });
    return serializeTask(updated);
  },

  async decline(auth, id, { note } = {}) {
    const task = await getTaskCoreOrThrow(id);
    assertAssignee(auth, task);
    if (task.status !== 'PENDING') {
      throw new AppError('فقط وظایف در انتظار پذیرش قابل رد هستند', 400, 'TASK_INVALID_TRANSITION');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.managementTask.update({
        where: { id },
        data: {
          status: 'DECLINED',
          declinedAt: new Date(),
          declineNote: note?.trim() || null,
        },
        include: taskInclude,
      });
      await recordActivity(tx, {
        taskId: id,
        actorId: auth.userId,
        action: 'DECLINED',
        fromStatus: 'PENDING',
        toStatus: 'DECLINED',
        message: note?.trim() || null,
      });
      return row;
    });

    notifyTaskStatusChange({
      payload: buildTaskStatusNotification({
        task: updated,
        actorName: updated.assignee?.fullName,
        status: 'DECLINED',
        eventSuffix: `declined:${Date.now()}`,
        title: 'وظیفه توسط کارمند رد شد',
        extraLines: note?.trim() ? [`توضیح: ${note.trim()}`] : [],
      }),
      actorUserId: auth.userId,
      createdById: updated.createdById,
    });
    return serializeTask(updated);
  },

  async start(auth, id) {
    const task = await getTaskCoreOrThrow(id);
    assertAssignee(auth, task);
    if (!['ACCEPTED', 'ISSUE_REPORTED'].includes(task.status)) {
      throw new AppError(
        'برای شروع کار، وظیفه باید پذیرفته شده یا در وضعیت گزارش مشکل باشد',
        400,
        'TASK_INVALID_TRANSITION',
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.managementTask.update({
        where: { id },
        data: {
          status: 'IN_PROGRESS',
          startedAt: task.startedAt || new Date(),
        },
        include: taskInclude,
      });
      await recordActivity(tx, {
        taskId: id,
        actorId: auth.userId,
        action: 'STARTED',
        fromStatus: task.status,
        toStatus: 'IN_PROGRESS',
      });
      return row;
    });

    notifyTaskStatusChange({
      payload: buildTaskStatusNotification({
        task: updated,
        actorName: updated.assignee?.fullName,
        status: 'IN_PROGRESS',
        eventSuffix: `started:${Date.now()}`,
        title: 'وظیفه در حال انجام است',
      }),
      actorUserId: auth.userId,
      createdById: updated.createdById,
    });
    return serializeTask(updated);
  },

  async complete(auth, id, { note } = {}) {
    const task = await getTaskCoreOrThrow(id);
    assertAssignee(auth, task);
    if (!['ACCEPTED', 'IN_PROGRESS', 'ISSUE_REPORTED'].includes(task.status)) {
      throw new AppError('وضعیت فعلی اجازه تکمیل ندارد', 400, 'TASK_INVALID_TRANSITION');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.managementTask.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          completionNote: note?.trim() || null,
        },
        include: taskInclude,
      });
      await recordActivity(tx, {
        taskId: id,
        actorId: auth.userId,
        action: 'COMPLETED',
        fromStatus: task.status,
        toStatus: 'COMPLETED',
        message: note?.trim() || null,
      });
      return row;
    });

    notifyTaskStatusChange({
      payload: buildTaskStatusNotification({
        task: updated,
        actorName: updated.assignee?.fullName,
        status: 'COMPLETED',
        eventSuffix: `completed:${Date.now()}`,
      title: 'وظیفه برای تأیید ارسال شد',
      extraLines: note?.trim() ? [`یادداشت: ${note.trim()}`] : [],
      }),
      actorUserId: auth.userId,
      createdById: updated.createdById,
    });
    return serializeTask(updated);
  },

  async reportIssue(auth, id, { note }) {
    const task = await getTaskCoreOrThrow(id);
    assertAssignee(auth, task);
    if (!['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(task.status)) {
      throw new AppError('گزارش مشکل در این وضعیت مجاز نیست', 400, 'TASK_INVALID_TRANSITION');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.managementTask.update({
        where: { id },
        data: {
          status: 'ISSUE_REPORTED',
          issueReportedAt: new Date(),
          issueNote: note.trim(),
        },
        include: taskInclude,
      });
      await recordActivity(tx, {
        taskId: id,
        actorId: auth.userId,
        action: 'ISSUE_REPORTED',
        fromStatus: task.status,
        toStatus: 'ISSUE_REPORTED',
        message: note.trim(),
      });
      return row;
    });

    notifyTaskStatusChange({
      payload: buildTaskStatusNotification({
        task: updated,
        actorName: updated.assignee?.fullName,
        status: 'ISSUE_REPORTED',
        eventSuffix: `issue:${Date.now()}`,
        title: 'گزارش مشکل / درخواست بازنگری وظیفه',
        extraLines: [`توضیح: ${note.trim()}`],
      }),
      actorUserId: auth.userId,
      createdById: updated.createdById,
    });
    return serializeTask(updated);
  },

  async approve(auth, id, { note } = {}) {
    if (!canApproveTasks(auth)) {
      throw new AppError('تأیید وظیفه مجاز نیست', 403, 'FORBIDDEN');
    }
    const task = await getTaskCoreOrThrow(id);
    if (task.status !== 'COMPLETED') {
      throw new AppError('فقط وظایف در انتظار تأیید قابل تأیید نهایی هستند', 400, 'TASK_INVALID_TRANSITION');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.managementTask.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedById: auth.userId,
          rejectionNote: null,
        },
        include: taskInclude,
      });
      await recordActivity(tx, {
        taskId: id,
        actorId: auth.userId,
        action: 'APPROVED',
        fromStatus: 'COMPLETED',
        toStatus: 'APPROVED',
        message: note?.trim() || null,
      });
      return row;
    });

    const payload = buildTaskStatusNotification({
      task: updated,
      actorName: auth.user?.fullName || 'مدیر',
      status: 'APPROVED',
      eventSuffix: `approved:${Date.now()}`,
      title: 'وظیفه تکمیل شد',
      extraLines: note?.trim() ? [`یادداشت مدیر: ${note.trim()}`] : [],
    });
    notifyTaskUser(updated.assigneeId, payload);
    return serializeTask(updated);
  },

  async rejectCompletion(auth, id, { note }) {
    if (!canApproveTasks(auth)) {
      throw new AppError('رد تکمیل وظیفه مجاز نیست', 403, 'FORBIDDEN');
    }
    const task = await getTaskCoreOrThrow(id);
    if (task.status !== 'COMPLETED') {
      throw new AppError('فقط وظایف در انتظار تأیید قابل رد هستند', 400, 'TASK_INVALID_TRANSITION');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.managementTask.update({
        where: { id },
        data: {
          status: 'IN_PROGRESS',
          completedAt: null,
          rejectionNote: note.trim(),
          approvedById: null,
          approvedAt: null,
        },
        include: taskInclude,
      });
      await recordActivity(tx, {
        taskId: id,
        actorId: auth.userId,
        action: 'COMPLETION_REJECTED',
        fromStatus: 'COMPLETED',
        toStatus: 'IN_PROGRESS',
        message: note.trim(),
      });
      return row;
    });

    const payload = buildTaskStatusNotification({
      task: updated,
      actorName: auth.user?.fullName || 'مدیر',
      status: 'IN_PROGRESS',
      eventSuffix: `reject:${Date.now()}`,
      title: 'تکمیل وظیفه رد شد — نیاز به کار بیشتر',
      extraLines: [`دلیل: ${note.trim()}`],
    });
    payload.meta.type = 'TASK_COMPLETION_REJECTED';
    notifyTaskUser(updated.assigneeId, payload);
    return serializeTask(updated);
  },

  async cancel(auth, id, { note } = {}) {
    if (!canEditTasks(auth) && !canManageTasks(auth)) {
      throw new AppError('لغو وظیفه مجاز نیست', 403, 'FORBIDDEN');
    }
    const task = await getTaskCoreOrThrow(id);
    if (['APPROVED', 'CANCELLED'].includes(task.status)) {
      throw new AppError('این وظیفه قابل لغو نیست', 400, 'TASK_INVALID_TRANSITION');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.managementTask.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
        include: taskInclude,
      });
      await recordActivity(tx, {
        taskId: id,
        actorId: auth.userId,
        action: 'CANCELLED',
        fromStatus: task.status,
        toStatus: 'CANCELLED',
        message: note?.trim() || null,
      });
      return row;
    });

    const payload = buildTaskStatusNotification({
      task: updated,
      actorName: auth.user?.fullName || 'مدیر',
      status: 'CANCELLED',
      eventSuffix: `cancelled:${Date.now()}`,
      title: 'وظیفه لغو شد',
      extraLines: note?.trim() ? [`توضیح: ${note.trim()}`] : [],
    });
    notifyTaskUser(updated.assigneeId, payload);
    return serializeTask(updated);
  },

  async softDelete(auth, id) {
    if (!canDeleteTasks(auth)) {
      throw new AppError('حذف وظیفه مجاز نیست', 403, 'FORBIDDEN');
    }
    const task = await getTaskOrThrow(id);
    await prisma.$transaction(async (tx) => {
      await tx.managementTask.update({
        where: { id },
        data: { deletedAt: new Date(), status: task.status === 'CANCELLED' ? task.status : 'CANCELLED' },
      });
      await recordActivity(tx, {
        taskId: id,
        actorId: auth.userId,
        action: 'DELETED',
        fromStatus: task.status,
        toStatus: 'CANCELLED',
      });
    });
    return { id, deleted: true };
  },
};
