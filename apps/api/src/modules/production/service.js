import { prisma } from "../../db/prisma.js";
import { AppError } from "../../utils/response.js";
import { writeAudit } from "../../middleware/audit.js";
import { rebuildProjectContext } from "../../services/projectContext.js";
import {
  parseAssignmentAmount,
  upsertLaborPayable,
  syncProjectLaborCosts,
} from "../../services/assignmentFinance.js";
import {
  createNotificationOnce,
  notifyManagersOnce,
  buildEditingAssignedNotification,
  buildEditingSubmittedNotification,
  buildEditingRevisionRequestedNotification,
  buildEditingCompletedNotification,
  buildEditingReadyForCustomerNotification,
  buildEditingManagerFeedbackNotification,
  buildFinalVideoUploadedNotification,
  buildFinalVideoUploadConfirmedNotification,
  buildFinalVideoApprovedNotification,
  buildFinalVideoRevisionRequestedNotification,
} from "../../services/notifications.js";
import { serializeEditorTaskSummary } from "./editorView.js";
import {
  VIDEO_TYPE_LABELS,
  buildFinalFileMeta,
  markApprovedMeta,
  markRevisionRequestedMeta,
  markSentMeta,
  markViewedMeta,
  serializeFinalVideo,
  isSentToCustomer,
  resolveVideoStatus,
} from "./finalProduct.js";
import { mergeStorageMeta } from "../../services/storage/media-manager.js";

const ACTIVE_EDITING = [
  "ASSIGNED",
  "IN_PROGRESS",
  "REVIEW_REQUIRED",
  "REVISION_REQUESTED",
];

async function ensureNarrationTakeHistory(taskId, projectId, tx = prisma) {
  const count = await tx.narrationTake.count({ where: { taskId } });
  if (count > 0) return false;

  const files = await tx.projectFile.findMany({
    where: {
      projectId,
      kind: "AUDIO",
      deletedAt: null,
      meta: { path: ["narrationTaskId"], equals: taskId },
    },
    orderBy: [{ createdAt: "asc" }, { version: "asc" }],
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

async function loadProjectNarrationAudio(projectId, mapFile) {
  let narrationTask = await prisma.narrationTask.findFirst({
    where: { projectId, status: "APPROVED" },
    orderBy: { approvedAt: "desc" },
    include: {
      audioFile: true,
      takes: {
        orderBy: { version: "asc" },
        include: { projectFile: true },
      },
    },
  });

  if (!narrationTask) return null;

  const backfilled = await ensureNarrationTakeHistory(
    narrationTask.id,
    projectId,
  );
  if (backfilled) {
    narrationTask = await prisma.narrationTask.findFirst({
      where: { id: narrationTask.id },
      include: {
        audioFile: true,
        takes: {
          orderBy: { version: "asc" },
          include: { projectFile: true },
        },
      },
    });
  }

  if (!narrationTask) return null;

  const currentFileId = narrationTask.audioFileId;
  const rawTakes = narrationTask.takes?.length
    ? narrationTask.takes
    : narrationTask.audioFile
      ? [
          {
            id: narrationTask.audioFile.id,
            version: narrationTask.audioFile.version ?? 1,
            createdAt: narrationTask.audioFile.createdAt,
            projectFile: narrationTask.audioFile,
            projectFileId: narrationTask.audioFile.id,
          },
        ]
      : [];

  const takes = rawTakes
    .map((take) => {
      const file = take.projectFile;
      if (!file) return null;
      return {
        id: take.id,
        version: take.version,
        createdAt: take.createdAt,
        isCurrent:
          take.projectFileId === currentFileId || file.id === currentFileId,
        audioFile: mapFile(file),
      };
    })
    .filter(Boolean);

  // Editors (and production handoff) only receive the manager-approved current take.
  const approvedTakes = takes.filter((take) => take.isCurrent);
  const handoffTakes =
    approvedTakes.length > 0
      ? approvedTakes
      : currentFileId
        ? takes.filter((take) => take.audioFile?.id === currentFileId)
        : takes.slice(-1);

  if (!handoffTakes.length) return null;

  return {
    approvedAt: narrationTask.approvedAt,
    approvedFileId: currentFileId,
    takes: handoffTakes,
  };
}

const editorTaskInclude = {
  assignedBy: { select: { id: true, fullName: true } },
  project: {
    select: {
      id: true,
      title: true,
    },
  },
};

async function loadEditorAssignment(projectId, userId) {
  if (!userId) return null;
  return prisma.projectAssignment.findFirst({
    where: {
      projectId,
      role: "EDITOR",
      userId,
      isActive: true,
    },
    select: { createdAt: true, deadlineAt: true },
    orderBy: { createdAt: "desc" },
  });
}

async function hydrateEditorSummaries(tasks, userId) {
  if (!tasks.length) return [];
  const projectIds = [
    ...new Set(tasks.map((t) => t.projectId).filter(Boolean)),
  ];
  const assignments = userId
    ? await prisma.projectAssignment.findMany({
        where: {
          projectId: { in: projectIds },
          role: "EDITOR",
          userId,
          isActive: true,
        },
        select: { projectId: true, createdAt: true, deadlineAt: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const byProject = new Map();
  for (const a of assignments) {
    if (!byProject.has(a.projectId)) byProject.set(a.projectId, a);
  }
  return tasks.map((task) =>
    serializeEditorTaskSummary(task, byProject.get(task.projectId) || null),
  );
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfWeek(d = new Date()) {
  const day = d.getDay();
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
  if (!dateFilter || dateFilter === "all") return true;
  if (!assignedAt) return false;
  const t = new Date(assignedAt).getTime();
  if (dateFilter === "today") return t >= startOfDay().getTime();
  if (dateFilter === "week") return t >= startOfWeek().getTime();
  if (dateFilter === "month") return t >= startOfMonth().getTime();
  if (dateFilter === "custom") {
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
  if (!status || status === "all") return null;
  const map = {
    new: "ASSIGNED",
    pending: "ASSIGNED",
    ASSIGNED: "ASSIGNED",
    in_progress: "IN_PROGRESS",
    IN_PROGRESS: "IN_PROGRESS",
    submitted: "REVIEW_REQUIRED",
    REVIEW_REQUIRED: "REVIEW_REQUIRED",
    revision: "REVISION_REQUESTED",
    REVISION_REQUESTED: "REVISION_REQUESTED",
    completed: "COMPLETED",
    approved: "COMPLETED",
    COMPLETED: "COMPLETED",
  };
  return map[status] || status;
}

function priorityFilterMap(priority) {
  if (!priority || priority === "all") return null;
  const map = {
    high: ["OVERDUE", "HIGH"],
    medium: ["MEDIUM"],
    low: ["NORMAL"],
    OVERDUE: ["OVERDUE"],
    HIGH: ["HIGH"],
    MEDIUM: ["MEDIUM"],
    NORMAL: ["NORMAL"],
  };
  return map[priority] || [priority];
}

const taskInclude = {
  editorUser: { select: { id: true, fullName: true, email: true } },
  editorTeamProfile: {
    select: { id: true, displayName: true, realName: true },
  },
  assignedBy: { select: { id: true, fullName: true } },
  watermarkedFile: true,
  cleanFile: true,
  project: {
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      deadlineAt: true,
      brief: true,
      videoRevisionUsed: true,
      videoRevisionMax: true,
      extraVideoRevision: true,
    },
  },
};

function canAccessAsEditor(task, auth) {
  if (auth.roleCode === "MANAGER" || auth.roleCode === "ADMIN") return true;
  if (auth.roleCode !== "EDITOR") return false;
  return task.editorUserId === auth.userId;
}

async function nextFinalVersion(projectId, tx = prisma) {
  const latest = await tx.projectFile.findFirst({
    where: { projectId, kind: "WATERMARKED_FINAL", deletedAt: null },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (latest?.version || 0) + 1;
}

export const productionService = {
  async listAvailableEditors() {
    return prisma.teamProfile.findMany({
      where: {
        kind: "EDITOR",
        status: "ACTIVE",
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, isActive: true },
        },
        rates: { where: { isActive: true }, take: 3 },
      },
      orderBy: { displayName: "asc" },
    });
  },

  async listMyTasks(auth) {
    if (
      auth.roleCode !== "EDITOR" &&
      auth.roleCode !== "MANAGER" &&
      auth.roleCode !== "ADMIN"
    ) {
      throw new AppError("Forbidden", 403, "FORBIDDEN");
    }
    const where =
      auth.roleCode === "EDITOR"
        ? { editorUserId: auth.userId, status: { in: ACTIVE_EDITING } }
        : { status: { in: ACTIVE_EDITING } };

    const tasks = await prisma.editingTask.findMany({
      where,
      include: taskInclude,
      orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }],
    });

    if (auth.roleCode === "EDITOR") {
      return hydrateEditorSummaries(tasks, auth.userId);
    }
    return tasks;
  },

  async getEditorDashboard(auth) {
    if (auth.roleCode !== "EDITOR") {
      throw new AppError("این داشبورد مخصوص ادیتور است", 403, "FORBIDDEN");
    }

    const tasks = await prisma.editingTask.findMany({
      where: { editorUserId: auth.userId },
      orderBy: [{ updatedAt: "desc" }],
      include: editorTaskInclude,
    });
    const items = await hydrateEditorSummaries(tasks, auth.userId);
    const now = Date.now();
    const monthStart = startOfMonth().getTime();

    const stats = {
      total: items.length,
      pending: items.filter((t) => t.status === "ASSIGNED").length,
      inProgress: items.filter((t) => t.status === "IN_PROGRESS").length,
      submitted: items.filter((t) => t.status === "REVIEW_REQUIRED").length,
      revisionRequested: items.filter((t) => t.status === "REVISION_REQUESTED")
        .length,
      completed: items.filter((t) => t.status === "COMPLETED").length,
      overdue: items.filter((t) => t.overdue).length,
      completedThisMonth: items.filter(
        (t) =>
          t.status === "COMPLETED" &&
          t.completedAt &&
          new Date(t.completedAt).getTime() >= monthStart,
      ).length,
      totalEarnings: items
        .filter((t) => t.status === "COMPLETED" && t.assignedAmount != null)
        .reduce((sum, t) => sum + Number(t.assignedAmount || 0), 0),
      estimatedEarnings: items
        .filter((t) => t.assignedAmount != null)
        .reduce((sum, t) => sum + Number(t.assignedAmount || 0), 0),
    };

    const recent = [...items]
      .sort(
        (a, b) =>
          new Date(b.assignedAt || 0).getTime() -
          new Date(a.assignedAt || 0).getTime(),
      )
      .slice(0, 6);

    const upcomingDeadlines = items
      .filter(
        (t) =>
          t.deadline && !["COMPLETED", "REVIEW_REQUIRED"].includes(t.status),
      )
      .map((t) => ({
        ...t,
        remainingMs: new Date(t.deadline).getTime() - now,
      }))
      .sort((a, b) => a.remainingMs - b.remainingMs)
      .slice(0, 8);

    return {
      stats,
      recent,
      upcomingDeadlines,
    };
  },

  async listEditorProjects(auth, query = {}) {
    if (auth.roleCode !== "EDITOR") {
      throw new AppError(
        "فقط ادیتور به فهرست پروژه‌های ادیت دسترسی دارد",
        403,
        "FORBIDDEN",
      );
    }

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(query.pageSize, 10) || 12),
    );
    const q = String(query.q || "")
      .trim()
      .toLowerCase();
    const status = statusFilterMap(query.status);
    const dateFilter = String(query.date || "all");
    const from = query.from || null;
    const to = query.to || null;
    const priorityMatch = priorityFilterMap(query.priority);

    const tasks = await prisma.editingTask.findMany({
      where: {
        editorUserId: auth.userId,
        ...(status ? { status } : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      include: editorTaskInclude,
    });

    let items = await hydrateEditorSummaries(tasks, auth.userId);

    if (q) {
      items = items.filter((t) => {
        const hay =
          `${t.title} ${t.instructionsPreview || ""} ${t.status}`.toLowerCase();
        return hay.includes(q);
      });
    }

    items = items.filter((t) =>
      matchesDateFilter(t.assignedAt, dateFilter, from, to),
    );

    if (priorityMatch) {
      items = items.filter((t) => priorityMatch.includes(t.priority));
    }

    items.sort(
      (a, b) =>
        new Date(b.assignedAt || 0).getTime() -
        new Date(a.assignedAt || 0).getTime(),
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

  async getProjectTask(projectId, auth) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      include: {
        assignments: {
          where: { isActive: true },
          include: {
            user: { select: { id: true, fullName: true, email: true } },
            teamProfile: {
              select: { id: true, displayName: true, userId: true },
            },
          },
        },
        format: true,
        service: { select: { id: true, name: true } },
        crmCustomer: {
          select: {
            id: true,
            personName: true,
            companyName: true,
            jobTitle: true,
            phone: true,
            email: true,
            address: true,
            city: true,
            normalizedWhatsapp: true,
            whatsappRaw: true,
            notes: true,
          },
        },
        contentVersions: {
          where: {
            OR: [
              { status: "APPROVED", publishedToClient: true },
              { status: "APPROVED" },
            ],
          },
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
        files: {
          where: {
            deletedAt: null,
            kind: {
              in: [
                "AUDIO",
                "WATERMARKED_FINAL",
                "CLEAN_FINAL",
                "WORKING",
                "PROMPT_LOG",
              ],
            },
          },
          orderBy: { createdAt: "desc" },
        },
        assetRefs: { include: { clientAsset: true } },
        feedback: {
          where: { scope: { in: ["FINAL_VIDEO", "CONTENT"] } },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        approvals: {
          where: {
            type: { in: ["MANAGER_FINAL", "CLIENT_FINAL", "VOICE_ACCEPT"] },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });
    if (!project) throw new AppError("پروژه یافت نشد", 404, "NOT_FOUND");

    if (auth.roleCode === "EDITOR") {
      const assigned = project.assignments.some(
        (a) =>
          a.role === "EDITOR" &&
          a.isActive &&
          (a.userId === auth.userId || a.teamProfile?.userId === auth.userId),
      );
      if (!assigned)
        throw new AppError("دسترسی به این پروژه ندارید", 403, "FORBIDDEN");
    }

    let task = await prisma.editingTask.findFirst({
      where: { projectId },
      include: taskInclude,
      orderBy: { createdAt: "desc" },
    });

    // Auto-hydrate task from active editor assignment if missing and project is in production
    if (
      !task &&
      [
        "PRODUCTION_EDITING",
        "MANAGER_FINAL_REVIEW",
        "FINAL_REVISION",
        "WAITING_CLIENT_FINAL_APPROVAL",
      ].includes(project.status)
    ) {
      const editorAssign = project.assignments.find(
        (a) => a.role === "EDITOR" && a.isActive,
      );
      if (editorAssign) {
        task = await prisma.editingTask.create({
          data: {
            projectId,
            editorUserId:
              editorAssign.userId || editorAssign.teamProfile?.userId || null,
            editorTeamProfileId: editorAssign.teamProfileId,
            assignedById: editorAssign.assignedById || null,
            status:
              project.status === "FINAL_REVISION"
                ? "REVISION_REQUESTED"
                : "ASSIGNED",
            deadline: editorAssign.deadlineAt,
            instructions: editorAssign.notes,
          },
          include: taskInclude,
        });
      }
    }

    const approvedContent = project.contentVersions[0] || null;
    const voiceFiles = project.files.filter((f) => f.kind === "AUDIO");
    const watermarkedFiles = project.files.filter(
      (f) => f.kind === "WATERMARKED_FINAL",
    );
    const cleanFiles = project.files.filter((f) => f.kind === "CLEAN_FINAL");
    const workingFiles = project.files.filter((f) => f.kind === "WORKING");
    const promptLogs = project.files.filter((f) => f.kind === "PROMPT_LOG");

    const uploaderIds = [
      ...new Set(project.files.map((f) => f.uploadedBy).filter(Boolean)),
    ];
    const uploaders = uploaderIds.length
      ? await prisma.user.findMany({
          where: { id: { in: uploaderIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const uploaderMap = Object.fromEntries(
      uploaders.map((u) => [u.id, u.fullName]),
    );

    const mapFile = (f) => ({
      id: f.id,
      name: f.name,
      kind: f.kind,
      storageKey: f.storageKey,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
      version: f.version,
      uploadedBy: f.uploadedBy,
      uploadedByName: f.uploadedBy ? uploaderMap[f.uploadedBy] || null : null,
      createdAt: f.createdAt,
      meta: f.meta,
    });

    const narrationAudio = await loadProjectNarrationAudio(projectId, mapFile);
    const approvedVoiceFiles = narrationAudio?.approvedFileId
      ? voiceFiles.filter((f) => f.id === narrationAudio.approvedFileId)
      : narrationAudio?.takes?.length
        ? voiceFiles.filter((f) =>
            narrationAudio.takes.some((t) => t.audioFile?.id === f.id),
          )
        : [];

    const materials = {
      brief: project.brief,
      approvedContent: approvedContent
        ? {
            id: approvedContent.id,
            versionNumber: approvedContent.versionNumber,
            scenario: approvedContent.scenario,
            narration: approvedContent.narration,
            storyboard: approvedContent.storyboard,
            status: approvedContent.status,
          }
        : null,
      clientAssets: project.assetRefs.map((r) => r.clientAsset),
      // Production/editor handoff: only manager-approved narration audio
      voiceFiles: approvedVoiceFiles.map(mapFile),
      narrationAudio,
      customerFeedback: project.feedback,
      approvals: project.approvals,
    };

    // Clean files: managers see all; editors see their own uploads for the assigned project
    const cleanForRole =
      auth.roleCode === "EDITOR"
        ? cleanFiles
        : auth.roleCode === "MANAGER" || auth.roleCode === "ADMIN"
          ? cleanFiles
          : [];

    const rawAssignment =
      project.assignments.find((a) => a.role === "EDITOR" && a.isActive) ||
      null;

    const editorAssignment =
      auth.roleCode === "EDITOR" && rawAssignment
        ? {
            id: rawAssignment.id,
            role: rawAssignment.role,
            deadlineAt: rawAssignment.deadlineAt,
            notes: rawAssignment.notes,
            status: rawAssignment.status,
            createdAt: rawAssignment.createdAt,
          }
        : rawAssignment;

    const taskForRole =
      auth.roleCode === "EDITOR" && task
        ? {
            ...task,
            assignedBy: task.assignedBy
              ? { id: task.assignedBy.id, fullName: task.assignedBy.fullName }
              : null,
            editorUser: undefined,
            editorTeamProfile: undefined,
          }
        : task;

    return {
      task: taskForRole,
      materials,
      productionFiles: {
        watermarked: watermarkedFiles.map(mapFile),
        clean: cleanForRole.map(mapFile),
        working: workingFiles.map(mapFile),
        promptLogs: promptLogs.map(mapFile),
      },
      project: {
        id: project.id,
        code: project.code,
        title: project.title,
        status: project.status,
        deadlineAt: project.deadlineAt,
        videoRevisionUsed: project.videoRevisionUsed,
        videoRevisionMax: project.videoRevisionMax,
        extraVideoRevision: project.extraVideoRevision,
        language: project.language,
        tone: project.tone,
        durationSec: project.durationSec,
        platforms: project.platforms,
        brief: project.brief,
        format: project.format
          ? {
              id: project.format.id,
              name: project.format.name,
              ratio: project.format.ratio,
            }
          : null,
        service: project.service
          ? { id: project.service.id, name: project.service.name }
          : null,
        crmCustomer: project.crmCustomer
          ? {
              id: project.crmCustomer.id,
              personName: project.crmCustomer.personName,
              companyName: project.crmCustomer.companyName,
              jobTitle: project.crmCustomer.jobTitle,
              phone: project.crmCustomer.phone,
              email: project.crmCustomer.email,
              address: project.crmCustomer.address,
              city: project.crmCustomer.city,
              normalizedWhatsapp: project.crmCustomer.normalizedWhatsapp,
              whatsappRaw: project.crmCustomer.whatsappRaw,
              notes: project.crmCustomer.notes,
            }
          : null,
        assignments: project.assignments?.map((a) => ({
          role: a.role,
          teamProfile: a.teamProfile
            ? { displayName: a.teamProfile.displayName }
            : null,
        })),
      },
      editorAssignment,
    };
  },

  async assignEditor(
    projectId,
    { editorProfileId, deadline, instructions, editingCost, amount },
    auth,
    req,
  ) {
    if (!editorProfileId)
      throw new AppError("انتخاب ادیتور الزامی است", 400, "EDITOR_REQUIRED");

    const assignedAmount = parseAssignmentAmount(editingCost ?? amount, {
      fieldLabel: "هزینه ادیت",
    });

    const profile = await prisma.teamProfile.findFirst({
      where: {
        id: editorProfileId,
        kind: "EDITOR",
        status: "ACTIVE",
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
      },
      include: { user: true },
    });
    if (!profile)
      throw new AppError("ادیتور یافت نشد یا غیرفعال است", 404, "NOT_FOUND");

    const deadlineAt = deadline
      ? new Date(deadline)
      : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(deadlineAt.getTime())) {
      throw new AppError("مهلت نامعتبر است", 400, "INVALID_DEADLINE");
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, title: true, code: true, status: true },
    });
    if (!project) throw new AppError("پروژه یافت نشد", 404, "NOT_FOUND");

    const narrationAudio = await loadProjectNarrationAudio(projectId, (f) => ({
      id: f.id,
      name: f.name,
      version: f.version,
    }));

    const productionReady = [
      "PRODUCTION_EDITING",
      "MANAGER_FINAL_REVIEW",
      "FINAL_REVISION",
      "NARRATION_RECORDING",
      "WAITING_CLIENT_CONTENT_APPROVAL",
      "CONTENT_GENERATION",
      "INTERNAL_CONTENT_REVIEW",
      "NEW_MANAGER_REVIEW",
    ].includes(project.status);

    if (!productionReady && project.status === "CANCELED") {
      throw new AppError(
        "امکان ارجاع ادیتور برای این وضعیت وجود ندارد",
        400,
        "INVALID_STATUS",
      );
    }

    const assignedAt = new Date();
    const task = await prisma.$transaction(async (tx) => {
      await tx.projectAssignment.updateMany({
        where: { projectId, role: "EDITOR", isActive: true },
        data: { isActive: false },
      });

      await tx.projectAssignment.create({
        data: {
          projectId,
          role: "EDITOR",
          teamProfileId: profile.id,
          userId: profile.userId,
          assignedById: auth.userId,
          deadlineAt,
          notes: instructions?.trim() || null,
          isActive: true,
        },
      });

      await upsertLaborPayable(tx, {
        projectId,
        teamProfileId: profile.id,
        roleLabel: "EDITOR",
        amount: assignedAmount,
      });

      // Move into production editing when already past narration or in revision/review
      if (
        [
          "PRODUCTION_EDITING",
          "MANAGER_FINAL_REVIEW",
          "FINAL_REVISION",
          "WAITING_CLIENT_FINAL_APPROVAL",
        ].includes(project.status)
      ) {
        await tx.project.update({
          where: { id: projectId },
          data: {
            status:
              project.status === "FINAL_REVISION"
                ? "FINAL_REVISION"
                : "PRODUCTION_EDITING",
            customerFacingStatus:
              project.status === "FINAL_REVISION"
                ? "FINAL_REVIEW"
                : "IN_PRODUCTION",
          },
        });
      }

      await tx.editingTask.updateMany({
        where: { projectId, status: { in: ACTIVE_EDITING } },
        data: { status: "COMPLETED", completedAt: new Date() },
      });

      const created = await tx.editingTask.create({
        data: {
          projectId,
          editorUserId: profile.userId,
          editorTeamProfileId: profile.id,
          assignedById: auth.userId,
          status:
            project.status === "FINAL_REVISION"
              ? "REVISION_REQUESTED"
              : "ASSIGNED",
          deadline: deadlineAt,
          instructions: instructions?.trim() || null,
          assignedAmount,
        },
        include: taskInclude,
      });

      await syncProjectLaborCosts(tx, projectId);

      await tx.projectTimelineEvent.create({
        data: {
          projectId,
          type: "EDITOR_ASSIGNED",
          title: "ارجاع پروژه به ادیتور",
          body: [
            `${profile.displayName} — ${assignedAmount} AFN`,
            instructions?.trim() || null,
            narrationAudio
              ? `فایل صوتی نریشن تأییدشده مدیر ضمیمه پروژه شد`
              : null,
          ]
            .filter(Boolean)
            .join(" — "),
          actorId: auth.userId,
        },
      });

      return created;
    });

    await createNotificationOnce({
      ...buildEditingAssignedNotification({
        projectId,
        projectTitle: project.title,
        projectCode: project.code,
        deadline: deadlineAt,
        assignedAt,
        narrationVersionCount: narrationAudio?.takes?.length ?? 0,
        approvedNarrationVersion:
          narrationAudio?.takes?.find((t) => t.isCurrent)?.version ?? null,
      }),
      userId: profile.userId,
      audience: "INTERNAL",
    });

    await writeAudit({
      userId: auth.userId,
      action: "EDITOR_ASSIGN",
      entityType: "EditingTask",
      entityId: task.id,
      after: {
        editorProfileId,
        deadline: deadlineAt.toISOString(),
        instructions,
        editingCost: assignedAmount,
      },
      req,
    });

    return this.getProjectTask(projectId, auth);
  },

  async updateDeadline(projectId, { deadline, instructions }, auth, req) {
    const task = await prisma.editingTask.findFirst({
      where: { projectId, status: { in: ACTIVE_EDITING } },
      orderBy: { createdAt: "desc" },
    });
    if (!task) throw new AppError("تکلیف ادیت یافت نشد", 404, "NOT_FOUND");

    const data = {};
    if (deadline) {
      const deadlineAt = new Date(deadline);
      if (Number.isNaN(deadlineAt.getTime()))
        throw new AppError("مهلت نامعتبر است", 400, "INVALID_DEADLINE");
      data.deadline = deadlineAt;
    }
    if (instructions !== undefined)
      data.instructions = instructions?.trim() || null;

    await prisma.$transaction(async (tx) => {
      await tx.editingTask.update({ where: { id: task.id }, data });
      await tx.projectAssignment.updateMany({
        where: { projectId, role: "EDITOR", isActive: true },
        data: {
          ...(data.deadline ? { deadlineAt: data.deadline } : {}),
          ...(instructions !== undefined ? { notes: data.instructions } : {}),
        },
      });
    });

    await writeAudit({
      userId: auth.userId,
      action: "EDITOR_DEADLINE_UPDATE",
      entityType: "EditingTask",
      entityId: task.id,
      after: data,
      req,
    });

    return this.getProjectTask(projectId, auth);
  },

  async markInProgress(projectId, auth) {
    const task = await prisma.editingTask.findFirst({
      where: { projectId, status: { in: ["ASSIGNED", "REVISION_REQUESTED"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!task) throw new AppError("تکلیف ادیت یافت نشد", 404, "NOT_FOUND");
    if (!canAccessAsEditor(task, auth))
      throw new AppError("Forbidden", 403, "FORBIDDEN");

    await prisma.$transaction(async (tx) => {
      await tx.editingTask.update({
        where: { id: task.id },
        data: { status: "IN_PROGRESS" },
      });
      await tx.project.update({
        where: { id: projectId },
        data: {
          status: "PRODUCTION_EDITING",
          customerFacingStatus: "IN_PRODUCTION",
        },
      });
      await tx.projectTimelineEvent.create({
        data: {
          projectId,
          type: "EDITING_STARTED",
          title: "شروع ادیت ویدیو",
          actorId: auth.userId,
        },
      });
    });

    return this.getProjectTask(projectId, auth);
  },

  async submitProduction(projectId, body, auth, req) {
    const {
      watermarkedKey,
      cleanKey,
      workingKey,
      watermarkedName,
      cleanName,
      workingName,
      editorNotes,
      watermarkedMimeType,
      cleanMimeType,
      workingMimeType,
      watermarkedSizeBytes,
      cleanSizeBytes,
      workingSizeBytes,
    } = body;

    if (!watermarkedKey || !cleanKey) {
      throw new AppError(
        "هر دو فایل لوگودار و پاک الزامی است",
        400,
        "FINALS_REQUIRED",
      );
    }

    let task = await prisma.editingTask.findFirst({
      where: { projectId, status: { in: ACTIVE_EDITING } },
      orderBy: { createdAt: "desc" },
      include: { project: { select: { id: true, title: true, code: true } } },
    });

    if (!task) {
      // Allow submit via legacy path if assignment exists
      const assignment = await prisma.projectAssignment.findFirst({
        where: { projectId, role: "EDITOR", isActive: true },
        include: { teamProfile: true },
      });
      if (!assignment)
        throw new AppError("تکلیف ادیت یافت نشد", 404, "NOT_FOUND");
      if (
        auth.roleCode === "EDITOR" &&
        assignment.userId !== auth.userId &&
        assignment.teamProfile?.userId !== auth.userId
      ) {
        throw new AppError("Forbidden", 403, "FORBIDDEN");
      }
      task = await prisma.editingTask.create({
        data: {
          projectId,
          editorUserId: assignment.userId || assignment.teamProfile?.userId,
          editorTeamProfileId: assignment.teamProfileId,
          assignedById: assignment.assignedById,
          status: "IN_PROGRESS",
          deadline: assignment.deadlineAt,
          instructions: assignment.notes,
        },
        include: { project: { select: { id: true, title: true, code: true } } },
      });
    } else if (!canAccessAsEditor(task, auth)) {
      throw new AppError("Forbidden", 403, "FORBIDDEN");
    }

    const version = await nextFinalVersion(projectId);
    const submittedAt = new Date();
    const editorUser = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { fullName: true },
    });
    const editorName = editorUser?.fullName || "ادیتور";

    let watermarkedId = null;
    let cleanId = null;

    await prisma.$transaction(async (tx) => {
      const watermarked = await tx.projectFile.create({
        data: {
          projectId,
          kind: "WATERMARKED_FINAL",
          name: watermarkedName || `watermarked-v${version}`,
          storageKey: watermarkedKey,
          mimeType: watermarkedMimeType || "video/mp4",
          sizeBytes: watermarkedSizeBytes ?? null,
          version,
          uploadedBy: auth.userId,
          meta: buildFinalFileMeta({
            videoType: "WATERMARKED",
            status: "UPLOADED",
          }),
        },
      });
      const clean = await tx.projectFile.create({
        data: {
          projectId,
          kind: "CLEAN_FINAL",
          name: cleanName || `clean-v${version}`,
          storageKey: cleanKey,
          mimeType: cleanMimeType || "video/mp4",
          sizeBytes: cleanSizeBytes ?? null,
          version,
          uploadedBy: auth.userId,
          meta: buildFinalFileMeta({ videoType: "CLEAN", status: "UPLOADED" }),
        },
      });
      watermarkedId = watermarked.id;
      cleanId = clean.id;

      if (workingKey) {
        await tx.projectFile.create({
          data: {
            projectId,
            kind: "WORKING",
            name: workingName || `working-v${version}`,
            storageKey: workingKey,
            mimeType: workingMimeType || null,
            sizeBytes: workingSizeBytes ?? null,
            version,
            uploadedBy: auth.userId,
          },
        });
      }

      if (editorNotes?.trim()) {
        await tx.projectFile.create({
          data: {
            projectId,
            kind: "PROMPT_LOG",
            name: `editor-notes-v${version}`,
            storageKey: "inline",
            version,
            uploadedBy: auth.userId,
            meta: { editorNotes: editorNotes.trim() },
          },
        });
      }

      await tx.editingTask.update({
        where: { id: task.id },
        data: {
          status: "REVIEW_REQUIRED",
          version,
          watermarkedFileId: watermarked.id,
          cleanFileId: clean.id,
          submittedAt,
          revisionNotes: null,
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: {
          status: "MANAGER_FINAL_REVIEW",
          customerFacingStatus: "FINAL_REVIEW",
        },
      });

      await tx.projectTimelineEvent.create({
        data: {
          projectId,
          type: "PRODUCTION_SUBMITTED",
          title: `ارسال نسخه نهایی v${version}`,
          body: editorNotes || null,
          actorId: auth.userId,
        },
      });

      await rebuildProjectContext(projectId, tx);
    });

    await notifyManagersOnce(
      buildEditingSubmittedNotification({
        projectId,
        projectTitle: task.project.title,
        projectCode: task.project.code,
        version,
        editorName,
        submittedAt,
      }),
    );

    if (auth.userId) {
      await createNotificationOnce({
        ...buildFinalVideoUploadConfirmedNotification({
          projectId,
          projectTitle: task.project.title,
          projectCode: task.project.code,
          videoTypeLabel: "لوگودار و بدون واترمارک",
          uploadedAt: submittedAt,
        }),
        userId: auth.userId,
        audience: "INTERNAL",
      });
    }

    await writeAudit({
      userId: auth.userId,
      action: "PRODUCTION_SUBMIT",
      entityType: "EditingTask",
      entityId: task.id,
      after: { version, watermarkedKey, cleanKey, watermarkedId, cleanId },
      req,
    });

    return this.getProjectTask(projectId, auth);
  },

  async managerReview(projectId, { decision, comment }, auth, req) {
    const task = await prisma.editingTask.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        project: {
          select: { id: true, title: true, code: true, portalAccountId: true },
        },
        editorUser: { select: { id: true } },
      },
    });
    if (!task) throw new AppError("تکلیف ادیت یافت نشد", 404, "NOT_FOUND");

    if (decision === "APPROVE") {
      const sentAt = new Date();
      await prisma.$transaction(async (tx) => {
        await tx.approval.create({
          data: {
            projectId,
            type: "MANAGER_FINAL",
            decision: "APPROVED",
            comment,
            actorType: "MANAGER",
            actorId: auth.userId,
          },
        });
        await tx.employeePayable.updateMany({
          where: { projectId, roleLabel: "EDITOR", status: "ESTIMATED" },
          data: { status: "CONFIRMED" },
        });

        const watermarkedFiles = await tx.projectFile.findMany({
          where: { projectId, kind: "WATERMARKED_FINAL", deletedAt: null },
        });
        for (const file of watermarkedFiles) {
          await tx.projectFile.update({
            where: { id: file.id },
            data: {
              meta: markSentMeta(markApprovedMeta(file.meta, sentAt), {
                allowDownload: false,
                sentAt,
              }),
            },
          });
        }

        const cleanFiles = await tx.projectFile.findMany({
          where: { projectId, kind: "CLEAN_FINAL", deletedAt: null },
        });
        for (const file of cleanFiles) {
          await tx.projectFile.update({
            where: { id: file.id },
            data: { meta: markApprovedMeta(file.meta, sentAt) },
          });
        }

        await tx.project.update({
          where: { id: projectId },
          data: {
            status: "WAITING_CLIENT_FINAL_APPROVAL",
            customerFacingStatus: "WAITING_YOUR_APPROVAL",
          },
        });
        await tx.projectTimelineEvent.create({
          data: {
            projectId,
            type: "FINAL_SENT_TO_CLIENT",
            title: "ارسال ویدیو برای تأیید مشتری",
            actorId: auth.userId,
          },
        });
      });

      if (task.project.portalAccountId) {
        await createNotificationOnce({
          ...buildEditingReadyForCustomerNotification({
            projectId,
            projectTitle: task.project.title,
            projectCode: task.project.code,
            at: sentAt,
          }),
          portalAccountId: task.project.portalAccountId,
          audience: "PORTAL",
        });
      }
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.approval.create({
          data: {
            projectId,
            type: "MANAGER_FINAL",
            decision: "RETURNED",
            comment: comment || "نیاز به اصلاح",
            actorType: "MANAGER",
            actorId: auth.userId,
          },
        });
        await tx.editingTask.update({
          where: { id: task.id },
          data: {
            status: "REVISION_REQUESTED",
            revisionNotes: comment || "نیاز به اصلاح",
          },
        });
        await tx.project.update({
          where: { id: projectId },
          data: {
            status: "FINAL_REVISION",
            customerFacingStatus: "FINAL_REVIEW",
          },
        });
        await tx.projectTimelineEvent.create({
          data: {
            projectId,
            type: "FINAL_RETURNED",
            title: "بازگشت ویدیو برای اصلاح",
            body: comment || null,
            actorId: auth.userId,
          },
        });
      });

      if (task.editorUserId) {
        await createNotificationOnce({
          ...buildEditingManagerFeedbackNotification({
            projectId,
            projectTitle: task.project.title,
            projectCode: task.project.code,
            notes: comment,
          }),
          userId: task.editorUserId,
          audience: "INTERNAL",
        });
        await createNotificationOnce({
          ...buildEditingRevisionRequestedNotification({
            projectId,
            projectTitle: task.project.title,
            projectCode: task.project.code,
            notes: comment,
            source: "MANAGER",
          }),
          userId: task.editorUserId,
          audience: "INTERNAL",
        });
      }
    }

    await writeAudit({
      userId: auth.userId,
      action:
        decision === "APPROVE"
          ? "FINAL_APPROVE_FOR_CLIENT"
          : "FINAL_RETURN_EDITOR",
      entityType: "EditingTask",
      entityId: task.id,
      after: { comment },
      req,
    });

    return { decision, ...(await this.getProjectTask(projectId, auth)) };
  },

  /** Called when customer requests final video revision */
  async onCustomerRevision(projectId, notes) {
    const task = await prisma.editingTask.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: { project: { select: { title: true, code: true } } },
    });
    if (!task) return;

    await prisma.editingTask.update({
      where: { id: task.id },
      data: {
        status: "REVISION_REQUESTED",
        revisionNotes: notes,
      },
    });

    if (task.editorUserId) {
      await createNotificationOnce({
        ...buildEditingRevisionRequestedNotification({
          projectId,
          projectTitle: task.project.title,
          projectCode: task.project.code,
          notes,
          source: "CUSTOMER",
        }),
        userId: task.editorUserId,
        audience: "INTERNAL",
      });
    }

    await notifyManagersOnce(
      buildEditingRevisionRequestedNotification({
        projectId,
        projectTitle: task.project.title,
        projectCode: task.project.code,
        notes,
        source: "CUSTOMER",
      }),
    );
  },

  /** Called when customer approves clean final video (project completed). */
  async onCustomerApprove(projectId, { completedAt = new Date() } = {}) {
    const task = await prisma.editingTask.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        project: {
          select: {
            title: true,
            code: true,
            crmCustomer: {
              select: { personName: true, companyName: true },
            },
          },
        },
        editorUser: { select: { id: true } },
      },
    });
    if (!task) return;

    if (task.status !== "COMPLETED") {
      await prisma.editingTask.update({
        where: { id: task.id },
        data: { status: "COMPLETED", completedAt },
      });
    }

    const customerName =
      task.project.crmCustomer?.companyName ||
      task.project.crmCustomer?.personName ||
      "مشتری";

    const basePayload = {
      projectId,
      projectTitle: task.project.title,
      projectCode: task.project.code,
      customerName,
      at: completedAt,
    };

    await notifyManagersOnce(buildEditingCompletedNotification(basePayload));

    if (task.editorUserId) {
      await createNotificationOnce({
        ...buildEditingCompletedNotification({
          ...basePayload,
          forEditor: true,
        }),
        userId: task.editorUserId,
        audience: "INTERNAL",
      });
    }
  },

  /** List all final videos (watermarked + clean) for manager / editor. */
  async listFinalProducts(projectId, auth) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        portalAccountId: true,
        assignments: {
          where: { role: "EDITOR", isActive: true },
          include: { teamProfile: { select: { userId: true } } },
        },
      },
    });
    if (!project) throw new AppError("پروژه یافت نشد", 404, "NOT_FOUND");

    if (auth.roleCode === "EDITOR") {
      const assigned = project.assignments.some(
        (a) =>
          a.userId === auth.userId || a.teamProfile?.userId === auth.userId,
      );
      if (!assigned) throw new AppError("دسترسی ندارید", 403, "FORBIDDEN");
    } else if (auth.roleCode !== "MANAGER" && auth.roleCode !== "ADMIN") {
      throw new AppError("دسترسی ندارید", 403, "FORBIDDEN");
    }

    const files = await prisma.projectFile.findMany({
      where: {
        projectId,
        kind: { in: ["WATERMARKED_FINAL", "CLEAN_FINAL"] },
        deletedAt: null,
      },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    });

    const clientFinalApproval = await prisma.approval.findFirst({
      where: {
        projectId,
        type: "CLIENT_FINAL",
        decision: "APPROVED",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    });
    const customerApproved =
      !!clientFinalApproval || project.status === "WAITING_PAYMENT";

    // Self-heal: persist APPROVED_BY_CUSTOMER on watermarked cards if approval exists.
    if (customerApproved) {
      const needsBackfill = files.some((f) => {
        if (f.kind !== "WATERMARKED_FINAL" && f.kind !== "CLEAN_FINAL")
          return false;
        const meta =
          f.meta && typeof f.meta === "object" && !Array.isArray(f.meta)
            ? f.meta
            : {};
        return (
          meta.status !== "APPROVED_BY_CUSTOMER" && !meta.approvedByCustomer
        );
      });
      if (needsBackfill) {
        const { markSentFinalsApprovedByCustomer } =
          await import("./finalProduct.js");
        await markSentFinalsApprovedByCustomer(prisma, projectId, {
          approvedAt: clientFinalApproval?.createdAt || new Date(),
        });
        const refreshed = await prisma.projectFile.findMany({
          where: {
            projectId,
            kind: { in: ["WATERMARKED_FINAL", "CLEAN_FINAL"] },
            deletedAt: null,
          },
          orderBy: [{ version: "desc" }, { createdAt: "desc" }],
        });
        files.splice(0, files.length, ...refreshed);
      }
    }

    const uploaderIds = [
      ...new Set(files.map((f) => f.uploadedBy).filter(Boolean)),
    ];
    const uploaders = uploaderIds.length
      ? await prisma.user.findMany({
          where: { id: { in: uploaderIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const uploaderMap = Object.fromEntries(
      uploaders.map((u) => [u.id, u.fullName]),
    );

    const items = files.map((f) =>
      serializeFinalVideo(f, {
        projectStatus: project.status,
        uploaderName: f.uploadedBy ? uploaderMap[f.uploadedBy] || null : null,
        customerApproved,
      }),
    );

    // Editors never receive storage keys for unrelated clean files beyond their project (already filtered)
    const forRole = auth.roleCode === "EDITOR" ? items : items;

    const task = await prisma.editingTask.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        version: true,
        submittedAt: true,
        revisionNotes: true,
        editorUser: { select: { id: true, fullName: true } },
      },
    });

    return {
      project: {
        id: project.id,
        code: project.code,
        title: project.title,
        status: project.status,
      },
      task,
      items: forRole,
      counts: {
        total: forRole.length,
        watermarked: forRole.filter((i) => i.videoType === "WATERMARKED")
          .length,
        clean: forRole.filter((i) => i.videoType === "CLEAN").length,
        sent: forRole.filter((i) => i.sentToCustomer).length,
        pending: forRole.filter((i) => !i.sentToCustomer).length,
      },
    };
  },

  /**
   * Upload one final video (WATERMARKED or CLEAN). Appears immediately in محصول نهایی.
   * When both types exist for the latest version, marks editing task for manager review.
   */
  async uploadFinalVideo(projectId, body, auth, req) {
    const {
      videoType,
      storageKey,
      name,
      mimeType,
      sizeBytes,
      notes,
      storageMeta,
    } = body || {};

    const type = String(videoType || "").toUpperCase();
    if (!["WATERMARKED", "CLEAN"].includes(type)) {
      throw new AppError("نوع ویدیو نامعتبر است", 400, "INVALID_VIDEO_TYPE");
    }
    if (!storageKey)
      throw new AppError("فایل الزامی است", 400, "FILE_REQUIRED");

    const allowedMime = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-matroska",
    ];
    if (
      mimeType &&
      !allowedMime.includes(mimeType) &&
      !String(mimeType).startsWith("video/")
    ) {
      throw new AppError("فرمت ویدیو پشتیبانی نمی‌شود", 400, "INVALID_MIME");
    }

    let task = await prisma.editingTask.findFirst({
      where: { projectId, status: { in: ACTIVE_EDITING } },
      orderBy: { createdAt: "desc" },
      include: { project: { select: { id: true, title: true, code: true } } },
    });

    if (!task) {
      const assignment = await prisma.projectAssignment.findFirst({
        where: { projectId, role: "EDITOR", isActive: true },
        include: { teamProfile: true },
      });
      if (!assignment)
        throw new AppError("تکلیف ادیت یافت نشد", 404, "NOT_FOUND");
      if (
        auth.roleCode === "EDITOR" &&
        assignment.userId !== auth.userId &&
        assignment.teamProfile?.userId !== auth.userId
      ) {
        throw new AppError("Forbidden", 403, "FORBIDDEN");
      }
      const project = await prisma.project.findFirst({
        where: { id: projectId, deletedAt: null },
        select: { id: true, title: true, code: true },
      });
      if (!project) throw new AppError("پروژه یافت نشد", 404, "NOT_FOUND");
      task = await prisma.editingTask.create({
        data: {
          projectId,
          editorUserId: assignment.userId || assignment.teamProfile?.userId,
          editorTeamProfileId: assignment.teamProfileId,
          assignedById: assignment.assignedById,
          status: "IN_PROGRESS",
          deadline: assignment.deadlineAt,
          instructions: assignment.notes,
        },
        include: { project: { select: { id: true, title: true, code: true } } },
      });
    } else if (!canAccessAsEditor(task, auth)) {
      throw new AppError("Forbidden", 403, "FORBIDDEN");
    }

    const kind = type === "CLEAN" ? "CLEAN_FINAL" : "WATERMARKED_FINAL";
    // Versions are independent per video type. Every upload is immutable and
    // receives the next version without replacing an earlier submission.
    const latestSame = await prisma.projectFile.findFirst({
      where: { projectId, kind, deletedAt: null },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const useVersion = (latestSame?.version || 0) + 1;

    const uploadedAt = new Date();
    const editorUser = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { fullName: true },
    });
    const editorName = editorUser?.fullName || "ادیتور";

    const file = await prisma.$transaction(async (tx) => {
      const created = await tx.projectFile.create({
        data: {
          projectId,
          kind,
          name: name || `${type.toLowerCase()}-v${useVersion}`,
          storageKey,
          mimeType: mimeType || "video/mp4",
          sizeBytes: sizeBytes ?? null,
          version: useVersion,
          uploadedBy: auth.userId,
          meta: mergeStorageMeta(
            buildFinalFileMeta({
              videoType: type,
              status: "PENDING_REVIEW",
              extras: notes?.trim() ? { editorNotes: notes.trim() } : {},
            }),
            storageMeta,
          ),
        },
      });

      const pairWm = await tx.projectFile.findFirst({
        where: {
          projectId,
          kind: "WATERMARKED_FINAL",
          version: useVersion,
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });
      const pairClean = await tx.projectFile.findFirst({
        where: {
          projectId,
          kind: "CLEAN_FINAL",
          version: useVersion,
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });

      await tx.editingTask.update({
        where: { id: task.id },
        data: {
          version: useVersion,
          watermarkedFileId: pairWm?.id || task.watermarkedFileId,
          cleanFileId: pairClean?.id || task.cleanFileId,
          status: "REVIEW_REQUIRED",
          submittedAt: uploadedAt,
          revisionNotes: null,
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: {
          status: "MANAGER_FINAL_REVIEW",
          customerFacingStatus: "FINAL_REVIEW",
        },
      });

      await tx.projectTimelineEvent.create({
        data: {
          projectId,
          type: "FINAL_VIDEO_UPLOADED",
          title: `آپلود ${VIDEO_TYPE_LABELS[type]} — v${useVersion}`,
          body: notes || null,
          actorId: auth.userId,
          meta: { fileId: created.id, videoType: type, version: useVersion },
        },
      });

      await rebuildProjectContext(projectId, tx);
      return created;
    });

    await notifyManagersOnce(
      buildFinalVideoUploadedNotification({
        projectId,
        projectTitle: task.project.title,
        projectCode: task.project.code,
        editorName,
        videoType: type,
        videoTypeLabel: VIDEO_TYPE_LABELS[type],
        fileId: file.id,
        version: useVersion,
        uploadedAt,
      }),
    );

    if (auth.userId) {
      await createNotificationOnce({
        ...buildFinalVideoUploadConfirmedNotification({
          projectId,
          projectTitle: task.project.title,
          projectCode: task.project.code,
          videoTypeLabel: VIDEO_TYPE_LABELS[type],
          uploadedAt,
        }),
        userId: auth.userId,
        audience: "INTERNAL",
      });
    }

    await writeAudit({
      userId: auth.userId,
      action: "FINAL_VIDEO_UPLOAD",
      entityType: "ProjectFile",
      entityId: file.id,
      after: { projectId, videoType: type, version: useVersion, storageKey },
      req,
    });

    return {
      file: serializeFinalVideo(file, {
        projectStatus: "PRODUCTION_EDITING",
        uploaderName: editorName,
      }),
      ...(await this.listFinalProducts(projectId, auth)),
    };
  },

  /** Manager reviews one immutable final-video submission/version. */
  async reviewFinalVideo(projectId, fileId, body, auth, req) {
    if (auth.roleCode !== "MANAGER" && auth.roleCode !== "ADMIN") {
      throw new AppError(
        "فقط مدیر می‌تواند ویدیوی نهایی را بررسی کند",
        403,
        "FORBIDDEN",
      );
    }

    const decision = String(body?.decision || "").toUpperCase();
    if (!["APPROVE", "REQUEST_REVISION"].includes(decision)) {
      throw new AppError("تصمیم بررسی نامعتبر است", 400, "INVALID_DECISION");
    }
    const notes = String(body?.notes || "").trim();
    if (decision === "REQUEST_REVISION" && !notes) {
      throw new AppError(
        "توضیحات اصلاح الزامی است",
        400,
        "REVISION_NOTES_REQUIRED",
      );
    }

    const file = await prisma.projectFile.findFirst({
      where: {
        id: fileId,
        projectId,
        kind: { in: ["WATERMARKED_FINAL", "CLEAN_FINAL"] },
        deletedAt: null,
      },
      include: {
        project: {
          select: { id: true, title: true, code: true },
        },
      },
    });
    if (!file) throw new AppError("ویدیو یافت نشد", 404, "NOT_FOUND");

    const currentStatus = resolveVideoStatus(file.meta);
    if (
      [
        "SENT_TO_CUSTOMER",
        "VIEWED_BY_CUSTOMER",
        "APPROVED_BY_CUSTOMER",
      ].includes(currentStatus)
    ) {
      throw new AppError(
        "ویدیوی ارسال‌شده برای مشتری قابل بازبینی نیست",
        409,
        "FINAL_ALREADY_SENT",
      );
    }
    if (decision === "APPROVE" && currentStatus === "APPROVED") {
      throw new AppError(
        "این نسخه قبلاً تأیید شده است",
        409,
        "FINAL_ALREADY_APPROVED",
      );
    }
    if (
      decision === "REQUEST_REVISION" &&
      currentStatus === "REVISION_REQUESTED"
    ) {
      throw new AppError(
        "برای این نسخه قبلاً درخواست اصلاح ثبت شده است",
        409,
        "FINAL_REVISION_ALREADY_REQUESTED",
      );
    }

    const reviewedAt = new Date();
    const task = await prisma.editingTask.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { id: true, editorUserId: true, status: true },
    });
    const recipientId = file.uploadedBy || task?.editorUserId || null;
    const videoType = file.kind === "CLEAN_FINAL" ? "CLEAN" : "WATERMARKED";
    const videoTypeLabel = VIDEO_TYPE_LABELS[videoType];

    await prisma.$transaction(async (tx) => {
      const nextMeta =
        decision === "APPROVE"
          ? {
              ...markApprovedMeta(file.meta, reviewedAt),
              reviewedBy: auth.userId,
            }
          : markRevisionRequestedMeta(file.meta, {
              notes,
              requestedAt: reviewedAt,
              reviewedBy: auth.userId,
            });

      await tx.projectFile.update({
        where: { id: file.id },
        data: { meta: nextMeta },
      });

      if (task) {
        await tx.editingTask.update({
          where: { id: task.id },
          data:
            decision === "REQUEST_REVISION"
              ? { status: "REVISION_REQUESTED", revisionNotes: notes }
              : {
                  status: "REVIEW_REQUIRED",
                  ...(task.status === "REVISION_REQUESTED"
                    ? { revisionNotes: null }
                    : {}),
                },
        });
      }

      await tx.project.update({
        where: { id: projectId },
        data:
          decision === "REQUEST_REVISION"
            ? {
                status: "FINAL_REVISION",
                customerFacingStatus: "FINAL_REVIEW",
              }
            : {
                status: "MANAGER_FINAL_REVIEW",
                customerFacingStatus: "FINAL_REVIEW",
              },
      });

      await tx.approval.create({
        data: {
          projectId,
          type: "MANAGER_FINAL",
          decision: decision === "APPROVE" ? "APPROVED" : "RETURNED",
          comment:
            decision === "APPROVE"
              ? `file:${file.id};version:${file.version}`
              : `file:${file.id};version:${file.version}\n${notes}`,
          actorType: "MANAGER",
          actorId: auth.userId,
        },
      });

      await tx.projectTimelineEvent.create({
        data: {
          projectId,
          type:
            decision === "APPROVE" ? "PRODUCTION_SUBMITTED" : "FINAL_RETURNED",
          title:
            decision === "APPROVE"
              ? `تأیید ${videoTypeLabel} — نسخه ${file.version}`
              : `درخواست اصلاح ${videoTypeLabel} — نسخه ${file.version}`,
          body: notes || null,
          actorId: auth.userId,
          meta: {
            fileId: file.id,
            videoType,
            version: file.version,
            decision,
          },
        },
      });
    });

    if (recipientId) {
      await createNotificationOnce({
        ...(decision === "APPROVE"
          ? buildFinalVideoApprovedNotification({
              projectId,
              projectTitle: file.project.title,
              projectCode: file.project.code,
              fileId: file.id,
              videoTypeLabel,
              version: file.version,
              approvedAt: reviewedAt,
            })
          : buildFinalVideoRevisionRequestedNotification({
              projectId,
              projectTitle: file.project.title,
              projectCode: file.project.code,
              fileId: file.id,
              videoTypeLabel,
              version: file.version,
              notes,
              requestedAt: reviewedAt,
            })),
        userId: recipientId,
        audience: "INTERNAL",
      });
    }

    await writeAudit({
      userId: auth.userId,
      action:
        decision === "APPROVE"
          ? "FINAL_VIDEO_APPROVE"
          : "FINAL_VIDEO_REVISION_REQUEST",
      entityType: "ProjectFile",
      entityId: file.id,
      after: {
        projectId,
        decision,
        notes: notes || null,
        version: file.version,
      },
      req,
    });

    return this.listFinalProducts(projectId, auth);
  },

  /** Manager selects final videos and sends them to the customer portal. */
  async sendFinalVideos(projectId, body, auth, req) {
    if (auth.roleCode !== "MANAGER" && auth.roleCode !== "ADMIN") {
      throw new AppError(
        "فقط مدیر می‌تواند ویدیو را برای مشتری ارسال کند",
        403,
        "FORBIDDEN",
      );
    }

    const fileIds = Array.isArray(body?.fileIds)
      ? [...new Set(body.fileIds.filter(Boolean))]
      : [];
    if (fileIds.length === 0) {
      throw new AppError(
        "حداقل یک ویدیو را انتخاب کنید",
        400,
        "FILES_REQUIRED",
      );
    }

    const allowDownload = body?.allowDownload === true;
    const decision = body?.decision; // optional APPROVE companion
    const comment = body?.comment || null;
    const sentAt = new Date();

    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: {
        id: true,
        title: true,
        code: true,
        portalAccountId: true,
        status: true,
      },
    });
    if (!project) throw new AppError("پروژه یافت نشد", 404, "NOT_FOUND");

    const files = await prisma.projectFile.findMany({
      where: {
        id: { in: fileIds },
        projectId,
        kind: { in: ["WATERMARKED_FINAL", "CLEAN_FINAL"] },
        deletedAt: null,
      },
    });
    if (files.length !== fileIds.length) {
      throw new AppError("برخی فایل‌ها یافت نشدند", 404, "NOT_FOUND");
    }
    const unapproved = files.filter(
      (file) => resolveVideoStatus(file.meta) !== "APPROVED",
    );
    if (unapproved.length > 0) {
      throw new AppError(
        "فقط ویدیوهای تأییدشده قابل ارسال برای مشتری هستند",
        409,
        "FINAL_REVIEW_REQUIRED",
      );
    }

    // Clean download is gated by payment settlement in deliveryAccess.
    // allowDownload may unlock early before balance is settled.
    await prisma.$transaction(async (tx) => {
      for (const file of files) {
        await tx.projectFile.update({
          where: { id: file.id },
          data: {
            meta: markSentMeta(markApprovedMeta(file.meta, sentAt), {
              allowDownload:
                file.kind === "CLEAN_FINAL" ? allowDownload : allowDownload,
              sentAt,
            }),
          },
        });
      }

      await tx.approval.create({
        data: {
          projectId,
          type: "MANAGER_FINAL",
          decision: "APPROVED",
          comment:
            comment ||
            (decision === "APPROVE" ? null : "ارسال انتخابی محصول نهایی"),
          actorType: "MANAGER",
          actorId: auth.userId,
        },
      });

      await tx.employeePayable.updateMany({
        where: { projectId, roleLabel: "EDITOR", status: "ESTIMATED" },
        data: { status: "CONFIRMED" },
      });

      const task = await tx.editingTask.findFirst({
        where: { projectId },
        orderBy: { createdAt: "desc" },
      });
      if (task && task.status === "REVIEW_REQUIRED") {
        // Keep task in review until customer approves; do not mark COMPLETED here
      }

      await tx.project.update({
        where: { id: projectId },
        data: {
          status: "WAITING_CLIENT_FINAL_APPROVAL",
          customerFacingStatus: "WAITING_YOUR_APPROVAL",
        },
      });

      await tx.projectTimelineEvent.create({
        data: {
          projectId,
          type: "FINAL_SENT_TO_CLIENT",
          title: "ارسال محصول نهایی برای مشتری",
          body: `${files.length} ویدیو ارسال شد`,
          actorId: auth.userId,
          meta: { fileIds: files.map((f) => f.id), allowDownload },
        },
      });
    });

    if (project.portalAccountId) {
      await createNotificationOnce({
        ...buildEditingReadyForCustomerNotification({
          projectId,
          projectTitle: project.title,
          projectCode: project.code,
          at: sentAt,
        }),
        portalAccountId: project.portalAccountId,
        audience: "PORTAL",
      });
    }

    await writeAudit({
      userId: auth.userId,
      action: "FINAL_SEND_TO_CUSTOMER",
      entityType: "Project",
      entityId: projectId,
      after: { fileIds, allowDownload },
      req,
    });

    return this.listFinalProducts(projectId, auth);
  },

  /** Mark a sent final video as viewed by the customer (portal). */
  async markFinalVideoViewed(projectId, fileId, auth) {
    const file = await prisma.projectFile.findFirst({
      where: {
        id: fileId,
        projectId,
        kind: { in: ["WATERMARKED_FINAL", "CLEAN_FINAL"] },
        deletedAt: null,
      },
    });
    if (!file) throw new AppError("فایل یافت نشد", 404, "NOT_FOUND");

    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { status: true },
    });
    if (!project || !isSentToCustomer(file, project.status)) {
      throw new AppError("دسترسی ندارید", 403, "FORBIDDEN");
    }

    const updated = await prisma.projectFile.update({
      where: { id: file.id },
      data: { meta: markViewedMeta(file.meta) },
    });

    return serializeFinalVideo(updated, { projectStatus: project.status });
  },
};
