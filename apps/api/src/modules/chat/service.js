import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../utils/response.js";
import { writeAudit } from "../../middleware/audit.js";
import { createNotificationOnce } from "../../services/notifications.js";
import { isFullAccessRole } from "../../services/permissions/catalog.js";
import {
  assertCanCommunicate,
  assertConversationMember,
  assertDirectStillAllowed,
  canUsersCommunicate,
  getOrgSettings,
} from "./authz.js";
import {
  CHAT_MESSAGE_BODY_MAX,
  CHAT_REACTION_EMOJIS,
  directConversationKey,
  isChatManagerRole,
  orderedUserPair,
  previewFromMessage,
} from "./constants.js";
import {
  serializeAttachment,
  serializeConversation,
  serializeMessage,
  serializeOrgSettings,
} from "./serialize.js";

const userPublicSelect = {
  id: true,
  fullName: true,
  profileImage: true,
  role: { select: { code: true } },
  teamProfile: { select: { kind: true } },
};

const messageInclude = {
  sender: { select: userPublicSelect },
  attachments: true,
  reactions: true,
  deliveries: true,
  replyTo: {
    select: {
      id: true,
      body: true,
      senderId: true,
      type: true,
      deletedAt: true,
    },
  },
};

function sanitizePlainText(input) {
  return String(input || "")
    .replace(/\0/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
}

function escapeForStorage(text) {
  // Store as plain text; UI must never dangerouslySetInnerHTML.
  return sanitizePlainText(text).slice(0, CHAT_MESSAGE_BODY_MAX);
}

export const openDirectSchema = z.object({
  userId: z.string().min(1),
});

export const sendMessageSchema = z.object({
  type: z.enum(["TEXT", "VOICE", "IMAGE", "FILE"]).default("TEXT"),
  body: z.string().max(CHAT_MESSAGE_BODY_MAX).optional().nullable(),
  clientMessageId: z.string().min(8).max(64).optional().nullable(),
  replyToId: z.string().optional().nullable(),
  attachments: z
    .array(
      z.object({
        storageKey: z.string().min(1).max(500),
        fileName: z.string().min(1).max(200),
        mimeType: z.string().min(1).max(120),
        sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
        kind: z.enum(["IMAGE", "DOCUMENT", "VOICE", "AUDIO", "OTHER"]),
        durationMs: z.number().int().positive().max(5 * 60 * 1000).optional().nullable(),
      }),
    )
    .max(5)
    .optional(),
});

export const editMessageSchema = z.object({
  body: z.string().min(1).max(CHAT_MESSAGE_BODY_MAX),
});

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(16),
});

export const participantPrefsSchema = z.object({
  muted: z.boolean().optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export const orgSettingsSchema = z.object({
  employeePolicy: z.enum([
    "DISABLED",
    "ALL_EMPLOYEES",
    "SAME_TEAM",
    "SELECTED",
  ]),
});

export const allowPairSchema = z.object({
  userAId: z.string().min(1),
  userBId: z.string().min(1),
});

let presenceProvider = {
  getOnlineUserIds: () => new Set(),
  emitToUser: () => {},
  emitToConversation: () => {},
  isUserInConversation: () => false,
};

/** Wired by realtime layer after Socket.IO boots. */
export function setChatPresenceProvider(provider) {
  presenceProvider = { ...presenceProvider, ...provider };
}

async function countUnread(conversationId, userId, lastReadAt) {
  return prisma.chatMessage.count({
    where: {
      conversationId,
      deletedAt: null,
      senderId: { not: userId },
      ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
    },
  });
}

async function notifyRecipients({ conversation, message, sender, recipientIds }) {
  const preview = previewFromMessage({
    type: message.type,
    body: message.body,
    attachmentKind: message.attachments?.[0]?.kind,
  });

  await Promise.all(
    recipientIds.map(async (userId) => {
      if (presenceProvider.isUserInConversation(userId, conversation.id)) {
        return;
      }
      const participant = conversation.participants?.find(
        (p) => p.userId === userId,
      );
      if (participant?.mutedAt) return;

      await createNotificationOnce({
        userId,
        audience: "INTERNAL",
        title: `پیام جدید از ${sender.fullName}`,
        body: preview,
        link: null,
        meta: {
          type: "CHAT_MESSAGE",
          conversationId: conversation.id,
          messageId: message.id,
        },
        eventKey: `chat.message:${message.id}:user:${userId}`,
      });
    }),
  );
}

export const chatService = {
  async listDirectory(auth, { q } = {}) {
    const query = String(q || "").trim();
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        id: { not: auth.userId },
        role: {
          code: { in: ["MANAGER", "ADMIN", "SALES", "EDITOR", "NARRATOR", "FINANCE", "PROJECT_MANAGER"] },
        },
        ...(query
          ? {
              OR: [
                { fullName: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: userPublicSelect,
      orderBy: { fullName: "asc" },
      take: 80,
    });

    const settings = await getOrgSettings();
    const online = presenceProvider.getOnlineUserIds();
    const results = [];

    for (const user of users) {
      const check = await canUsersCommunicate(auth.userId, user.id);
      if (!check.allowed) continue;
      results.push({
        id: user.id,
        fullName: user.fullName,
        profileImage: user.profileImage,
        roleCode: user.role.code,
        teamKind: user.teamProfile?.kind || null,
        isOnline: online.has(user.id),
      });
    }

    return {
      users: results,
      employeePolicy: settings.employeePolicy,
    };
  },

  async listConversations(auth, { q } = {}) {
    const query = String(q || "").trim().toLowerCase();
    const rows = await prisma.chatParticipant.findMany({
      where: {
        userId: auth.userId,
        leftAt: null,
        archivedAt: null,
        conversation: { deletedAt: null },
      },
      include: {
        conversation: {
          include: {
            participants: {
              where: { leftAt: null },
              include: { user: { select: userPublicSelect } },
            },
          },
        },
      },
      orderBy: [
        { pinnedAt: "desc" },
        { conversation: { lastMessageAt: "desc" } },
      ],
      take: 100,
    });

    const online = presenceProvider.getOnlineUserIds();
    const list = [];

    for (const row of rows) {
      const conv = row.conversation;
      if (conv.type === "DIRECT") {
        const other = conv.participants.find((p) => p.userId !== auth.userId);
        if (other) {
          const check = await canUsersCommunicate(auth.userId, other.userId);
          if (!check.allowed) continue;
        }
      }

      const title =
        conv.type === "GROUP"
          ? conv.title || ""
          : conv.participants.find((p) => p.userId !== auth.userId)?.user
              ?.fullName || "";

      if (
        query &&
        !title.toLowerCase().includes(query) &&
        !String(conv.lastMessagePreview || "")
          .toLowerCase()
          .includes(query)
      ) {
        continue;
      }

      const unreadCount = await countUnread(
        conv.id,
        auth.userId,
        row.lastReadAt,
      );

      list.push(
        serializeConversation(
          { ...conv, unreadCount },
          { viewerId: auth.userId, onlineUserIds: online },
        ),
      );
    }

    list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bt - at;
    });

    return list;
  },

  async getConversation(auth, conversationId) {
    await assertDirectStillAllowed(conversationId, auth.userId);
    const conv = await prisma.chatConversation.findFirst({
      where: { id: conversationId, deletedAt: null },
      include: {
        participants: {
          where: { leftAt: null },
          include: { user: { select: userPublicSelect } },
        },
      },
    });
    if (!conv) throw new AppError("گفتگو یافت نشد", 404, "CHAT_NOT_FOUND");

    const me = conv.participants.find((p) => p.userId === auth.userId);
    const unreadCount = await countUnread(
      conv.id,
      auth.userId,
      me?.lastReadAt,
    );
    const online = presenceProvider.getOnlineUserIds();
    return serializeConversation(
      { ...conv, unreadCount },
      { viewerId: auth.userId, onlineUserIds: online },
    );
  },

  async openDirect(auth, { userId }, req) {
    await assertCanCommunicate(auth.userId, userId);
    const directKey = directConversationKey(auth.userId, userId);

    const existing = await prisma.chatConversation.findFirst({
      where: { directKey, deletedAt: null, type: "DIRECT" },
      include: {
        participants: {
          where: { leftAt: null },
          include: { user: { select: userPublicSelect } },
        },
      },
    });

    if (existing) {
      // Rejoin if previously left
      await prisma.chatParticipant.updateMany({
        where: {
          conversationId: existing.id,
          userId: { in: [auth.userId, userId] },
          leftAt: { not: null },
        },
        data: { leftAt: null },
      });
      const online = presenceProvider.getOnlineUserIds();
      return serializeConversation(existing, {
        viewerId: auth.userId,
        onlineUserIds: online,
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      const conversation = await tx.chatConversation.create({
        data: {
          type: "DIRECT",
          directKey,
          createdById: auth.userId,
          participants: {
            create: [{ userId: auth.userId }, { userId }],
          },
        },
        include: {
          participants: {
            include: { user: { select: userPublicSelect } },
          },
        },
      });
      return conversation;
    });

    await writeAudit({
      userId: auth.userId,
      action: "CHAT_DIRECT_OPEN",
      entityType: "ChatConversation",
      entityId: created.id,
      after: { peerId: userId },
      req,
    });

    const online = presenceProvider.getOnlineUserIds();
    return serializeConversation(created, {
      viewerId: auth.userId,
      onlineUserIds: online,
    });
  },

  async listMessages(auth, conversationId, { cursor, limit = 40 } = {}) {
    await assertDirectStillAllowed(conversationId, auth.userId);
    const take = Math.min(Math.max(Number(limit) || 40, 1), 100);

    const rows = await prisma.chatMessage.findMany({
      where: {
        conversationId,
        ...(cursor
          ? {
              createdAt: {
                lt: (
                  await prisma.chatMessage.findUnique({
                    where: { id: cursor },
                    select: { createdAt: true },
                  })
                )?.createdAt,
              },
            }
          : {}),
      },
      include: messageInclude,
      orderBy: { createdAt: "desc" },
      take: take + 1,
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    page.reverse();

    return {
      items: page.map((m) =>
        serializeMessage(m, { viewerId: auth.userId }),
      ),
      nextCursor: hasMore ? page[0]?.id : null,
      hasMore,
    };
  },

  async sendMessage(auth, conversationId, body, req) {
    await assertDirectStillAllowed(conversationId, auth.userId);

    const clientMessageId = body.clientMessageId
      ? String(body.clientMessageId).slice(0, 64)
      : null;

    if (clientMessageId) {
      const dup = await prisma.chatMessage.findFirst({
        where: { senderId: auth.userId, clientMessageId },
        include: messageInclude,
      });
      if (dup) {
        return {
          message: serializeMessage(dup, { viewerId: auth.userId }),
          duplicate: true,
        };
      }
    }

    const text = escapeForStorage(body.body);
    const type = body.type || "TEXT";

    if (type === "TEXT" && !text) {
      throw new AppError("متن پیام خالی است", 400, "VALIDATION_ERROR");
    }

    if (body.replyToId) {
      const reply = await prisma.chatMessage.findFirst({
        where: {
          id: body.replyToId,
          conversationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!reply) {
        throw new AppError("پیام پاسخ یافت نشد", 400, "REPLY_NOT_FOUND");
      }
    }

    const attachmentsInput = Array.isArray(body.attachments)
      ? body.attachments
      : [];

    const expectedFragment = `chat/${conversationId}/${auth.userId}/`;
    for (const a of attachmentsInput) {
      const key = String(a.storageKey || "").replace(/\\/g, "/");
      if (key.includes("..") || !key.includes(expectedFragment)) {
        throw new AppError("پیوست نامعتبر است", 400, "INVALID_ATTACHMENT");
      }
    }

    if (
      (type === "VOICE" || type === "IMAGE" || type === "FILE") &&
      !attachmentsInput.length
    ) {
      throw new AppError("پیوست الزامی است", 400, "ATTACHMENT_REQUIRED");
    }

    const conversation = await prisma.chatConversation.findFirst({
      where: { id: conversationId, deletedAt: null },
      include: {
        participants: { where: { leftAt: null } },
      },
    });
    if (!conversation) {
      throw new AppError("گفتگو یافت نشد", 404, "CHAT_NOT_FOUND");
    }

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.chatMessage.create({
        data: {
          conversationId,
          senderId: auth.userId,
          type,
          body: type === "TEXT" || text ? text || null : null,
          clientMessageId,
          replyToId: body.replyToId || null,
          attachments: attachmentsInput.length
            ? {
                create: attachmentsInput.map((a) => ({
                  storageKey: a.storageKey,
                  fileName: a.fileName,
                  mimeType: a.mimeType,
                  sizeBytes: a.sizeBytes,
                  kind: a.kind,
                  durationMs: a.durationMs ?? null,
                })),
              }
            : undefined,
        },
        include: messageInclude,
      });

      const preview = previewFromMessage({
        type: created.type,
        body: created.body,
        attachmentKind: created.attachments?.[0]?.kind,
      });

      await tx.chatConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: created.createdAt,
          lastMessagePreview: preview,
        },
      });

      const recipients = conversation.participants.filter(
        (p) => p.userId !== auth.userId,
      );
      if (recipients.length) {
        await tx.chatMessageDelivery.createMany({
          data: recipients.map((p) => ({
            messageId: created.id,
            userId: p.userId,
            deliveredAt: null,
            readAt: null,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    const recipientIds = conversation.participants
      .map((p) => p.userId)
      .filter((id) => id !== auth.userId);

    presenceProvider.emitToConversation(conversationId, "chat:message", {
      message: serializeMessage(message, { viewerId: null }),
    });

    for (const uid of recipientIds) {
      presenceProvider.emitToUser(uid, "chat:conversation_updated", {
        conversationId,
      });
    }

    await notifyRecipients({
      conversation,
      message,
      sender: auth.user,
      recipientIds,
    });

    return {
      message: serializeMessage(message, { viewerId: auth.userId }),
      duplicate: false,
    };
  },

  async editMessage(auth, messageId, { body }) {
    const message = await prisma.chatMessage.findFirst({
      where: { id: messageId, deletedAt: null },
      include: { conversation: { select: { id: true, deletedAt: true } } },
    });
    if (!message || message.conversation.deletedAt) {
      throw new AppError("پیام یافت نشد", 404, "MESSAGE_NOT_FOUND");
    }
    if (message.senderId !== auth.userId) {
      throw new AppError("فقط فرستنده می‌تواند ویرایش کند", 403, "FORBIDDEN");
    }
    await assertDirectStillAllowed(message.conversationId, auth.userId);

    const text = escapeForStorage(body);
    if (!text) throw new AppError("متن پیام خالی است", 400, "VALIDATION_ERROR");

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { body: text, editedAt: new Date() },
      include: messageInclude,
    });

    presenceProvider.emitToConversation(
      message.conversationId,
      "chat:message_edited",
      { message: serializeMessage(updated, { viewerId: null }) },
    );

    return serializeMessage(updated, { viewerId: auth.userId });
  },

  async deleteMessage(auth, messageId, req) {
    const message = await prisma.chatMessage.findFirst({
      where: { id: messageId, deletedAt: null },
      include: { conversation: { select: { id: true, deletedAt: true } } },
    });
    if (!message || message.conversation.deletedAt) {
      throw new AppError("پیام یافت نشد", 404, "MESSAGE_NOT_FOUND");
    }
    const isOwner = message.senderId === auth.userId;
    const isManager = isFullAccessRole(auth.roleCode);
    if (!isOwner && !isManager) {
      throw new AppError("مجوز حذف ندارید", 403, "FORBIDDEN");
    }
    await assertConversationMember(message.conversationId, auth.userId);

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), body: null },
      include: messageInclude,
    });

    await writeAudit({
      userId: auth.userId,
      action: "CHAT_MESSAGE_DELETE",
      entityType: "ChatMessage",
      entityId: messageId,
      after: { conversationId: message.conversationId },
      req,
    });

    presenceProvider.emitToConversation(
      message.conversationId,
      "chat:message_deleted",
      { messageId, conversationId: message.conversationId },
    );

    return serializeMessage(updated, { viewerId: auth.userId });
  },

  async markRead(auth, conversationId, { messageId } = {}) {
    const membership = await assertDirectStillAllowed(
      conversationId,
      auth.userId,
    );

    const now = new Date();
    let lastMessage = null;
    if (messageId) {
      lastMessage = await prisma.chatMessage.findFirst({
        where: { id: messageId, conversationId, deletedAt: null },
      });
    } else {
      lastMessage = await prisma.chatMessage.findFirst({
        where: { conversationId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      });
    }

    await prisma.chatParticipant.update({
      where: { id: membership.id },
      data: {
        lastReadAt: lastMessage?.createdAt || now,
        lastReadMessageId: lastMessage?.id || membership.lastReadMessageId,
      },
    });

    if (lastMessage) {
      await prisma.chatMessageDelivery.updateMany({
        where: {
          userId: auth.userId,
          readAt: null,
          message: {
            conversationId,
            createdAt: { lte: lastMessage.createdAt },
            senderId: { not: auth.userId },
          },
        },
        data: { readAt: now, deliveredAt: now },
      });

      presenceProvider.emitToConversation(conversationId, "chat:messages_read", {
        conversationId,
        userId: auth.userId,
        messageId: lastMessage.id,
        readAt: now.toISOString(),
      });
    }

    return { ok: true };
  },

  async markDelivered(auth, conversationId, messageIds = []) {
    await assertConversationMember(conversationId, auth.userId);
    const ids = (messageIds || []).filter(Boolean).slice(0, 100);
    if (!ids.length) return { ok: true };
    const now = new Date();
    await prisma.chatMessageDelivery.updateMany({
      where: {
        userId: auth.userId,
        messageId: { in: ids },
        deliveredAt: null,
        message: { conversationId },
      },
      data: { deliveredAt: now },
    });
    presenceProvider.emitToConversation(
      conversationId,
      "chat:messages_delivered",
      {
        conversationId,
        userId: auth.userId,
        messageIds: ids,
        deliveredAt: now.toISOString(),
      },
    );
    return { ok: true };
  },

  async toggleReaction(auth, messageId, { emoji }) {
    if (!CHAT_REACTION_EMOJIS.has(emoji)) {
      throw new AppError("واکنش نامعتبر است", 400, "INVALID_REACTION");
    }
    const message = await prisma.chatMessage.findFirst({
      where: { id: messageId, deletedAt: null },
    });
    if (!message) throw new AppError("پیام یافت نشد", 404, "MESSAGE_NOT_FOUND");
    await assertDirectStillAllowed(message.conversationId, auth.userId);

    const existing = await prisma.chatMessageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId: auth.userId,
          emoji,
        },
      },
    });

    if (existing) {
      await prisma.chatMessageReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.chatMessageReaction.create({
        data: { messageId, userId: auth.userId, emoji },
      });
    }

    const reactions = await prisma.chatMessageReaction.findMany({
      where: { messageId },
    });

    presenceProvider.emitToConversation(
      message.conversationId,
      "chat:reaction",
      {
        messageId,
        conversationId: message.conversationId,
        reactions: reactions.map((r) => ({
          emoji: r.emoji,
          userId: r.userId,
        })),
      },
    );

    return { reactions };
  },

  async updateParticipantPrefs(auth, conversationId, prefs) {
    const membership = await assertConversationMember(
      conversationId,
      auth.userId,
    );
    const data = {};
    if (prefs.muted !== undefined) {
      data.mutedAt = prefs.muted ? new Date() : null;
    }
    if (prefs.pinned !== undefined) {
      data.pinnedAt = prefs.pinned ? new Date() : null;
    }
    if (prefs.archived !== undefined) {
      data.archivedAt = prefs.archived ? new Date() : null;
    }
    await prisma.chatParticipant.update({
      where: { id: membership.id },
      data,
    });
    return this.getConversation(auth, conversationId);
  },

  async search(auth, { q, limit = 30 } = {}) {
    const query = sanitizePlainText(q);
    if (query.length < 2) {
      return { conversations: [], messages: [] };
    }
    const take = Math.min(Number(limit) || 30, 50);

    const memberships = await prisma.chatParticipant.findMany({
      where: { userId: auth.userId, leftAt: null },
      select: { conversationId: true },
    });
    const conversationIds = memberships.map((m) => m.conversationId);
    if (!conversationIds.length) {
      return { conversations: [], messages: [] };
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        conversationId: { in: conversationIds },
        deletedAt: null,
        body: { contains: query, mode: "insensitive" },
      },
      include: {
        sender: { select: userPublicSelect },
        conversation: {
          include: {
            participants: {
              where: { leftAt: null },
              include: { user: { select: userPublicSelect } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    // Filter DIRECT rooms that are no longer allowed
    const filtered = [];
    for (const m of messages) {
      if (m.conversation.type === "DIRECT") {
        const other = m.conversation.participants.find(
          (p) => p.userId !== auth.userId,
        );
        if (other) {
          const check = await canUsersCommunicate(auth.userId, other.userId);
          if (!check.allowed) continue;
        }
      }
      filtered.push({
        message: serializeMessage(m, { viewerId: auth.userId }),
        conversationId: m.conversationId,
      });
    }

    const conversations = await this.listConversations(auth, { q: query });

    return { conversations, messages: filtered };
  },

  async getAttachmentForDownload(auth, attachmentId) {
    const attachment = await prisma.chatAttachment.findFirst({
      where: { id: attachmentId },
      include: {
        message: {
          select: {
            id: true,
            conversationId: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!attachment || attachment.message.deletedAt) {
      throw new AppError("فایل یافت نشد", 404, "NOT_FOUND");
    }
    await assertDirectStillAllowed(
      attachment.message.conversationId,
      auth.userId,
    );
    return attachment;
  },

  async getOrgChatSettings(auth) {
    if (!isChatManagerRole(auth.roleCode) && !isFullAccessRole(auth.roleCode)) {
      // Employees may read the policy (to understand directory), not pairs.
      const settings = await getOrgSettings();
      return {
        employeePolicy: settings.employeePolicy,
        updatedAt: settings.updatedAt,
        allowPairs: [],
      };
    }
    const settings = await getOrgSettings();
    const pairs = await prisma.chatEmployeeAllowPair.findMany({
      include: {
        userLow: { select: userPublicSelect },
        userHigh: { select: userPublicSelect },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return serializeOrgSettings(settings, pairs);
  },

  async updateOrgChatSettings(auth, { employeePolicy }, req) {
    if (!isFullAccessRole(auth.roleCode)) {
      throw new AppError("فقط مدیر می‌تواند این تنظیم را تغییر دهد", 403, "FORBIDDEN");
    }
    const before = await getOrgSettings();
    const updated = await prisma.chatOrgSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        employeePolicy,
        updatedById: auth.userId,
      },
      update: {
        employeePolicy,
        updatedById: auth.userId,
      },
    });

    await writeAudit({
      userId: auth.userId,
      action: "CHAT_EMPLOYEE_POLICY_UPDATE",
      entityType: "ChatOrgSettings",
      entityId: "default",
      before: { employeePolicy: before.employeePolicy },
      after: { employeePolicy: updated.employeePolicy },
      req,
    });

    presenceProvider.emitToUser?.(null); // no-op placeholder
    // Broadcast permission change to all connected staff via user rooms — handled in socket layer
    if (typeof presenceProvider.broadcast === "function") {
      presenceProvider.broadcast("chat:permission_changed", {
        employeePolicy: updated.employeePolicy,
      });
    }

    return this.getOrgChatSettings(auth);
  },

  async addAllowPair(auth, { userAId, userBId }, req) {
    if (!isFullAccessRole(auth.roleCode)) {
      throw new AppError("فقط مدیر می‌تواند جفت مجاز اضافه کند", 403, "FORBIDDEN");
    }
    if (userAId === userBId) {
      throw new AppError("کاربران باید متفاوت باشند", 400, "VALIDATION_ERROR");
    }
    const [a, b] = await Promise.all([
      prisma.user.findFirst({
        where: { id: userAId, isActive: true, deletedAt: null },
        select: { id: true, role: { select: { code: true } } },
      }),
      prisma.user.findFirst({
        where: { id: userBId, isActive: true, deletedAt: null },
        select: { id: true, role: { select: { code: true } } },
      }),
    ]);
    if (!a || !b) throw new AppError("کاربر یافت نشد", 404, "USER_NOT_FOUND");

    const pair = orderedUserPair(userAId, userBId);
    const created = await prisma.chatEmployeeAllowPair.upsert({
      where: {
        userLowId_userHighId: {
          userLowId: pair.userLowId,
          userHighId: pair.userHighId,
        },
      },
      create: {
        userLowId: pair.userLowId,
        userHighId: pair.userHighId,
        grantedById: auth.userId,
      },
      update: {},
    });

    await writeAudit({
      userId: auth.userId,
      action: "CHAT_ALLOW_PAIR_ADD",
      entityType: "ChatEmployeeAllowPair",
      entityId: created.id,
      after: pair,
      req,
    });

    return this.getOrgChatSettings(auth);
  },

  async removeAllowPair(auth, pairId, req) {
    if (!isFullAccessRole(auth.roleCode)) {
      throw new AppError("فقط مدیر می‌تواند جفت مجاز را حذف کند", 403, "FORBIDDEN");
    }
    const existing = await prisma.chatEmployeeAllowPair.findUnique({
      where: { id: pairId },
    });
    if (!existing) throw new AppError("مورد یافت نشد", 404, "NOT_FOUND");

    await prisma.chatEmployeeAllowPair.delete({ where: { id: pairId } });
    await writeAudit({
      userId: auth.userId,
      action: "CHAT_ALLOW_PAIR_REMOVE",
      entityType: "ChatEmployeeAllowPair",
      entityId: pairId,
      before: existing,
      req,
    });
    return this.getOrgChatSettings(auth);
  },

  serializeAttachment,
};
