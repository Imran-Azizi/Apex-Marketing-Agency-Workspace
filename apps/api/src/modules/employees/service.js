import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../utils/response.js";
import { hashPassword } from "../../utils/passwords.js";
import { writeAudit } from "../../middleware/audit.js";
import { createNotificationOnce } from "../../services/notifications.js";

/** Roles managers can assign when creating/editing employees. */
export const EMPLOYEE_ROLES = ["SALES", "EDITOR", "NARRATOR", "FINANCE"];

/** All internal staff roles shown in the employee list. */
export const STAFF_ROLES = [
  "MANAGER",
  "ADMIN",
  "SALES",
  "EDITOR",
  "NARRATOR",
  "FINANCE",
];

const ROLE_TO_TEAM_KIND = {
  SALES: "SALES",
  EDITOR: "EDITOR",
  NARRATOR: "NARRATOR",
  FINANCE: "FINANCE",
  MANAGER: "MANAGER",
  ADMIN: "MANAGER",
};

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  profileImage: true,
  cvStorageKey: true,
  cvFileName: true,
  cvMimeType: true,
  cvSizeBytes: true,
  cvUploadedAt: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, code: true, name: true } },
  teamProfile: {
    select: {
      id: true,
      kind: true,
      displayName: true,
      status: true,
    },
  },
};

const cvFieldsSchema = {
  cvStorageKey: z.string().optional().nullable(),
  cvFileName: z.string().optional().nullable(),
  cvMimeType: z.string().optional().nullable(),
  cvSizeBytes: z.number().int().nonnegative().optional().nullable(),
  cvUploadedAt: z.union([z.string(), z.date()]).optional().nullable(),
};

export const createEmployeeSchema = z.object({
  fullName: z.string().min(2, "نام باید حداقل ۲ حرف باشد"),
  email: z.string().email("ایمیل معتبر وارد کنید"),
  phone: z.string().optional().nullable(),
  password: z.string().min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد"),
  role: z.enum(EMPLOYEE_ROLES),
  profileImage: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  ...cvFieldsSchema,
});

export const updateEmployeeSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  role: z.enum(EMPLOYEE_ROLES).optional(),
  profileImage: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  ...cvFieldsSchema,
});

function normalizeCvPayload(body) {
  if (body.cvStorageKey === undefined) return {};
  if (!body.cvStorageKey) {
    return {
      cvStorageKey: null,
      cvFileName: null,
      cvMimeType: null,
      cvSizeBytes: null,
      cvUploadedAt: null,
    };
  }
  const uploadedAt = body.cvUploadedAt
    ? new Date(body.cvUploadedAt)
    : new Date();
  return {
    cvStorageKey: body.cvStorageKey,
    cvFileName: body.cvFileName?.trim() || null,
    cvMimeType: body.cvMimeType?.trim() || null,
    cvSizeBytes:
      body.cvSizeBytes != null && Number.isFinite(Number(body.cvSizeBytes))
        ? Number(body.cvSizeBytes)
        : null,
    cvUploadedAt: Number.isNaN(uploadedAt.getTime()) ? new Date() : uploadedAt,
  };
}

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد"),
});

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

async function ensureRole(code) {
  const role = await prisma.role.findUnique({ where: { code } });
  if (!role)
    throw new AppError(
      `نقش ${code} در سیستم تعریف نشده است`,
      500,
      "ROLE_MISSING",
    );
  return role;
}

async function syncTeamProfile(tx, user, roleCode) {
  const kind = ROLE_TO_TEAM_KIND[roleCode];
  if (!kind) return null;

  const existing = await tx.teamProfile.findUnique({
    where: { userId: user.id },
  });
  if (existing) {
    return tx.teamProfile.update({
      where: { id: existing.id },
      data: {
        kind,
        displayName: user.fullName,
        status: user.isActive ? "ACTIVE" : "INACTIVE",
        deletedAt: null,
      },
    });
  }

  return tx.teamProfile.create({
    data: {
      userId: user.id,
      kind,
      displayName: user.fullName,
      status: user.isActive ? "ACTIVE" : "INACTIVE",
    },
  });
}

export const employeesService = {
  async list({ q, role, status, page = 1, pageSize = 20 } = {}) {
    const where = {
      deletedAt: null,
      role: { code: { in: STAFF_ROLES } },
    };

    if (q) {
      where.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
      ];
    }

    if (role && STAFF_ROLES.includes(role)) {
      where.role = { code: role };
    }

    if (status === "active") where.isActive = true;
    if (status === "inactive") where.isActive = false;

    const skip = (Math.max(1, page) - 1) * pageSize;
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return { items, total, page, pageSize };
  },

  async getById(id) {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null, role: { code: { in: STAFF_ROLES } } },
      select: {
        ...userSelect,
        role: {
          select: {
            id: true,
            code: true,
            name: true,
            permissions: {
              select: {
                permission: { select: { code: true, description: true } },
              },
            },
          },
        },
      },
    });
    if (!user) throw new AppError("کارمند یافت نشد", 404, "NOT_FOUND");

    return {
      ...user,
      permissions: user.role.permissions.map((p) => p.permission.code),
      role: { id: user.role.id, code: user.role.code, name: user.role.name },
    };
  },

  async create(body, auth, req) {
    const email = normalizeEmail(body.email);
    const existing = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (existing) {
      throw new AppError(
        "این ایمیل قبلاً ثبت شده است",
        409,
        "DUPLICATE_EMAIL",
        {
          employeeId: existing.id,
        },
      );
    }

    const role = await ensureRole(body.role);
    const passwordHash = await hashPassword(body.password);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          fullName: body.fullName.trim(),
          phone: body.phone?.trim() || null,
          profileImage: body.profileImage || null,
          ...normalizeCvPayload(body),
          passwordHash,
          isActive: body.isActive ?? true,
          roleId: role.id,
        },
        select: userSelect,
      });

      await syncTeamProfile(tx, created, body.role);
      return tx.user.findUnique({
        where: { id: created.id },
        select: userSelect,
      });
    });

    await createNotificationOnce({
      userId: user.id,
      audience: "INTERNAL",
      title: "حساب کاربری شما ایجاد شد",
      body: [
        `سلام ${user.fullName}،`,
        `حساب شما با نقش ${body.role} در سیستم اپیکس ایجاد شد.`,
        `ایمیل ورود: ${user.email}`,
        "لطفاً پس از ورود اول، رمز عبور خود را تغییر دهید.",
      ].join("\n"),
      link: "/",
      eventKey: `employee.created:${user.id}`,
      meta: { role: body.role, createdBy: auth.userId },
    });

    await writeAudit({
      userId: auth.userId,
      action: "EMPLOYEE_CREATE",
      entityType: "User",
      entityId: user.id,
      after: { email: user.email, role: body.role, fullName: user.fullName },
      req,
    });

    return user;
  },

  async update(id, body, auth, req) {
    const current = await prisma.user.findFirst({
      where: { id, deletedAt: null, role: { code: { in: STAFF_ROLES } } },
      include: { role: true },
    });
    if (!current) throw new AppError("کارمند یافت نشد", 404, "NOT_FOUND");

    if (["MANAGER", "ADMIN"].includes(current.role.code) && body.role) {
      throw new AppError(
        "نقش مدیران از این بخش قابل تغییر نیست",
        400,
        "ROLE_LOCKED",
      );
    }

    if (auth.userId === id && body.isActive === false) {
      throw new AppError(
        "نمی‌توانید حساب خود را غیرفعال کنید",
        400,
        "SELF_DEACTIVATE",
      );
    }

    let roleId = current.roleId;
    let nextRoleCode = current.role.code;

    if (body.role) {
      if (!EMPLOYEE_ROLES.includes(body.role)) {
        throw new AppError("نقش انتخاب‌شده مجاز نیست", 400, "INVALID_ROLE");
      }
      const role = await ensureRole(body.role);
      roleId = role.id;
      nextRoleCode = body.role;
    }

    if (body.email) {
      const email = normalizeEmail(body.email);
      const dup = await prisma.user.findFirst({
        where: { email, deletedAt: null, NOT: { id } },
      });
      if (dup) {
        throw new AppError(
          "این ایمیل قبلاً ثبت شده است",
          409,
          "DUPLICATE_EMAIL",
        );
      }
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(body.fullName !== undefined
            ? { fullName: body.fullName.trim() }
            : {}),
          ...(body.email !== undefined
            ? { email: normalizeEmail(body.email) }
            : {}),
          ...(body.phone !== undefined
            ? { phone: body.phone?.trim() || null }
            : {}),
          ...(body.profileImage !== undefined
            ? { profileImage: body.profileImage || null }
            : {}),
          ...(body.cvStorageKey !== undefined ? normalizeCvPayload(body) : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          roleId,
        },
        select: userSelect,
      });

      if (
        EMPLOYEE_ROLES.includes(nextRoleCode) ||
        ROLE_TO_TEAM_KIND[nextRoleCode]
      ) {
        await syncTeamProfile(tx, updated, nextRoleCode);
      }

      return updated;
    });

    await writeAudit({
      userId: auth.userId,
      action: "EMPLOYEE_UPDATE",
      entityType: "User",
      entityId: id,
      before: {
        fullName: current.fullName,
        email: current.email,
        role: current.role.code,
        isActive: current.isActive,
      },
      after: body,
      req,
    });

    return user;
  },

  async setActive(id, isActive, auth, req) {
    if (auth.userId === id && !isActive) {
      throw new AppError(
        "نمی‌توانید حساب خود را غیرفعال کنید",
        400,
        "SELF_DEACTIVATE",
      );
    }

    const current = await prisma.user.findFirst({
      where: { id, deletedAt: null, role: { code: { in: STAFF_ROLES } } },
      include: { role: true },
    });
    if (!current) throw new AppError("کارمند یافت نشد", 404, "NOT_FOUND");

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { isActive },
        select: userSelect,
      });

      if (updated.teamProfile || ROLE_TO_TEAM_KIND[current.role.code]) {
        await syncTeamProfile(tx, updated, current.role.code);
      }

      if (!isActive) {
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      return updated;
    });

    await writeAudit({
      userId: auth.userId,
      action: isActive ? "EMPLOYEE_ACTIVATE" : "EMPLOYEE_DEACTIVATE",
      entityType: "User",
      entityId: id,
      after: { isActive },
      req,
    });

    return user;
  },

  async resetPassword(id, password, auth, req) {
    const current = await prisma.user.findFirst({
      where: { id, deletedAt: null, role: { code: { in: STAFF_ROLES } } },
    });
    if (!current) throw new AppError("کارمند یافت نشد", 404, "NOT_FOUND");

    const passwordHash = await hashPassword(password);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash } });
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await createNotificationOnce({
      userId: id,
      audience: "INTERNAL",
      title: "رمز عبور شما بازنشانی شد",
      body: "مدیر سیستم رمز عبور حساب شما را تغییر داد. لطفاً با رمز جدید وارد شوید.",
      link: "/login",
      eventKey: `employee.password_reset:${id}:${Date.now()}`,
      meta: { resetBy: auth.userId },
    });

    await writeAudit({
      userId: auth.userId,
      action: "EMPLOYEE_RESET_PASSWORD",
      entityType: "User",
      entityId: id,
      req,
    });

    return { ok: true };
  },

  async softDelete(id, auth, req) {
    if (auth.userId === id) {
      throw new AppError("نمی‌توانید حساب خود را حذف کنید", 400, "SELF_DELETE");
    }

    const current = await prisma.user.findFirst({
      where: { id, deletedAt: null, role: { code: { in: STAFF_ROLES } } },
      include: { role: true },
    });
    if (!current) throw new AppError("کارمند یافت نشد", 404, "NOT_FOUND");

    if (["MANAGER", "ADMIN"].includes(current.role.code)) {
      throw new AppError(
        "حذف حساب مدیر از این بخش مجاز نیست",
        400,
        "MANAGER_DELETE_BLOCKED",
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          isActive: false,
          deletedAt: new Date(),
          email: `deleted_${Date.now()}_${current.email}`,
        },
      });
      await tx.teamProfile.updateMany({
        where: { userId: id, deletedAt: null },
        data: { deletedAt: new Date(), status: "INACTIVE" },
      });
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await writeAudit({
      userId: auth.userId,
      action: "EMPLOYEE_DELETE",
      entityType: "User",
      entityId: id,
      before: { email: current.email, role: current.role.code },
      req,
    });

    return { ok: true };
  },
};
