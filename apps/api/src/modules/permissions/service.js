import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../utils/response.js";
import { writeAudit } from "../../middleware/audit.js";
import {
  ALL_PERMISSION_CODES,
  PERMISSION_CATALOG,
  getGrantableCodes,
  isFullAccessRole,
  isLockedAccessRole,
  isManageableStaffRole,
  getRoleDefaultPermissions,
} from "../../services/permissions/catalog.js";
import {
  computeEffectivePermissions,
  catalogCodesSet,
  diffPermissionSets,
} from "../../services/permissions/effective.js";

const STAFF_ROLES = [
  "MANAGER",
  "ADMIN",
  "SALES",
  "EDITOR",
  "NARRATOR",
  "FINANCE",
];

const employeeSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  profileImage: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  role: { select: { id: true, code: true, name: true } },
};

export const updatePermissionsSchema = z.object({
  codes: z.array(z.string().min(1)).max(200),
});

function canActorManageTarget(actor, target) {
  if (!actor?.userId || !target) return { ok: false, reason: "FORBIDDEN" };
  if (actor.userId === target.id) {
    return {
      ok: false,
      reason: "SELF",
      message: "نمی‌توانید دسترسی‌های خودتان را تغییر دهید",
    };
  }
  if (isLockedAccessRole(target.role.code)) {
    return {
      ok: false,
      reason: "LOCKED",
      message: "دسترسی مدیر و ادمین کامل است و قابل تغییر نیست",
    };
  }
  if (!isManageableStaffRole(target.role.code)) {
    return {
      ok: false,
      reason: "ROLE",
      message: "این نقش قابل سفارشی‌سازی نیست",
    };
  }
  if (
    !isFullAccessRole(actor.roleCode) &&
    !actor.permissions?.includes("settings.permissions")
  ) {
    return {
      ok: false,
      reason: "FORBIDDEN",
      message: "اجازه مدیریت دسترسی‌ها را ندارید",
    };
  }
  return { ok: true };
}

async function loadTargetWithPerms(id) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null, role: { code: { in: STAFF_ROLES } } },
    select: {
      ...employeeSelect,
      role: {
        select: {
          id: true,
          code: true,
          name: true,
          permissions: { select: { permission: { select: { code: true } } } },
        },
      },
      userPermissions: {
        select: { granted: true, permission: { select: { code: true } } },
      },
    },
  });
  if (!user) throw new AppError("کارمند یافت نشد", 404, "NOT_FOUND");
  return user;
}

function summarize(user, actor) {
  const roleDefaults = getRoleDefaultPermissions(user.role.code);
  const effective = computeEffectivePermissions({
    roleCode: user.role.code,
    rolePermissionCodes:
      user.role.permissions?.map((row) => row.permission.code) || roleDefaults,
    overrides: (user.userPermissions || []).map((row) => ({
      code: row.permission.code,
      granted: row.granted,
    })),
  });
  const catalogSet = catalogCodesSet();
  const enabled = effective.filter((code) => catalogSet.has(code));
  const manage = canActorManageTarget(actor, user);
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    profileImage: user.profileImage,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    role: { id: user.role.id, code: user.role.code, name: user.role.name },
    totalPermissions: ALL_PERMISSION_CODES.length,
    enabledCount: isLockedAccessRole(user.role.code)
      ? ALL_PERMISSION_CODES.length
      : enabled.length,
    disabledCount: isLockedAccessRole(user.role.code)
      ? 0
      : ALL_PERMISSION_CODES.length - enabled.length,
    isCustomized: (user.userPermissions || []).length > 0,
    locked: !manage.ok,
    lockedReason: manage.ok ? null : manage.reason,
    canManage: manage.ok,
  };
}

export const permissionsService = {
  getCatalog() {
    return {
      modules: PERMISSION_CATALOG,
      total: ALL_PERMISSION_CODES.length,
    };
  },

  async listEmployees(query, actor) {
    const q = String(query.q || "").trim();
    const role = query.role && query.role !== "ALL" ? String(query.role) : null;
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)));

    const where = {
      deletedAt: null,
      role: {
        code: role && STAFF_ROLES.includes(role) ? role : { in: STAFF_ROLES },
      },
    };
    if (q) {
      where.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          ...employeeSelect,
          role: {
            select: {
              id: true,
              code: true,
              name: true,
              permissions: {
                select: { permission: { select: { code: true } } },
              },
            },
          },
          userPermissions: {
            select: { granted: true, permission: { select: { code: true } } },
          },
        },
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items: items.map((user) => summarize(user, actor)),
      total,
      page,
      pageSize,
      catalogTotal: ALL_PERMISSION_CODES.length,
    };
  },

  async getEmployee(id, actor) {
    const user = await loadTargetWithPerms(id);
    const roleDefaults = getRoleDefaultPermissions(user.role.code);
    const effective = computeEffectivePermissions({
      roleCode: user.role.code,
      rolePermissionCodes: user.role.permissions.map(
        (row) => row.permission.code,
      ),
      overrides: user.userPermissions.map((row) => ({
        code: row.permission.code,
        granted: row.granted,
      })),
    });
    const catalogSet = catalogCodesSet();
    const enabled = isLockedAccessRole(user.role.code)
      ? [...ALL_PERMISSION_CODES]
      : effective.filter((code) => catalogSet.has(code));
    const manage = canActorManageTarget(actor, user);

    return {
      employee: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        profileImage: user.profileImage,
        isActive: user.isActive,
        role: { id: user.role.id, code: user.role.code, name: user.role.name },
      },
      catalog: PERMISSION_CATALOG,
      roleDefaults,
      effective: enabled,
      overrides: user.userPermissions.map((row) => ({
        code: row.permission.code,
        granted: row.granted,
      })),
      totalPermissions: ALL_PERMISSION_CODES.length,
      enabledCount: enabled.length,
      disabledCount: ALL_PERMISSION_CODES.length - enabled.length,
      locked: !manage.ok,
      lockedReason: manage.ok ? null : manage.reason,
      lockedMessage: manage.ok ? null : manage.message,
      canManage: manage.ok,
    };
  },

  async updateEmployee(id, body, actor, req) {
    const user = await loadTargetWithPerms(id);
    const manage = canActorManageTarget(actor, user);
    if (!manage.ok) {
      throw new AppError(
        manage.message || "اجازه این عملیات را ندارید",
        403,
        manage.reason || "FORBIDDEN",
      );
    }

    const catalogSet = catalogCodesSet();
    const requested = [
      ...new Set((body.codes || []).filter((code) => catalogSet.has(code))),
    ];
    const unknown = (body.codes || []).filter((code) => !catalogSet.has(code));
    if (unknown.length) {
      throw new AppError(
        "شناسه دسترسی نامعتبر است",
        400,
        "INVALID_PERMISSION",
        { unknown },
      );
    }

    const grantable = getGrantableCodes(actor);
    const extras = requested.filter((code) => !grantable.has(code));
    if (extras.length) {
      throw new AppError(
        "نمی‌توانید دسترسی‌ای را اعطا کنید که خودتان ندارید",
        403,
        "PRIVILEGE_ESCALATION",
        { codes: extras },
      );
    }

    const roleDefaults = getRoleDefaultPermissions(user.role.code);
    const previous = computeEffectivePermissions({
      roleCode: user.role.code,
      rolePermissionCodes: user.role.permissions.map(
        (row) => row.permission.code,
      ),
      overrides: user.userPermissions.map((row) => ({
        code: row.permission.code,
        granted: row.granted,
      })),
    }).filter((code) => catalogSet.has(code));

    const nextSet = new Set(requested);
    const toGrant = requested.filter((code) => !roleDefaults.includes(code));
    const toRevoke = roleDefaults.filter((code) => !nextSet.has(code));

    const permissionRows = await prisma.permission.findMany({
      where: { code: { in: [...new Set([...toGrant, ...toRevoke])] } },
      select: { id: true, code: true },
    });
    const idByCode = Object.fromEntries(
      permissionRows.map((row) => [row.code, row.id]),
    );

    await prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId: user.id } });
      const data = [
        ...toGrant
          .filter((code) => idByCode[code])
          .map((code) => ({
            userId: user.id,
            permissionId: idByCode[code],
            granted: true,
          })),
        ...toRevoke
          .filter((code) => idByCode[code])
          .map((code) => ({
            userId: user.id,
            permissionId: idByCode[code],
            granted: false,
          })),
      ];
      if (data.length) {
        await tx.userPermission.createMany({ data });
      }
    });

    const { added, removed } = diffPermissionSets(previous, requested);

    await writeAudit({
      userId: actor.userId,
      action: "PERMISSIONS_UPDATE",
      entityType: "User",
      entityId: user.id,
      before: { codes: previous },
      after: {
        codes: requested,
        added,
        removed,
        targetUserId: user.id,
        targetName: user.fullName,
        targetRole: user.role.code,
      },
      req,
    });

    return this.getEmployee(id, actor);
  },
};
