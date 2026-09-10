import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/response.js";

/**
 * Object-level project visibility.
 * Manager/Admin/Finance/Sales/PM: all live projects (permission still required at the route).
 * Editor/Narrator: assigned projects only.
 */
export function canAccessProject(project, auth) {
  if (!auth) return false;
  const role = String(auth.roleCode || "").toUpperCase();
  if (
    role === "MANAGER" ||
    role === "ADMIN" ||
    role === "FINANCE" ||
    role === "SALES" ||
    role === "PROJECT_MANAGER"
  ) {
    return true;
  }
  if (role === "EDITOR" || role === "NARRATOR") {
    return Boolean(
      project?.assignments?.some(
        (a) =>
          a.isActive &&
          (a.userId === auth.userId || a.teamProfile?.userId === auth.userId),
      ),
    );
  }
  return false;
}

export async function assertProjectAccess(projectId, auth) {
  if (!projectId) throw new AppError("پروژه یافت نشد", 404, "NOT_FOUND");
  const project = await prisma.project.findFirst({
    where: { id: String(projectId), deletedAt: null },
    include: {
      assignments: { include: { teamProfile: { select: { userId: true } } } },
    },
  });
  if (!project) throw new AppError("پروژه یافت نشد", 404, "NOT_FOUND");
  if (!canAccessProject(project, auth)) {
    throw new AppError("دسترسی به این پروژه ندارید", 403, "FORBIDDEN");
  }
  return project;
}
