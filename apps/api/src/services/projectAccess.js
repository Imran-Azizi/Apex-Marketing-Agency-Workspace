import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/response.js";

/** Staff roles that managers can assign as project lead. */
export const PROJECT_LEAD_CANDIDATE_ROLES = Object.freeze([
  "SALES",
  "EDITOR",
  "NARRATOR",
  "FINANCE",
  "PROJECT_MANAGER",
]);

const leadAssignmentSome = (userId) => ({
  isActive: true,
  role: "PROJECT_LEAD",
  OR: [{ userId }, { teamProfile: { userId } }],
});

/** Active PROJECT_LEAD assignment matching this user (by userId or team profile). */
export function hasActiveProjectLeadAssignment(project, userId) {
  if (!userId || !project?.assignments?.length) return false;
  return project.assignments.some(
    (a) =>
      a.isActive &&
      a.role === "PROJECT_LEAD" &&
      (a.userId === userId || a.teamProfile?.userId === userId),
  );
}

/**
 * Prisma filter: projects where this user is the active project lead,
 * including CHILD videos under a contract they lead.
 */
export function projectLeadScopeWhere(userId) {
  const leadSome = leadAssignmentSome(userId);
  return {
    OR: [
      { assignments: { some: leadSome } },
      {
        kind: "CHILD",
        parentProject: {
          deletedAt: null,
          assignments: { some: leadSome },
        },
      },
    ],
  };
}

/**
 * Object-level project visibility.
 * Manager/Admin: all live projects (permission still required at the route).
 * Project lead: their lead projects, and CHILD videos of contracts they lead.
 * Sales/Finance without lead elevation: all live projects (existing behaviour).
 * Sales/Finance with lead elevation: only lead-scoped projects.
 * Editor/Narrator: lead projects if elevated, else editor/narrator assignment only.
 */
export function canAccessProject(project, auth) {
  if (!auth) return false;
  const role = String(auth.roleCode || "").toUpperCase();
  if (role === "MANAGER" || role === "ADMIN") {
    return true;
  }
  if (hasActiveProjectLeadAssignment(project, auth.userId)) {
    return true;
  }
  // Child video: parent-contract lead has the same workspace access
  if (
    project?.kind === "CHILD" &&
    hasActiveProjectLeadAssignment(project.parentProject, auth.userId)
  ) {
    return true;
  }
  if (role === "FINANCE" || role === "SALES") {
    if (auth.projectLeadElevated) return false;
    return true;
  }
  if (role === "PROJECT_MANAGER") {
    return false;
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

const projectAccessInclude = {
  assignments: { include: { teamProfile: { select: { userId: true } } } },
  parentProject: {
    select: {
      id: true,
      kind: true,
      deletedAt: true,
      assignments: {
        where: { isActive: true, role: "PROJECT_LEAD" },
        include: { teamProfile: { select: { userId: true } } },
      },
    },
  },
};

export async function assertProjectAccess(projectId, auth) {
  if (!projectId) throw new AppError("پروژه یافت نشد", 404, "NOT_FOUND");
  const project = await prisma.project.findFirst({
    where: { id: String(projectId), deletedAt: null },
    include: projectAccessInclude,
  });
  if (!project) throw new AppError("پروژه یافت نشد", 404, "NOT_FOUND");
  if (!canAccessProject(project, auth)) {
    throw new AppError("دسترسی به این پروژه ندارید", 403, "FORBIDDEN");
  }
  return project;
}

/** Resolve the active project lead from assignment rows (if any). */
export function resolveProjectLead(assignments = []) {
  const lead = (assignments || []).find(
    (a) => a.isActive && a.role === "PROJECT_LEAD",
  );
  if (!lead) return null;
  return {
    assignmentId: lead.id,
    userId: lead.userId || lead.teamProfile?.userId || null,
    teamProfileId: lead.teamProfileId || lead.teamProfile?.id || null,
    fullName:
      lead.user?.fullName ||
      lead.teamProfile?.displayName ||
      lead.teamProfile?.realName ||
      null,
    profileImage: lead.user?.profileImage || null,
    assignedAt: lead.createdAt || null,
    notes: lead.notes || null,
  };
}

/**
 * Copy active PROJECT_LEAD rows from a CONTRACT onto a CHILD video
 * so the lead can list/open/manage sub-projects like a manager.
 */
export async function inheritProjectLeadsFromParent(
  db,
  { parentProjectId, childProjectId, assignedById = null },
) {
  if (!parentProjectId || !childProjectId) return 0;
  const leads = await db.projectAssignment.findMany({
    where: {
      projectId: parentProjectId,
      role: "PROJECT_LEAD",
      isActive: true,
    },
  });
  for (const lead of leads) {
    await db.projectAssignment.create({
      data: {
        projectId: childProjectId,
        role: "PROJECT_LEAD",
        userId: lead.userId,
        teamProfileId: lead.teamProfileId,
        assignedById: assignedById || lead.assignedById || null,
        notes: lead.notes || "ارث‌بری از قرارداد مادر",
        isActive: true,
      },
    });
  }
  return leads.length;
}
