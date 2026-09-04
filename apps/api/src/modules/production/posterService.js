import { prisma } from "../../db/prisma.js";
import { AppError } from "../../utils/response.js";
import { writeAudit } from "../../middleware/audit.js";
import { rebuildProjectContext } from "../../services/projectContext.js";
import {
  createNotificationOnce,
  notifyManagersOnce,
  buildPosterSubmittedNotification,
  buildPosterApprovedNotification,
  buildPosterRejectedNotification,
  buildPosterSentToCustomerNotification,
} from "../../services/notifications.js";
import { mergeStorageMeta } from "../../services/storage/media-manager.js";
import {
  canReviewProjectPosters,
  canSendProjectPosters,
  hasAnyPermission,
} from "../../services/permissions/effective.js";
import {
  isAcceptedPosterMime,
  markLatestFlags,
  serializePoster,
} from "./poster.js";

const POSTER_INCLUDE = {
  file: true,
  uploadedBy: { select: { id: true, fullName: true } },
  reviewedBy: { select: { id: true, fullName: true } },
  deliveredBy: { select: { id: true, fullName: true } },
};

async function loadProjectForPosters(projectId) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      crmCustomerId: true,
      portalAccountId: true,
      assignments: {
        where: { role: "EDITOR", isActive: true },
        include: { teamProfile: { select: { userId: true } } },
      },
    },
  });
  if (!project) throw new AppError("پروژه یافت نشد", 404, "NOT_FOUND");
  return project;
}

function isAssignedEditor(project, auth) {
  if (auth.roleCode !== "EDITOR") return false;
  return (project.assignments || []).some(
    (a) =>
      a.userId === auth.userId || a.teamProfile?.userId === auth.userId,
  );
}

function canViewPosters(project, auth) {
  if (auth.roleCode === "MANAGER" || auth.roleCode === "ADMIN") return true;
  if (isAssignedEditor(project, auth)) return true;
  return hasAnyPermission(auth.permissions, ["poster.view"], auth.roleCode);
}

async function listSerialized(projectId, { forCustomer = false } = {}) {
  const rows = await prisma.projectPoster.findMany({
    where: { projectId },
    include: POSTER_INCLUDE,
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
  });
  const items = markLatestFlags(
    rows.map((row) => serializePoster(row, { forCustomer })),
  );
  return {
    items,
    counts: {
      total: items.length,
      pending: items.filter((i) => i.status === "PENDING_REVIEW").length,
      approved: items.filter((i) => i.status === "APPROVED").length,
      rejected: items.filter((i) => i.status === "REJECTED").length,
      sent: items.filter((i) => i.status === "SENT_TO_CUSTOMER").length,
    },
  };
}

export const posterService = {
  async list(projectId, auth) {
    const project = await loadProjectForPosters(projectId);
    if (!canViewPosters(project, auth)) {
      throw new AppError("دسترسی ندارید", 403, "FORBIDDEN");
    }
    const payload = await listSerialized(projectId);
    return {
      project: {
        id: project.id,
        code: project.code,
        title: project.title,
        status: project.status,
      },
      ...payload,
    };
  },

  async upload(projectId, body, auth, req) {
    const { storageKey, name, mimeType, sizeBytes, notes, storageMeta } =
      body || {};
    if (!storageKey) {
      throw new AppError("فایل پوستر الزامی است", 400, "FILE_REQUIRED");
    }
    if (!isAcceptedPosterMime(mimeType, name)) {
      throw new AppError(
        "فقط فایل‌های تصویری (JPG، PNG، WebP، GIF) مجاز هستند",
        400,
        "INVALID_MIME",
      );
    }

    const project = await loadProjectForPosters(projectId);
    if (auth.roleCode === "EDITOR" && !isAssignedEditor(project, auth)) {
      throw new AppError("دسترسی ندارید", 403, "FORBIDDEN");
    }
    if (
      auth.roleCode !== "EDITOR" &&
      auth.roleCode !== "MANAGER" &&
      auth.roleCode !== "ADMIN"
    ) {
      throw new AppError("دسترسی ندارید", 403, "FORBIDDEN");
    }

    const pending = await prisma.projectPoster.findFirst({
      where: { projectId, status: "PENDING_REVIEW" },
      select: { id: true, version: true },
    });
    if (pending) {
      throw new AppError(
        "یک پوستر در انتظار بررسی مدیریت است. پس از تأیید یا رد می‌توانید نسخه جدید ارسال کنید.",
        409,
        "POSTER_PENDING_REVIEW",
      );
    }

    const latest = await prisma.projectPoster.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (latest?.version || 0) + 1;
    const uploadedAt = new Date();
    const editorUser = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { fullName: true },
    });
    const editorName = editorUser?.fullName || "ادیتور";

    const poster = await prisma.$transaction(async (tx) => {
      const file = await tx.projectFile.create({
        data: {
          projectId,
          kind: "POSTER",
          name: name || `poster-v${version}`,
          storageKey,
          mimeType: mimeType || "image/jpeg",
          sizeBytes: sizeBytes ?? null,
          version,
          uploadedBy: auth.userId,
          meta: mergeStorageMeta(
            {
              purpose: "project_poster",
              status: "PENDING_REVIEW",
              editorNotes: notes?.trim() || null,
            },
            storageMeta,
          ),
        },
      });

      const created = await tx.projectPoster.create({
        data: {
          projectId,
          crmCustomerId: project.crmCustomerId,
          fileId: file.id,
          version,
          notes: notes?.trim() || null,
          status: "PENDING_REVIEW",
          uploadedById: auth.userId,
        },
        include: POSTER_INCLUDE,
      });

      await tx.projectTimelineEvent.create({
        data: {
          projectId,
          type: "POSTER_UPLOADED",
          title: `ارسال پوستر برای بررسی مدیریت — نسخه ${version}`,
          body: notes?.trim() || null,
          actorId: auth.userId,
          meta: { posterId: created.id, fileId: file.id, version },
        },
      });

      await rebuildProjectContext(projectId, tx);
      return created;
    });

    await notifyManagersOnce(
      buildPosterSubmittedNotification({
        projectId,
        projectTitle: project.title,
        projectCode: project.code,
        editorName,
        posterId: poster.id,
        version,
        uploadedAt,
      }),
    );

    await writeAudit({
      userId: auth.userId,
      action: "POSTER_UPLOAD",
      entityType: "ProjectPoster",
      entityId: poster.id,
      after: { projectId, version, storageKey },
      req,
    });

    return {
      poster: serializePoster(poster),
      ...(await listSerialized(projectId)),
      project: {
        id: project.id,
        code: project.code,
        title: project.title,
        status: project.status,
      },
    };
  },

  async review(projectId, posterId, body, auth, req) {
    if (!canReviewProjectPosters(auth.permissions, auth.roleCode)) {
      throw new AppError(
        "فقط مدیر می‌تواند پوستر را بررسی کند",
        403,
        "FORBIDDEN",
      );
    }

    const decision = String(body?.decision || "").toUpperCase();
    if (!["APPROVE", "REJECT"].includes(decision)) {
      throw new AppError("تصمیم بررسی نامعتبر است", 400, "INVALID_DECISION");
    }
    const reason = String(body?.reason || body?.notes || "").trim();
    if (decision === "REJECT" && !reason) {
      throw new AppError("دلیل رد الزامی است", 400, "REJECTION_REASON_REQUIRED");
    }

    const poster = await prisma.projectPoster.findFirst({
      where: { id: posterId, projectId },
      include: {
        ...POSTER_INCLUDE,
        project: {
          select: { id: true, title: true, code: true, portalAccountId: true },
        },
      },
    });
    if (!poster) throw new AppError("پوستر یافت نشد", 404, "NOT_FOUND");

    if (poster.status === "SENT_TO_CUSTOMER") {
      throw new AppError(
        "پوستر ارسال‌شده برای مشتری قابل بازبینی نیست",
        409,
        "POSTER_ALREADY_SENT",
      );
    }
    if (poster.status !== "PENDING_REVIEW") {
      throw new AppError(
        "فقط پوسترهای در انتظار بررسی قابل تأیید یا رد هستند",
        409,
        "POSTER_NOT_PENDING",
      );
    }

    const reviewedAt = new Date();
    const nextStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.projectPoster.update({
        where: { id: poster.id },
        data: {
          status: nextStatus,
          reviewedById: auth.userId,
          reviewedAt,
          rejectionReason: decision === "REJECT" ? reason : null,
        },
        include: POSTER_INCLUDE,
      });

      const currentMeta =
        poster.file?.meta && typeof poster.file.meta === "object"
          ? poster.file.meta
          : {};
      await tx.projectFile.update({
        where: { id: poster.fileId },
        data: {
          meta: {
            ...currentMeta,
            status: nextStatus,
            reviewedBy: auth.userId,
            reviewedAt: reviewedAt.toISOString(),
            rejectionReason: decision === "REJECT" ? reason : null,
          },
        },
      });

      await tx.projectTimelineEvent.create({
        data: {
          projectId,
          type: decision === "APPROVE" ? "POSTER_APPROVED" : "POSTER_REJECTED",
          title:
            decision === "APPROVE"
              ? `تأیید پوستر — نسخه ${poster.version}`
              : `رد پوستر — نسخه ${poster.version}`,
          body: decision === "REJECT" ? reason : null,
          actorId: auth.userId,
          meta: {
            posterId: poster.id,
            fileId: poster.fileId,
            version: poster.version,
            decision,
          },
        },
      });

      return row;
    });

    if (poster.uploadedById) {
      await createNotificationOnce({
        ...(decision === "APPROVE"
          ? buildPosterApprovedNotification({
              projectId,
              projectTitle: poster.project.title,
              projectCode: poster.project.code,
              posterId: poster.id,
              version: poster.version,
              approvedAt: reviewedAt,
            })
          : buildPosterRejectedNotification({
              projectId,
              projectTitle: poster.project.title,
              projectCode: poster.project.code,
              posterId: poster.id,
              version: poster.version,
              reason,
              rejectedAt: reviewedAt,
            })),
        userId: poster.uploadedById,
        audience: "INTERNAL",
      });
    }

    await writeAudit({
      userId: auth.userId,
      action: decision === "APPROVE" ? "POSTER_APPROVE" : "POSTER_REJECT",
      entityType: "ProjectPoster",
      entityId: poster.id,
      after: { projectId, decision, reason: reason || null, version: poster.version },
      req,
    });

    const project = await loadProjectForPosters(projectId);
    return {
      poster: serializePoster(updated),
      ...(await listSerialized(projectId)),
      project: {
        id: project.id,
        code: project.code,
        title: project.title,
        status: project.status,
      },
    };
  },

  async send(projectId, posterId, body, auth, req) {
    if (!canSendProjectPosters(auth.permissions, auth.roleCode)) {
      throw new AppError(
        "فقط مدیر می‌تواند پوستر را برای مشتری ارسال کند",
        403,
        "FORBIDDEN",
      );
    }

    const resend = body?.resend === true;
    const poster = await prisma.projectPoster.findFirst({
      where: { id: posterId, projectId },
      include: {
        ...POSTER_INCLUDE,
        project: {
          select: {
            id: true,
            title: true,
            code: true,
            portalAccountId: true,
          },
        },
      },
    });
    if (!poster) throw new AppError("پوستر یافت نشد", 404, "NOT_FOUND");

    if (poster.status === "PENDING_REVIEW" || poster.status === "REJECTED") {
      throw new AppError(
        "پوستر تأییدنشده قابل ارسال به مشتری نیست",
        409,
        "POSTER_NOT_APPROVED",
      );
    }
    if (poster.status === "SENT_TO_CUSTOMER" && !resend) {
      throw new AppError(
        "این پوستر قبلاً برای مشتری ارسال شده است",
        409,
        "POSTER_ALREADY_SENT",
      );
    }
    if (poster.status !== "APPROVED" && poster.status !== "SENT_TO_CUSTOMER") {
      throw new AppError(
        "فقط پوستر تأییدشده قابل ارسال است",
        409,
        "POSTER_NOT_APPROVED",
      );
    }

    const deliveredAt = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.projectPoster.update({
        where: { id: poster.id },
        data: {
          status: "SENT_TO_CUSTOMER",
          deliveredAt,
          deliveredById: auth.userId,
        },
        include: POSTER_INCLUDE,
      });

      const currentMeta =
        poster.file?.meta && typeof poster.file.meta === "object"
          ? poster.file.meta
          : {};
      await tx.projectFile.update({
        where: { id: poster.fileId },
        data: {
          meta: {
            ...currentMeta,
            status: "SENT_TO_CUSTOMER",
            sentToCustomer: true,
            sentAt: deliveredAt.toISOString(),
          },
        },
      });

      await tx.projectTimelineEvent.create({
        data: {
          projectId,
          type: "POSTER_SENT_TO_CUSTOMER",
          title: resend
            ? `ارسال مجدد پوستر به مشتری — نسخه ${poster.version}`
            : `ارسال پوستر به مشتری — نسخه ${poster.version}`,
          actorId: auth.userId,
          meta: {
            posterId: poster.id,
            fileId: poster.fileId,
            version: poster.version,
            resend,
          },
        },
      });

      return row;
    });

    if (poster.project.portalAccountId) {
      await createNotificationOnce({
        ...buildPosterSentToCustomerNotification({
          projectId,
          projectTitle: poster.project.title,
          projectCode: poster.project.code,
          posterId: poster.id,
          version: poster.version,
          sentAt: deliveredAt,
        }),
        portalAccountId: poster.project.portalAccountId,
        audience: "PORTAL",
      });
    }

    await writeAudit({
      userId: auth.userId,
      action: resend ? "POSTER_RESEND_TO_CUSTOMER" : "POSTER_SEND_TO_CUSTOMER",
      entityType: "ProjectPoster",
      entityId: poster.id,
      after: { projectId, version: poster.version, resend },
      req,
    });

    const project = await loadProjectForPosters(projectId);
    return {
      poster: serializePoster(updated),
      ...(await listSerialized(projectId)),
      project: {
        id: project.id,
        code: project.code,
        title: project.title,
        status: project.status,
      },
    };
  },
};

export async function listDeliveredPostersForPortal(projectId) {
  const rows = await prisma.projectPoster.findMany({
    where: { projectId, status: "SENT_TO_CUSTOMER" },
    include: POSTER_INCLUDE,
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
  });
  return markLatestFlags(
    rows.map((row) => serializePoster(row, { forCustomer: true })),
  );
}
