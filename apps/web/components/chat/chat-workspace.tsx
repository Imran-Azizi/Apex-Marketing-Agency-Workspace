"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  CheckCheck,
  Loader2,
  Mic,
  Paperclip,
  Pause,
  Pin,
  Play,
  Search,
  Send,
  Settings2,
  X,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hasPermission, isFullAccessRole } from "@/lib/rbac";
import { useMeQuery } from "@/lib/permissions";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  chatApi,
  chatAttachmentUrl,
  fetchChatAttachmentBlob,
  formatChatDay,
  formatChatTime,
  newClientMessageId,
  uploadChatAttachment,
  type ChatConversation,
  type ChatEmployeePolicy,
  type ChatMessage,
  type ChatUser,
} from "@/lib/chat";
import { connectChatSocket, retainChatSocket } from "@/lib/chat-socket";
import { ChatSettingsPanel } from "@/components/chat/chat-settings-panel";

export type ChatWorkspaceProps = {
  /** Controlled conversation id (null = list / empty pane). */
  conversationId?: string | null;
  onConversationChange?: (id: string | null) => void;
  /** page = full dashboard view; drawer = compact left sidebar panel */
  variant?: "page" | "drawer";
  onRequestClose?: () => void;
  className?: string;
};

function PresenceDot({ online }: { online?: boolean }) {
  return (
    <span
      className={cn(
        "absolute bottom-0 left-0 h-2.5 w-2.5 rounded-full border-2 border-background",
        online ? "bg-emerald-500" : "bg-zinc-400",
      )}
    />
  );
}

function StatusTicks({ status }: { status?: ChatMessage["status"] }) {
  if (status === "pending") return <span className="text-[10px] opacity-60">…</span>;
  if (status === "failed") return <span className="text-[10px] text-red-400">!</span>;
  if (status === "read") return <CheckCheck className="h-3.5 w-3.5 text-sky-300" />;
  if (status === "delivered") return <CheckCheck className="h-3.5 w-3.5 opacity-70" />;
  return <Check className="h-3.5 w-3.5 opacity-70" />;
}

function formatVoiceTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Only one voice message may play at a time across the chat UI. */
const voicePlaybackLock = {
  ownerId: null as string | null,
  stop: null as (() => void) | null,
  claim(id: string, stop: () => void) {
    if (this.ownerId && this.ownerId !== id) {
      this.stop?.();
    }
    this.ownerId = id;
    this.stop = stop;
  },
  release(id: string) {
    if (this.ownerId === id) {
      this.ownerId = null;
      this.stop = null;
    }
  },
};

function VoiceBubble({
  attachment,
  mine,
}: {
  attachment: ChatMessage["attachments"][0];
  mine: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const seekingRef = useRef(false);
  const stopFromLockRef = useRef(() => {});
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [durationSec, setDurationSec] = useState<number | null>(
    attachment.durationMs && attachment.durationMs > 0
      ? attachment.durationMs / 1000
      : null,
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  stopFromLockRef.current = () => {
    const el = audioRef.current;
    if (el && !el.paused) el.pause();
    setPlaying(false);
  };

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDurationSec(
      attachment.durationMs && attachment.durationMs > 0
        ? attachment.durationMs / 1000
        : null,
    );

    void fetchChatAttachmentBlob(attachment.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setAudioUrl(objectUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "امکان پخش این پیام صوتی وجود ندارد",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      voicePlaybackLock.release(attachment.id);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id, attachment.durationMs]);

  const seekFromClientX = (clientX: number) => {
    const el = audioRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const duration = el.duration || durationSec || 0;
    if (!duration || !Number.isFinite(duration)) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    el.currentTime = ratio * duration;
    setProgress(ratio);
    setCurrentTime(ratio * duration);
  };

  const togglePlayback = async () => {
    const el = audioRef.current;
    if (!el || !audioUrl || loading || error) return;

    if (el.paused) {
      voicePlaybackLock.claim(attachment.id, () => {
        stopFromLockRef.current();
      });
      try {
        await el.play();
        setPlaying(true);
      } catch {
        voicePlaybackLock.release(attachment.id);
        setPlaying(false);
        setError("امکان پخش این پیام صوتی وجود ندارد");
      }
      return;
    }

    el.pause();
    setPlaying(false);
    voicePlaybackLock.release(attachment.id);
  };

  const canInteract = Boolean(audioUrl) && !loading && !error;
  const totalLabel = durationSec != null ? formatVoiceTime(durationSec) : "--:--";

  return (
    <div className="flex min-w-[200px] max-w-[280px] items-center gap-2.5">
      <button
        type="button"
        disabled={!canInteract}
        aria-label={playing ? "توقف پخش" : "پخش پیام صوتی"}
        aria-pressed={playing}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50",
          mine
            ? "bg-white/15 hover:bg-white/25 active:bg-white/30 focus-visible:ring-white/50 focus-visible:ring-offset-transparent"
            : "bg-primary/10 hover:bg-primary/20 active:bg-primary/25 focus-visible:ring-primary/40 focus-visible:ring-offset-background",
        )}
        onClick={() => void togglePlayback()}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin opacity-80" aria-hidden />
        ) : playing ? (
          <Pause className="h-4 w-4" fill="currentColor" aria-hidden />
        ) : (
          <Play className="ms-0.5 h-4 w-4" fill="currentColor" aria-hidden />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          ref={trackRef}
          role="slider"
          tabIndex={canInteract ? 0 : -1}
          aria-label="موقعیت پخش"
          aria-valuemin={0}
          aria-valuemax={Math.round(durationSec || 0)}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={`${formatVoiceTime(currentTime)} از ${totalLabel}`}
          aria-disabled={!canInteract}
          className={cn(
            "group relative flex h-5 cursor-pointer items-center rounded-full outline-none",
            "focus-visible:ring-2 focus-visible:ring-current/30",
            !canInteract && "cursor-not-allowed opacity-60",
          )}
          onPointerDown={(e) => {
            if (!canInteract) return;
            e.preventDefault();
            seekingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            seekFromClientX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (!seekingRef.current || !canInteract) return;
            seekFromClientX(e.clientX);
          }}
          onPointerUp={(e) => {
            if (!seekingRef.current) return;
            seekingRef.current = false;
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              /* already released */
            }
          }}
          onPointerCancel={() => {
            seekingRef.current = false;
          }}
          onKeyDown={(e) => {
            const el = audioRef.current;
            if (!el || !canInteract) return;
            const duration = el.duration || durationSec || 0;
            if (!duration) return;
            const step = e.shiftKey ? 5 : 2;
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              const delta =
                e.key === "ArrowRight" ? step : -step;
              const next = Math.min(
                duration,
                Math.max(0, el.currentTime + delta),
              );
              el.currentTime = next;
              setCurrentTime(next);
              setProgress(next / duration);
            } else if (e.key === "Home") {
              e.preventDefault();
              el.currentTime = 0;
              setCurrentTime(0);
              setProgress(0);
            } else if (e.key === "End") {
              e.preventDefault();
              el.currentTime = duration;
              setCurrentTime(duration);
              setProgress(1);
            }
          }}
        >
          <div
            className={cn(
              "relative h-1.5 w-full rounded-full",
              mine ? "bg-white/20" : "bg-black/10",
            )}
          >
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-[width] duration-75 ease-linear",
                mine ? "bg-white" : "bg-primary",
              )}
              style={{ width: `${progress * 100}%` }}
            />
            <span
              className={cn(
                "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 shadow-sm transition-opacity",
                "group-hover:opacity-100 group-focus-visible:opacity-100",
                playing && "opacity-100",
                mine ? "bg-white" : "bg-primary",
              )}
              style={{ left: `${progress * 100}%` }}
            />
          </div>
        </div>

        <div
          className="mt-1 flex items-center justify-between gap-2 text-[10px] tabular-nums opacity-70"
          dir="ltr"
        >
          {error ? (
            <span
              className={cn(
                "opacity-100",
                mine ? "text-red-200" : "text-destructive",
              )}
              dir="rtl"
            >
              {error}
            </span>
          ) : loading ? (
            <span dir="rtl">در حال بارگذاری…</span>
          ) : (
            <>
              <span>{formatVoiceTime(currentTime)}</span>
              <span>{totalLabel}</span>
            </>
          )}
        </div>
      </div>

      {audioUrl ? (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setDurationSec(d);
          }}
          onDurationChange={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setDurationSec(d);
          }}
          onTimeUpdate={(e) => {
            if (seekingRef.current) return;
            const el = e.currentTarget;
            const d = el.duration || durationSec || 0;
            if (!d) return;
            setCurrentTime(el.currentTime);
            setProgress(el.currentTime / d);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setProgress(0);
            setCurrentTime(0);
            const el = audioRef.current;
            if (el) el.currentTime = 0;
            voicePlaybackLock.release(attachment.id);
          }}
          onError={() => {
            setPlaying(false);
            voicePlaybackLock.release(attachment.id);
            setError("امکان پخش این پیام صوتی وجود ندارد");
          }}
        />
      ) : null}
    </div>
  );
}

function ChatAttachmentImage({
  attachment,
}: {
  attachment: ChatMessage["attachments"][0];
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    void fetchChatAttachmentBlob(attachment.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id]);

  if (error) {
    return (
      <a
        href={chatAttachmentUrl(attachment.id)}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        📎 {attachment.fileName}
      </a>
    );
  }

  if (!src) {
    return <Skeleton className="h-32 w-48 rounded-lg" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={attachment.fileName}
      className="max-h-64 rounded-lg object-contain"
    />
  );
}

export function ChatWorkspace({
  conversationId: controlledId = null,
  onConversationChange,
  variant = "page",
  onRequestClose,
  className,
}: ChatWorkspaceProps) {
  const { data: me } = useMeQuery();
  const qc = useQueryClient();
  const selectedId = controlledId;

  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(Boolean(selectedId));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [dirQ, setDirQ] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimer = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingTimeout = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isDrawer = variant === "drawer";

  const canManage = isFullAccessRole(me?.role);
  const canSend = hasPermission(me?.permissions, "chat.send", me?.role);

  const conversationsQ = useQuery({
    queryKey: ["chat-conversations", q],
    queryFn: () => chatApi.conversations(q || undefined),
    refetchInterval: 45_000,
  });

  const messagesQ = useQuery({
    queryKey: ["chat-messages", selectedId],
    queryFn: () => chatApi.messages(selectedId!),
    enabled: Boolean(selectedId),
  });

  const directoryQ = useQuery({
    queryKey: ["chat-directory", dirQ],
    queryFn: () => chatApi.directory(dirQ || undefined),
    enabled: newChatOpen,
  });

  const settingsQ = useQuery({
    queryKey: ["chat-settings"],
    queryFn: () => chatApi.settings(),
    enabled: settingsOpen || canManage,
  });

  const selected = useMemo(
    () => conversationsQ.data?.find((c) => c.id === selectedId) || null,
    [conversationsQ.data, selectedId],
  );

  const messages = messagesQ.data?.items || [];

  const selectedIdRef = useRef(selectedId);
  const meIdRef = useRef(me?.id);
  selectedIdRef.current = selectedId;
  meIdRef.current = me?.id;

  useEffect(() => {
    setMobileShowChat(Boolean(selectedId));
  }, [selectedId]);

  useEffect(() => {
    const release = retainChatSocket();
    let alive = true;
    let detach: (() => void) | undefined;

    void (async () => {
      try {
        const s = await connectChatSocket();
        if (!alive) return;

        const onMessage = (payload: { message: ChatMessage }) => {
          const msg = payload?.message;
          if (!msg?.conversationId) return;
          qc.setQueryData(
            ["chat-messages", msg.conversationId],
            (old: { items: ChatMessage[] } | undefined) => {
              if (!old) return old;
              if (
                old.items.some(
                  (m) =>
                    m.id === msg.id ||
                    (msg.clientMessageId &&
                      m.clientMessageId === msg.clientMessageId),
                )
              ) {
                return old;
              }
              return { ...old, items: [...old.items, msg] };
            },
          );
          void qc.invalidateQueries({ queryKey: ["chat-conversations"] });
          if (
            msg.conversationId === selectedIdRef.current &&
            msg.senderId !== meIdRef.current
          ) {
            void chatApi.markRead(msg.conversationId, msg.id);
          }
        };

        const onEdited = (payload: { message: ChatMessage }) => {
          const msg = payload?.message;
          if (!msg) return;
          qc.setQueryData(
            ["chat-messages", msg.conversationId],
            (old: { items: ChatMessage[] } | undefined) => {
              if (!old) return old;
              return {
                ...old,
                items: old.items.map((m) =>
                  m.id === msg.id ? { ...m, ...msg } : m,
                ),
              };
            },
          );
        };

        const onDeleted = (payload: {
          messageId: string;
          conversationId: string;
        }) => {
          qc.setQueryData(
            ["chat-messages", payload.conversationId],
            (old: { items: ChatMessage[] } | undefined) => {
              if (!old) return old;
              return {
                ...old,
                items: old.items.map((m) =>
                  m.id === payload.messageId
                    ? {
                        ...m,
                        deleted: true,
                        deletedAt: new Date().toISOString(),
                        body: null,
                        attachments: [],
                      }
                    : m,
                ),
              };
            },
          );
        };

        const onTyping = (payload: {
          conversationId: string;
          userId: string;
          isTyping: boolean;
        }) => {
          if (payload.conversationId !== selectedIdRef.current) return;
          if (payload.userId === meIdRef.current) return;
          setTypingUser(payload.isTyping ? payload.userId : null);
        };

        const onPresence = (payload: { userId: string; online: boolean }) => {
          setOnlineMap((prev) => ({ ...prev, [payload.userId]: payload.online }));
        };

        const onPermission = () => {
          void qc.invalidateQueries({ queryKey: ["chat-directory"] });
          void qc.invalidateQueries({ queryKey: ["chat-settings"] });
          void qc.invalidateQueries({ queryKey: ["chat-conversations"] });
          toast.message("تنظیمات گفتگوی کارمندان به‌روز شد");
        };

        const onConvUpdated = () => {
          void qc.invalidateQueries({ queryKey: ["chat-conversations"] });
        };

        s.on("chat:message", onMessage);
        s.on("chat:message_edited", onEdited);
        s.on("chat:message_deleted", onDeleted);
        s.on("chat:typing", onTyping);
        s.on("chat:presence", onPresence);
        s.on("chat:permission_changed", onPermission);
        s.on("chat:conversation_updated", onConvUpdated);

        detach = () => {
          s.off("chat:message", onMessage);
          s.off("chat:message_edited", onEdited);
          s.off("chat:message_deleted", onDeleted);
          s.off("chat:typing", onTyping);
          s.off("chat:presence", onPresence);
          s.off("chat:permission_changed", onPermission);
          s.off("chat:conversation_updated", onConvUpdated);
        };
      } catch {
        /* REST still works */
      }
    })();

    return () => {
      alive = false;
      detach?.();
      release();
    };
  }, [qc]);

  useEffect(() => {
    if (!selectedId) return;
    const s = connectChatSocket().then((sock) => {
      sock.emit("chat:join", { conversationId: selectedId });
      return sock;
    });
    void chatApi.markRead(selectedId).then(() => {
      void qc.invalidateQueries({ queryKey: ["chat-conversations"] });
    });
    return () => {
      void s.then((sock) => sock.emit("chat:leave", { conversationId: selectedId }));
    };
  }, [selectedId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedId]);

  const sendMutation = useMutation({
    mutationFn: async (input: {
      text?: string;
      type?: "TEXT" | "VOICE" | "IMAGE" | "FILE";
      attachments?: Parameters<typeof chatApi.send>[1]["attachments"];
      clientMessageId: string;
    }) => {
      if (!selectedId) throw new Error("no conversation");
      return chatApi.send(selectedId, {
        type: input.type || "TEXT",
        body: input.text,
        clientMessageId: input.clientMessageId,
        replyToId: replyTo?.id,
        attachments: input.attachments,
      });
    },
    onMutate: async (input) => {
      if (!selectedId || !me) return;
      const optimistic: ChatMessage = {
        id: `tmp_${input.clientMessageId}`,
        conversationId: selectedId,
        senderId: me.id,
        type: input.type || "TEXT",
        body: input.text || null,
        clientMessageId: input.clientMessageId,
        createdAt: new Date().toISOString(),
        attachments: [],
        reactions: [],
        status: "pending",
        optimistic: true,
        replyToId: replyTo?.id,
      };
      qc.setQueryData(
        ["chat-messages", selectedId],
        (old: { items: ChatMessage[] } | undefined) => {
          if (!old) return { items: [optimistic], nextCursor: null, hasMore: false };
          return { ...old, items: [...old.items, optimistic] };
        },
      );
    },
    onSuccess: (result) => {
      setDraft("");
      setReplyTo(null);
      qc.setQueryData(
        ["chat-messages", selectedId],
        (old: { items: ChatMessage[] } | undefined) => {
          if (!old) return { items: [result.message], nextCursor: null, hasMore: false };
          const withoutTmp = old.items.filter(
            (m) =>
              m.clientMessageId !== result.message.clientMessageId &&
              m.id !== result.message.id,
          );
          return { ...old, items: [...withoutTmp, result.message] };
        },
      );
      void qc.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
    onError: (err: Error, input) => {
      qc.setQueryData(
        ["chat-messages", selectedId],
        (old: { items: ChatMessage[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((m) =>
              m.clientMessageId === input.clientMessageId
                ? { ...m, status: "failed" as const }
                : m,
            ),
          };
        },
      );
      toast.error(err.message || "ارسال ناموفق بود");
    },
  });

  function selectConversation(id: string) {
    onConversationChange?.(id);
    setMobileShowChat(true);
  }

  function clearConversation() {
    onConversationChange?.(null);
    setMobileShowChat(false);
  }

  async function openWithUser(user: ChatUser) {
    try {
      const conv = await chatApi.openDirect(user.id);
      void qc.invalidateQueries({ queryKey: ["chat-conversations"] });
      setNewChatOpen(false);
      selectConversation(conv.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "امکان شروع گفتگو نیست");
    }
  }

  function emitTyping(isTyping: boolean) {
    if (!selectedId) return;
    void connectChatSocket().then((s) => {
      s.emit("chat:typing", { conversationId: selectedId, isTyping });
    });
  }

  function onDraftChange(value: string) {
    setDraft(value);
    emitTyping(true);
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
    typingTimeout.current = window.setTimeout(() => emitTyping(false), 1200);
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || !selectedId || !canSend) return;
    sendMutation.mutate({
      text,
      type: "TEXT",
      clientMessageId: newClientMessageId(),
    });
    emitTyping(false);
  }

  async function handleFile(file: File) {
    if (!selectedId || !canSend) return;
    try {
      const isImage = file.type.startsWith("image/");
      const uploaded = await uploadChatAttachment(selectedId, file);
      sendMutation.mutate({
        type: isImage ? "IMAGE" : "FILE",
        clientMessageId: newClientMessageId(),
        attachments: [uploaded],
        text: draft.trim() || undefined,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "بارگذاری ناموفق");
    }
  }

  async function startRecording() {
    if (!selectedId || !canSend) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const durationMs = recordMs;
        setRecording(false);
        setRecordMs(0);
        try {
          const uploaded = await uploadChatAttachment(selectedId, blob, {
            kind: "voice",
            durationMs,
            fileName: `voice-${Date.now()}.webm`,
          });
          sendMutation.mutate({
            type: "VOICE",
            clientMessageId: newClientMessageId(),
            attachments: [uploaded],
          });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "ارسال صوت ناموفق");
        }
      };
      mediaRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordMs(0);
      recordTimer.current = window.setInterval(() => {
        setRecordMs((v) => v + 200);
      }, 200);
    } catch {
      toast.error("دسترسی به میکروفون ممکن نیست");
    }
  }

  function stopRecording(cancel = false) {
    if (recordTimer.current) window.clearInterval(recordTimer.current);
    const recorder = mediaRef.current;
    if (!recorder) return;
    if (cancel) {
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setRecordMs(0);
      };
    }
    if (recorder.state !== "inactive") recorder.stop();
  }

  const peerOnline =
    selected?.peer?.id != null
      ? onlineMap[selected.peer.id] ?? selected.peer.isOnline
      : false;

  let lastDay = "";

  return (
    <div
      className={cn(
        "flex min-h-0 overflow-hidden border-border bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-100 via-background to-background dark:from-zinc-900/40",
        isDrawer
          ? "h-full w-full border-0"
          : "-m-4 h-[calc(100dvh-4.5rem)] min-h-[420px] border-t md:-m-6",
        className,
      )}
    >
      {/* Conversation list */}
      <aside
        className={cn(
          "flex w-full flex-col border-e border-border bg-background/90 backdrop-blur",
          isDrawer ? "md:w-[280px] md:min-w-[240px]" : "md:w-[340px] md:min-w-[300px]",
          mobileShowChat && selectedId ? "hidden md:flex" : "flex",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">گفتگو</h1>
            <p className="text-xs text-muted-foreground">پیام‌رسانی امن تیم</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {canManage ? (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setSettingsOpen(true)}
                title="تنظیمات دسترسی"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            ) : null}
            <Button size="sm" onClick={() => setNewChatOpen(true)}>
              گفتگوی جدید
            </Button>
            {isDrawer && onRequestClose ? (
              <Button
                size="icon"
                variant="ghost"
                onClick={onRequestClose}
                title="بستن"
                aria-label="بستن گفتگو"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجوی گفتگو..."
              className="ps-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversationsQ.isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : !conversationsQ.data?.length ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              هنوز گفتگویی ندارید. با «گفتگوی جدید» شروع کنید.
            </div>
          ) : (
            conversationsQ.data.map((c: ChatConversation) => {
              const online =
                c.peer?.id != null
                  ? onlineMap[c.peer.id] ?? c.peer.isOnline
                  : false;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectConversation(c.id)}
                  className={cn(
                    "flex w-full items-start gap-3 px-3 py-3 text-start transition hover:bg-muted/60",
                    selectedId === c.id && "bg-muted",
                  )}
                >
                  <div className="relative shrink-0">
                    <UserAvatar
                      name={c.title}
                      profileImage={c.peer?.profileImage}
                      profileImageUrl={c.peer?.profileImageUrl}
                      className="h-11 w-11"
                    />
                    <PresenceDot online={online} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1">
                        {c.pinned ? <Pin className="h-3 w-3 shrink-0 text-amber-500" /> : null}
                        <span className="truncate font-medium">{c.title}</span>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatChatTime(c.lastMessageAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-muted-foreground">
                        {c.lastMessagePreview || "بدون پیام"}
                      </p>
                      {c.unreadCount > 0 ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                          {c.unreadCount > 99 ? "99+" : c.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Chat window */}
      <section
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          !mobileShowChat || !selectedId ? "hidden md:flex" : "flex",
        )}
      >
        {!selectedId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
            <p className="text-lg font-medium text-foreground">یک گفتگو را انتخاب کنید</p>
            <p className="max-w-sm text-sm">
              پیام‌های متنی و صوتی با کنترل دسترسی مدیر، به‌صورت امن رد و بدل می‌شوند.
            </p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-border bg-background/80 px-3 py-2.5 backdrop-blur">
              <Button
                size="icon"
                variant="ghost"
                className="md:hidden"
                onClick={clearConversation}
                aria-label="بازگشت به لیست گفتگوها"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
              <div className="relative">
                <UserAvatar
                  name={selected?.title}
                  profileImage={selected?.peer?.profileImage}
                  profileImageUrl={selected?.peer?.profileImageUrl}
                  className="h-10 w-10"
                />
                <PresenceDot online={peerOnline} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{selected?.title}</div>
                <div className="text-xs text-muted-foreground">
                  {typingUser
                    ? "در حال نوشتن…"
                    : peerOnline
                      ? "آنلاین"
                      : "آفلاین"}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (!selectedId) return;
                  void chatApi
                    .prefs(selectedId, { pinned: !selected?.pinned })
                    .then(() =>
                      qc.invalidateQueries({ queryKey: ["chat-conversations"] }),
                    );
                }}
                title={selected?.pinned ? "برداشتن سنجاق" : "سنجاق کردن"}
                aria-label={selected?.pinned ? "برداشتن سنجاق" : "سنجاق کردن"}
              >
                <Pin className={cn("h-4 w-4", selected?.pinned && "text-amber-500")} />
              </Button>
            </header>

            <div className="flex-1 space-y-1 overflow-y-auto px-3 py-4 md:px-6">
              {messagesQ.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-2/3 rounded-2xl" />
                  ))}
                </div>
              ) : (
                messages.map((m) => {
                  const day = formatChatDay(m.createdAt);
                  const showDay = day && day !== lastDay;
                  lastDay = day;
                  const mine = m.senderId === me?.id;
                  return (
                    <div key={m.id}>
                      {showDay ? (
                        <div className="my-3 flex justify-center">
                          <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
                            {day}
                          </span>
                        </div>
                      ) : null}
                      <div
                        className={cn(
                          "mb-1 flex items-end gap-2",
                          mine ? "justify-start" : "justify-end",
                        )}
                      >
                        {!mine ? (
                          <UserAvatar
                            name={m.sender?.fullName || selected?.title}
                            profileImage={m.sender?.profileImage}
                            profileImageUrl={m.sender?.profileImageUrl}
                            className="mb-0.5 h-7 w-7"
                            fallbackClassName="text-[10px]"
                          />
                        ) : null}
                        <div
                          className={cn(
                            "max-w-[min(85%,28rem)] rounded-2xl px-3 py-2 text-sm shadow-sm",
                            mine
                              ? "rounded-se-md bg-primary text-primary-foreground"
                              : "rounded-ss-md bg-muted",
                            m.deleted && "opacity-60 italic",
                          )}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            if (!m.deleted) setReplyTo(m);
                          }}
                        >
                          {m.replyTo ? (
                            <div
                              className={cn(
                                "mb-1 rounded-md border-s-2 px-2 py-1 text-xs opacity-80",
                                mine ? "border-white/40 bg-white/10" : "border-primary/40 bg-background/50",
                              )}
                            >
                              {m.replyTo.deleted
                                ? "پیام حذف‌شده"
                                : m.replyTo.body || "پیوست"}
                            </div>
                          ) : null}
                          {m.deleted ? (
                            "این پیام حذف شد"
                          ) : m.type === "VOICE" && m.attachments[0] ? (
                            <VoiceBubble attachment={m.attachments[0]} mine={mine} />
                          ) : m.type === "IMAGE" && m.attachments[0] ? (
                            <ChatAttachmentImage attachment={m.attachments[0]} />
                          ) : m.attachments[0] ? (
                            <a
                              href={chatAttachmentUrl(m.attachments[0].id)}
                              target="_blank"
                              rel="noreferrer"
                              className="underline underline-offset-2"
                            >
                              📎 {m.attachments[0].fileName}
                            </a>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          )}
                          <div
                            className={cn(
                              "mt-1 flex items-center justify-end gap-1 text-[10px]",
                              mine ? "text-primary-foreground/70" : "text-muted-foreground",
                            )}
                          >
                            {m.editedAt ? <span>ویرایش‌شده</span> : null}
                            <span>{formatChatTime(m.createdAt)}</span>
                            {mine ? <StatusTicks status={m.status} /> : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {replyTo ? (
              <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/40 px-3 py-2 text-xs">
                <div className="min-w-0 truncate">
                  پاسخ به: {replyTo.body || "پیام"}
                </div>
                <Button size="icon" variant="ghost" onClick={() => setReplyTo(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : null}

            <footer className="border-t border-border bg-background/90 p-3 backdrop-blur">
              {recording ? (
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  <span className="text-sm">
                    در حال ضبط… {(recordMs / 1000).toFixed(1)}ث
                  </span>
                  <div className="ms-auto flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => stopRecording(true)}>
                      لغو
                    </Button>
                    <Button size="sm" onClick={() => stopRecording(false)}>
                      ارسال
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,audio/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleFile(f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={!canSend}
                    onClick={() => fileInputRef.current?.click()}
                    title="پیوست"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={!canSend}
                    onClick={() => void startRecording()}
                    title="پیام صوتی"
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                  <textarea
                    value={draft}
                    onChange={(e) => onDraftChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    rows={1}
                    placeholder={canSend ? "پیام بنویسید…" : "مجوز ارسال ندارید"}
                    disabled={!canSend}
                    className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Button
                    size="icon"
                    disabled={!canSend || !draft.trim() || sendMutation.isPending}
                    onClick={() => void handleSend()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </footer>
          </>
        )}
      </section>

      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>گفتگوی جدید</DialogTitle>
            <DialogDescription>
              فقط افرادی که مجاز به گفتگو با شما هستند نمایش داده می‌شوند.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={dirQ}
            onChange={(e) => setDirQ(e.target.value)}
            placeholder="جستجوی نام..."
          />
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {directoryQ.isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : !directoryQ.data?.users.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                کاربری یافت نشد
                {directoryQ.data?.employeePolicy === "DISABLED"
                  ? " — گفتگوی کارمند با کارمند غیرفعال است"
                  : ""}
              </p>
            ) : (
              directoryQ.data.users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-start hover:bg-muted"
                  onClick={() => void openWithUser(u)}
                >
                  <div className="relative">
                    <UserAvatar
                      name={u.fullName}
                      profileImage={u.profileImage}
                      profileImageUrl={u.profileImageUrl}
                      className="h-9 w-9"
                    />
                    <PresenceDot online={u.isOnline} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{u.fullName}</div>
                    <div className="text-xs text-muted-foreground">{u.roleCode}</div>
                  </div>
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewChatOpen(false)}>
              بستن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canManage ? (
        <ChatSettingsPanel
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          settings={settingsQ.data}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["chat-settings"] });
            void qc.invalidateQueries({ queryKey: ["chat-directory"] });
          }}
        />
      ) : null}
    </div>
  );
}

export type { ChatEmployeePolicy };
