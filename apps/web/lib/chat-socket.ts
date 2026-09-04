"use client";

import { io, type Socket } from "socket.io-client";
import { resolveClientAuthPanel } from "@/lib/auth-panel";

const API_ORIGIN = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1"
).replace(/\/api\/v1\/?$/, "");

let socket: Socket | null = null;
let connectPromise: Promise<Socket> | null = null;
let retainCount = 0;

export function getChatSocket(): Socket | null {
  return socket;
}

export async function connectChatSocket(): Promise<Socket> {
  if (socket?.connected) return socket;
  if (connectPromise) return connectPromise;

  connectPromise = new Promise((resolve, reject) => {
    const panel = resolveClientAuthPanel();
    const next = io(API_ORIGIN, {
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
      auth: { panel },
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
    });

    const onConnect = () => {
      socket = next;
      connectPromise = null;
      resolve(next);
    };
    const onError = (err: Error) => {
      connectPromise = null;
      reject(err);
    };

    next.once("connect", onConnect);
    next.once("connect_error", onError);
  });

  return connectPromise;
}

/** Keep the shared socket alive while any chat surface is mounted. */
export function retainChatSocket() {
  retainCount += 1;
  void connectChatSocket().catch(() => {
    /* REST fallback still works */
  });
  return () => releaseChatSocket();
}

export function releaseChatSocket() {
  retainCount = Math.max(0, retainCount - 1);
  if (retainCount === 0) {
    disconnectChatSocket();
  }
}

export function disconnectChatSocket() {
  socket?.disconnect();
  socket = null;
  connectPromise = null;
}
