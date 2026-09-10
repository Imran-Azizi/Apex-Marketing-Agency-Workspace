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

function pairKey(userAId, userBId) {
  const pair = orderedUserPair(userAId, userBId);
  return `${pair.userLowId}:${pair.userHighId}`;
}

function decideCommunication({ actor, target, settings, pairExists = false }) {
  if (!actor || !target) {
    return { allowed: false, reason: "USER_NOT_FOUND", settings, actor, target };
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
    if (pairExists) {
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

  let pairExists = false;
  const policy = settings.employeePolicy || "DISABLED";
  const needsPair =
    policy === "SELECTED" &&
    actor &&
    target &&
    !isChatManagerRole(actor.role?.code) &&
    !isChatManagerRole(target.role?.code) &&
    isChatEmployeeRole(actor.role?.code) &&
    isChatEmployeeRole(target.role?.code);
  if (needsPair) {
    pairExists = await hasSelectedPair(actorId, targetId, tx);
  }

  return decideCommunication({ actor, target, settings, pairExists });
}

/**
 * Batch authorization for directory / conversation lists.
 * Same rules as canUsersCommunicate — one settings load, one user query, one pair query.
 */
export async function canUsersCommunicateMany(actorId, targetIds, tx = prisma) {
  const unique = [
    ...new Set(
      (targetIds || []).filter((id) => id && id !== actorId).map(String),
    ),
  ];
  const results = new Map();
  if (!actorId || !unique.length) return results;

  const [actor, targets, settings] = await Promise.all([
    loadActiveUser(actorId, tx),
    tx.user.findMany({
      where: { id: { in: unique }, isActive: true, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        profileImage: true,
        isActive: true,
        role: { select: { code: true } },
        teamProfile: { select: { kind: true } },
      },
    }),
    getOrgSettings(tx),
  ]);

  const targetById = new Map(targets.map((row) => [row.id, row]));
  const policy = settings.employeePolicy || "DISABLED";
  const actorIsManager = isChatManagerRole(actor?.role?.code);
  const pairSet = new Set();

  if (
    policy === "SELECTED" &&
    actor &&
    !actorIsManager &&
    isChatEmployeeRole(actor.role?.code)
  ) {
    const employeeTargets = unique.filter((id) => {
      const target = targetById.get(id);
      return (
        target &&
        !isChatManagerRole(target.role?.code) &&
        isChatEmployeeRole(target.role?.code)
      );
    });
    if (employeeTargets.length) {
      const pairs = employeeTargets.map((id) => orderedUserPair(actorId, id));
      const rows = await tx.chatEmployeeAllowPair.findMany({
        where: {
          OR: pairs.map((p) => ({
            userLowId: p.userLowId,
            userHighId: p.userHighId,
          })),
        },
        select: { userLowId: true, userHighId: true },
      });
      for (const row of rows) {
        pairSet.add(`${row.userLowId}:${row.userHighId}`);
      }
    }
  }

  for (const targetId of unique) {
    results.set(
      targetId,
      decideCommunication({
        actor,
        target: targetById.get(targetId) || null,
        settings,
        pairExists: pairSet.has(pairKey(actorId, targetId)),
      }),
    );
  }

  return results;
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
