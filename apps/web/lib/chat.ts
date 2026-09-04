import {
  api,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  ensureCsrf,
  API_BASE,
  ApiError,
  type ApiEnvelope,
} from "@/lib/api";
import { resolveClientAuthPanel } from "@/lib/auth-panel";

export type ChatEmployeePolicy =
  | "DISABLED"
  | "ALL_EMPLOYEES"
  | "SAME_TEAM"
  | "SELECTED";

export type ChatUser = {
  id: string;
  fullName: string;
  profileImage?: string | null;
  roleCode?: string | null;
  teamKind?: string | null;
  isOnline?: boolean;
  lastSeenAt?: string | null;
};

export type ChatAttachment = {
  id: string;
  kind: "IMAGE" | "DOCUMENT" | "VOICE" | "AUDIO" | "OTHER";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number | null;
  downloadPath: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: ChatUser | null;
  type: "TEXT" | "VOICE" | "IMAGE" | "FILE" | "SYSTEM";
  body?: string | null;
  clientMessageId?: string | null;
  replyToId?: string | null;
  replyTo?: {
    id: string;
    body?: string | null;
    senderId: string;
    type: string;
    deleted?: boolean;
  } | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  attachments: ChatAttachment[];
  reactions: Array<{ emoji: string; userId: string }>;
  status?: "sent" | "delivered" | "read" | "deleted" | "failed" | "pending";
  deleted?: boolean;
  optimistic?: boolean;
};

export type ChatConversation = {
  id: string;
  type: "DIRECT" | "GROUP";
  title: string;
  peer?: ChatUser | null;
  participants: Array<{
    userId: string;
    mutedAt?: string | null;
    pinnedAt?: string | null;
    user?: ChatUser | null;
  }>;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  unreadCount: number;
  muted: boolean;
  pinned: boolean;
  archived: boolean;
};

export type ChatOrgSettings = {
  employeePolicy: ChatEmployeePolicy;
  updatedAt?: string;
  allowPairs?: Array<{
    id: string;
    userLowId: string;
    userHighId: string;
    userLow?: ChatUser | null;
    userHigh?: ChatUser | null;
  }>;
};

export type PendingUpload = {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: ChatAttachment["kind"];
  durationMs?: number | null;
};

export function chatAttachmentUrl(attachmentId: string): string {
  const panel = resolveClientAuthPanel();
  const base = `${API_BASE}/chat/attachments/${attachmentId}`;
  return panel ? `${base}?panel=${encodeURIComponent(panel)}` : base;
}

const attachmentBlobCache = new Map<string, Promise<Blob>>();

/**
 * Fetch a chat attachment via the authenticated API client (cookies + panel header).
 * Required for secure playback of voice/image attachments in the browser.
 */
export async function fetchChatAttachmentBlob(
  attachmentId: string,
): Promise<Blob> {
  const cached = attachmentBlobCache.get(attachmentId);
  if (cached) return cached;

  const panel = resolveClientAuthPanel();
  const promise = (async () => {
    const response = await api.get<Blob>(`/chat/attachments/${attachmentId}`, {
      responseType: "blob",
      params: panel ? { panel } : undefined,
    });
    const blob = response.data;
    const contentType = String(response.headers?.["content-type"] || "");
    if (
      contentType.includes("application/json") ||
      (blob.type && blob.type.includes("application/json"))
    ) {
      const text = await blob.text();
      try {
        const parsed = JSON.parse(text) as ApiEnvelope;
        throw new ApiError(
          parsed.error?.message || "دریافت پیوست ناموفق بود",
          400,
          parsed.error?.code || "ATTACHMENT_FETCH_FAILED",
        );
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw new ApiError(
          "دریافت پیوست ناموفق بود",
          400,
          "ATTACHMENT_FETCH_FAILED",
        );
      }
    }
    return blob;
  })();

  attachmentBlobCache.set(attachmentId, promise);
  promise.catch(() => attachmentBlobCache.delete(attachmentId));
  return promise;
}

export const chatApi = {
  directory: (q?: string) =>
    apiGet<{ users: ChatUser[]; employeePolicy: ChatEmployeePolicy }>(
      `/chat/directory${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),
  conversations: (q?: string) =>
    apiGet<ChatConversation[]>(
      `/chat/conversations${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),
  conversation: (id: string) =>
    apiGet<ChatConversation>(`/chat/conversations/${id}`),
  openDirect: (userId: string) =>
    apiPost<ChatConversation>("/chat/conversations/direct", { userId }),
  messages: (id: string, cursor?: string | null) =>
    apiGet<{ items: ChatMessage[]; nextCursor: string | null; hasMore: boolean }>(
      `/chat/conversations/${id}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),
  send: (
    id: string,
    body: {
      type?: string;
      body?: string | null;
      clientMessageId?: string;
      replyToId?: string | null;
      attachments?: PendingUpload[];
    },
  ) =>
    apiPost<{ message: ChatMessage; duplicate: boolean }>(
      `/chat/conversations/${id}/messages`,
      body,
    ),
  edit: (messageId: string, body: string) =>
    apiPatch<ChatMessage>(`/chat/messages/${messageId}`, { body }),
  remove: (messageId: string) =>
    apiDelete<ChatMessage>(`/chat/messages/${messageId}`),
  markRead: (id: string, messageId?: string) =>
    apiPost(`/chat/conversations/${id}/read`, { messageId }),
  prefs: (
    id: string,
    prefs: { muted?: boolean; pinned?: boolean; archived?: boolean },
  ) => apiPatch<ChatConversation>(`/chat/conversations/${id}/prefs`, prefs),
  react: (messageId: string, emoji: string) =>
    apiPost(`/chat/messages/${messageId}/reactions`, { emoji }),
  search: (q: string) =>
    apiGet<{
      conversations: ChatConversation[];
      messages: Array<{ message: ChatMessage; conversationId: string }>;
    }>(`/chat/search?q=${encodeURIComponent(q)}`),
  settings: () => apiGet<ChatOrgSettings>("/chat/settings"),
  updateSettings: (employeePolicy: ChatEmployeePolicy) =>
    apiPatch<ChatOrgSettings>("/chat/settings", { employeePolicy }),
  addPair: (userAId: string, userBId: string) =>
    apiPost<ChatOrgSettings>("/chat/settings/allow-pairs", { userAId, userBId }),
  removePair: (id: string) =>
    apiDelete<ChatOrgSettings>(`/chat/settings/allow-pairs/${id}`),
};

export async function uploadChatAttachment(
  conversationId: string,
  file: File | Blob,
  opts?: { kind?: "voice"; durationMs?: number; fileName?: string },
): Promise<PendingUpload> {
  await ensureCsrf();
  const form = new FormData();
  const name =
    opts?.fileName ||
    (file instanceof File ? file.name : `voice-${Date.now()}.webm`);
  form.append("file", file, name);
  if (opts?.kind === "voice") form.append("kind", "voice");
  if (opts?.durationMs) form.append("durationMs", String(opts.durationMs));

  const { data } = await api.post<ApiEnvelope<PendingUpload>>(
    `/chat/conversations/${conversationId}/attachments`,
    form,
    {
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      transformRequest: [
        (body, headers) => {
          if (headers && typeof headers === "object") {
            delete (headers as Record<string, unknown>)["Content-Type"];
          }
          return body;
        },
      ],
    },
  );

  if (!data.success || !data.data) {
    throw new ApiError(
      data.error?.message || "بارگذاری ناموفق بود",
      400,
      data.error?.code || "UPLOAD_FAILED",
    );
  }
  return data.data;
}

export function formatChatTime(value?: string | null): string {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export function formatChatDay(value?: string | null): string {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("fa-AF", {
      weekday: "long",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export function newClientMessageId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
