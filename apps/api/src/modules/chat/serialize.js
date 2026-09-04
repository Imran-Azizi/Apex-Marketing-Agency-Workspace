function safeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    fullName: user.fullName,
    profileImage: user.profileImage || null,
    roleCode: user.role?.code || user.roleCode || null,
    teamKind: user.teamProfile?.kind || null,
    isOnline: Boolean(user.isOnline),
    lastSeenAt: user.lastSeenAt || null,
  };
}

export function serializeAttachment(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    durationMs: row.durationMs ?? null,
    // Private ACL download via chat attachment endpoint — never public CDN URL
    downloadPath: `/chat/attachments/${row.id}`,
  };
}

export function serializeReaction(row) {
  return {
    emoji: row.emoji,
    userId: row.userId,
    createdAt: row.createdAt,
  };
}

export function serializeMessage(row, { viewerId } = {}) {
  if (!row) return null;
  const deleted = Boolean(row.deletedAt);
  const deliveries = row.deliveries || [];
  const others = deliveries.filter((d) => d.userId !== row.senderId);
  const allDelivered =
    others.length > 0 && others.every((d) => Boolean(d.deliveredAt));
  const allRead = others.length > 0 && others.every((d) => Boolean(d.readAt));

  let status = "sent";
  if (deleted) status = "deleted";
  else if (viewerId === row.senderId) {
    if (allRead) status = "read";
    else if (allDelivered) status = "delivered";
    else status = "sent";
  }

  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    sender: safeUser(row.sender),
    type: row.type,
    body: deleted ? null : row.body,
    clientMessageId: row.clientMessageId || null,
    replyToId: row.replyToId || null,
    replyTo: row.replyTo
      ? {
          id: row.replyTo.id,
          body: row.replyTo.deletedAt ? null : row.replyTo.body,
          senderId: row.replyTo.senderId,
          type: row.replyTo.type,
          deleted: Boolean(row.replyTo.deletedAt),
        }
      : null,
    editedAt: row.editedAt,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    attachments: deleted
      ? []
      : (row.attachments || []).map(serializeAttachment),
    reactions: (row.reactions || []).map(serializeReaction),
    status,
    deleted,
  };
}

export function serializeConversation(row, { viewerId, onlineUserIds } = {}) {
  const participants = (row.participants || [])
    .filter((p) => !p.leftAt)
    .map((p) => {
      const user = p.user
        ? {
            ...p.user,
            isOnline: onlineUserIds?.has?.(p.userId) || false,
          }
        : null;
      return {
        userId: p.userId,
        joinedAt: p.joinedAt,
        mutedAt: p.mutedAt,
        pinnedAt: p.pinnedAt,
        archivedAt: p.archivedAt,
        lastReadAt: p.lastReadAt,
        lastReadMessageId: p.lastReadMessageId,
        user: safeUser(user),
      };
    });

  const me = participants.find((p) => p.userId === viewerId) || null;
  const others = participants.filter((p) => p.userId !== viewerId);
  const peer = row.type === "DIRECT" ? others[0]?.user || null : null;

  return {
    id: row.id,
    type: row.type,
    title:
      row.type === "GROUP"
        ? row.title
        : peer?.fullName || row.title || "گفتگو",
    peer,
    participants,
    lastMessageAt: row.lastMessageAt,
    lastMessagePreview: row.lastMessagePreview,
    unreadCount: row.unreadCount ?? 0,
    muted: Boolean(me?.mutedAt),
    pinned: Boolean(me?.pinnedAt),
    archived: Boolean(me?.archivedAt),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function serializeOrgSettings(row, pairs = []) {
  return {
    employeePolicy: row.employeePolicy,
    updatedAt: row.updatedAt,
    updatedById: row.updatedById || null,
    allowPairs: pairs.map((p) => ({
      id: p.id,
      userLowId: p.userLowId,
      userHighId: p.userHighId,
      userLow: safeUser(p.userLow),
      userHigh: safeUser(p.userHigh),
      createdAt: p.createdAt,
    })),
  };
}
