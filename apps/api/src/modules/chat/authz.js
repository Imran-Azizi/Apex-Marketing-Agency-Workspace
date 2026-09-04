import { prisma } from "../../db/prisma.js";
import { AppError } from "../../utils/response.js";
import {
  isChatEmployeeRole,
  isChatManagerRole,
  orderedUserPair,
} from "./constants.js";

/**
 * Load (or create) org-wide chat settings. Default: employee-to-employee DISABLED.
 */
export async function getOrgSettings(tx = prisma) {
  const existing = await tx.chatOrgSettings.findUnique({
    where: { id: "default" },
  });
  if (existing) return existing;
  return tx.chatOrgSettings.create({
    data: { id: "default", employeePolicy: "DISABLED" },
  });
}

async function loadActiveUser(userId, tx = prisma) {
  return tx.user.findFirst({
    where: { id: userId, isActive: true, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      profileImage: true,
      isActive: true,
      role: { select: { code: true } },
      teamProfile: { select: { kind: true } },
    },
  });
}

async function hasSelectedPair(userAId, userBId, tx = prisma) {
  const pair = orderedUserPair(userAId, userBId);
  const row = await tx.chatEmployeeAllowPair.findUnique({
    where: {
      userLowId_userHighId: {
        userLowId: pair.userLowId,
        userHighId: pair.userHighId,
      },
    },
    select: { id: true },
  });
  return Boolean(row);
}

/**
 * Server-side communication authorization.
 * Never trust the client for this decision.
 *
 * Rules:
 * - Self: never
 * - Either party inactive: no
 * - Either is manager/admin: yes
 * - Employee ↔ employee: only when org policy permits
 */
export async function canUsersCommunicate(actorId, targetId, tx = prisma) {
  if (!actorId || !targetId || actorId === targetId) {
    return { allowed: false, reason: "INVALID_TARGET" };
  }

  const [actor, target, settings] = await Promise.all([
    loadActiveUser(actorId, tx),
    loadActiveUser(targetId, tx),
    getOrgSettings(tx),
  ]);

  if (!actor || !target) {
    return { allowed: false, reason: "USER_NOT_FOUND" };
  }

  const actorRole = actor.role?.code;
  const targetRole = target.role?.code;

  if (isChatManagerRole(actorRole) || isChatManagerRole(targetRole)) {
    return { allowed: true, reason: "MANAGER_CHANNEL", settings, actor, target };
  }

  if (!isChatEmployeeRole(actorRole) || !isChatEmployeeRole(targetRole)) {
    return { allowed: false, reason: "ROLE_NOT_SUPPORTED", settings, actor, target };
  }

  const policy = settings.employeePolicy || "DISABLED";

  if (policy === "DISABLED") {
    return {
      allowed: false,
      reason: "EMPLOYEE_CHAT_DISABLED",
      settings,
      actor,
      target,
    };
  }

  if (policy === "ALL_EMPLOYEES") {
    return { allowed: true, reason: "POLICY_ALL", settings, actor, target };
  }

  if (policy === "SAME_TEAM") {
    const aKind = actor.teamProfile?.kind || null;
    const bKind = target.teamProfile?.kind || null;
    if (aKind && bKind && aKind === bKind) {
      return { allowed: true, reason: "POLICY_SAME_TEAM", settings, actor, target };
    }
    return {
      allowed: false,
      reason: "DIFFERENT_TEAM",
      settings,
      actor,
      target,
    };
  }

  if (policy === "SELECTED") {
    const ok = await hasSelectedPair(actorId, targetId, tx);
    if (ok) {
      return { allowed: true, reason: "POLICY_SELECTED", settings, actor, target };
    }
    return {
      allowed: false,
      reason: "NOT_IN_ALLOW_LIST",
      settings,
      actor,
      target,
    };
  }

  return { allowed: false, reason: "EMPLOYEE_CHAT_DISABLED", settings, actor, target };
}

export async function assertCanCommunicate(actorId, targetId, tx = prisma) {
  const result = await canUsersCommunicate(actorId, targetId, tx);
  if (!result.allowed) {
    const messages = {
      INVALID_TARGET: "گیرنده نامعتبر است",
      USER_NOT_FOUND: "کاربر یافت نشد یا غیرفعال است",
      ROLE_NOT_SUPPORTED: "این نقش مجاز به گفتگو نیست",
      EMPLOYEE_CHAT_DISABLED:
        "گفتگوی کارمند با کارمند توسط مدیر غیرفعال شده است",
      DIFFERENT_TEAM: "گفتگو فقط بین اعضای یک تیم مجاز است",
      NOT_IN_ALLOW_LIST: "شما مجاز به گفتگو با این کاربر نیستید",
    };
    throw new AppError(
      messages[result.reason] || "مجوز گفتگو وجود ندارد",
      403,
      "CHAT_FORBIDDEN",
      { reason: result.reason },
    );
  }
  return result;
}

/**
 * Assert the authenticated user is an active participant of the conversation.
 */
export async function assertConversationMember(conversationId, userId, tx = prisma) {
  const participation = await tx.chatParticipant.findFirst({
    where: {
      conversationId,
      userId,
      leftAt: null,
      conversation: { deletedAt: null },
    },
    include: {
      conversation: {
        select: {
          id: true,
          type: true,
          directKey: true,
          title: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!participation) {
    throw new AppError("گفتگو یافت نشد یا دسترسی ندارید", 404, "CHAT_NOT_FOUND");
  }

  return participation;
}

/**
 * For DIRECT conversations, re-check that both participants may still communicate.
 * (Policy may have been revoked after the room was created.)
 */
export async function assertDirectStillAllowed(conversationId, userId, tx = prisma) {
  const membership = await assertConversationMember(conversationId, userId, tx);
  if (membership.conversation.type !== "DIRECT") return membership;

  const others = await tx.chatParticipant.findMany({
    where: {
      conversationId,
      leftAt: null,
      userId: { not: userId },
    },
    select: { userId: true },
  });

  for (const other of others) {
    await assertCanCommunicate(userId, other.userId, tx);
  }

  return membership;
}

export function requireChatPermission(auth) {
  if (!auth?.userId || auth.audience !== "INTERNAL") {
    throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
  }
  if (!auth.user?.isActive && auth.user?.isActive !== undefined) {
    throw new AppError("حساب کاربری غیرفعال است", 403, "FORBIDDEN");
  }
}
