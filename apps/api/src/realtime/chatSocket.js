import { Server } from "socket.io";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { verifyAccessToken } from "../utils/tokens.js";
import {
  effectiveFromUser,
  permissionSatisfied,
} from "../services/permissions/effective.js";
import {
  accessCookieName,
  isAuthPanel,
  roleToPanel,
  COOKIE,
} from "../config/cookies.js";
import { setChatPresenceProvider } from "../modules/chat/service.js";
import { assertConversationMember } from "../modules/chat/authz.js";

function parseCookieHeader(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

/** @type {Map<string, Set<string>>} userId → socket ids */
const onlineSockets = new Map();
/** @type {Map<string, string>} socketId → userId */
const socketUser = new Map();
/** @type {Map<string, Set<string>>} userId → active conversation ids (viewing) */
const viewing = new Map();

function readTokenFromHandshake(socket) {
  const headerPanel = String(
    socket.handshake.auth?.panel ||
      socket.handshake.headers?.["x-apex-panel"] ||
      "",
  )
    .trim()
    .toLowerCase();
  const panel = isAuthPanel(headerPanel) ? headerPanel : null;

  const rawCookie = socket.handshake.headers?.cookie || "";
  const parsed = parseCookieHeader(rawCookie);

  if (panel) {
    const named = parsed[accessCookieName(panel)];
    if (named) return { token: named, panel };
  }

  // Try all panels
  for (const p of ["manager", "editor", "sales", "narrator"]) {
    const t = parsed[accessCookieName(p)];
    if (t) return { token: t, panel: p };
  }

  if (parsed[COOKIE.access]) {
    return { token: parsed[COOKIE.access], panel: panel || null };
  }

  const authToken = socket.handshake.auth?.token;
  if (authToken) return { token: String(authToken), panel };
  return null;
}

async function authenticateSocket(socket) {
  const read = readTokenFromHandshake(socket);
  if (!read?.token) return null;

  let payload;
  try {
    payload = verifyAccessToken(read.token);
  } catch {
    return null;
  }
  if (payload.aud !== "INTERNAL") return null;

  const user = await prisma.user.findFirst({
    where: { id: payload.sub, isActive: true, deletedAt: null },
    select: {
      id: true,
      email: true,
      fullName: true,
      profileImage: true,
      role: {
        select: {
          code: true,
          permissions: {
            select: { permission: { select: { code: true } } },
          },
        },
      },
      userPermissions: {
        select: { granted: true, permission: { select: { code: true } } },
      },
    },
  });
  if (!user) return null;

  const permissions = effectiveFromUser(user);
  if (!permissionSatisfied(permissions, "chat.view", user.role.code)) {
    return null;
  }

  return {
    userId: user.id,
    roleCode: user.role.code,
    panel: read.panel || roleToPanel(user.role.code),
    permissions,
    user,
  };
}

function addOnline(userId, socketId) {
  if (!onlineSockets.has(userId)) onlineSockets.set(userId, new Set());
  onlineSockets.get(userId).add(socketId);
  socketUser.set(socketId, userId);
}

function removeOnline(userId, socketId) {
  const set = onlineSockets.get(userId);
  if (set) {
    set.delete(socketId);
    if (!set.size) onlineSockets.delete(userId);
  }
  socketUser.delete(socketId);
}

export function attachChatRealtime(httpServer) {
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: env.corsOrigins,
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  setChatPresenceProvider({
    getOnlineUserIds: () => new Set(onlineSockets.keys()),
    emitToUser(userId, event, payload) {
      if (!userId) return;
      io.to(`user:${userId}`).emit(event, payload);
    },
    emitToConversation(conversationId, event, payload) {
      io.to(`chat:${conversationId}`).emit(event, payload);
    },
    isUserInConversation(userId, conversationId) {
      return Boolean(viewing.get(userId)?.has(conversationId));
    },
    broadcast(event, payload) {
      io.emit(event, payload);
    },
  });

  io.use(async (socket, next) => {
    try {
      const auth = await authenticateSocket(socket);
      if (!auth) return next(new Error("UNAUTHORIZED"));
      socket.data.auth = auth;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    const auth = socket.data.auth;
    const userId = auth.userId;
    addOnline(userId, socket.id);
    socket.join(`user:${userId}`);

    io.emit("chat:presence", { userId, online: true });

    socket.on("chat:join", async (payload, ack) => {
      try {
        const conversationId = String(payload?.conversationId || "");
        if (!conversationId) throw new Error("missing conversation");
        await assertConversationMember(conversationId, userId);
        socket.join(`chat:${conversationId}`);
        if (!viewing.has(userId)) viewing.set(userId, new Set());
        viewing.get(userId).add(conversationId);
        if (typeof ack === "function") ack({ ok: true });
      } catch {
        if (typeof ack === "function") ack({ ok: false });
      }
    });

    socket.on("chat:leave", (payload) => {
      const conversationId = String(payload?.conversationId || "");
      if (!conversationId) return;
      socket.leave(`chat:${conversationId}`);
      viewing.get(userId)?.delete(conversationId);
    });

    socket.on("chat:typing", async (payload) => {
      try {
        const conversationId = String(payload?.conversationId || "");
        if (!conversationId) return;
        await assertConversationMember(conversationId, userId);
        socket.to(`chat:${conversationId}`).emit("chat:typing", {
          conversationId,
          userId,
          isTyping: Boolean(payload?.isTyping),
        });
      } catch {
        /* ignore */
      }
    });

    socket.on("disconnect", () => {
      removeOnline(userId, socket.id);
      viewing.delete(userId);
      if (!onlineSockets.has(userId)) {
        io.emit("chat:presence", { userId, online: false });
      }
    });
  });

  return io;
}
