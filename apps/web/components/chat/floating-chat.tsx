"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasPermission } from "@/lib/rbac";
import { useMeQuery } from "@/lib/permissions";
import { chatApi } from "@/lib/chat";
import { retainChatSocket } from "@/lib/chat-socket";
import { subscribeChatOpen } from "@/lib/chat-launcher";
import dynamic from "next/dynamic";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const ChatWorkspace = dynamic(
  () =>
    import("@/components/chat/chat-workspace").then((m) => m.ChatWorkspace),
  { ssr: false },
);

function FloatingChatLauncherInner() {
  const { data: me } = useMeQuery();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const canChat = hasPermission(me?.permissions, "chat.view", me?.role);

  const conversationsQ = useQuery({
    queryKey: ["chat-conversations", ""],
    queryFn: () => chatApi.conversations(),
    enabled: canChat,
    staleTime: 20_000,
    refetchInterval: open ? 45_000 : 90_000,
    refetchOnWindowFocus: false,
  });

  const unreadTotal = useMemo(() => {
    const list = conversationsQ.data || [];
    return list.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  }, [conversationsQ.data]);

  useEffect(() => {
    if (!canChat) return;
    return retainChatSocket();
  }, [canChat]);

  useEffect(() => {
    return subscribeChatOpen((id) => {
      setOpen(true);
      if (id) setConversationId(id);
    });
  }, []);

  // Legacy /chat?c= links redirect to /dashboard?c= — open drawer and clean URL.
  useEffect(() => {
    if (!canChat) return;
    const legacyId = searchParams.get("c");
    if (!legacyId) return;
    setConversationId(legacyId);
    setOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("c");
    const qs = params.toString();
    router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [canChat, router, searchParams]);

  if (!canChat) return null;

  const label =
    unreadTotal > 0
      ? `گفتگو، ${unreadTotal} پیام خوانده‌نشده`
      : "گفتگو";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        aria-controls="apex-chat-drawer"
        title="گفتگو"
        className={cn(
          "fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full",
          "border border-border/80 bg-primary text-primary-foreground shadow-lg",
          "transition-transform duration-200 hover:scale-105 hover:shadow-xl",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "active:scale-95",
          open && "ring-2 ring-ring ring-offset-2",
        )}
      >
        <MessagesSquare className="h-6 w-6" aria-hidden />
        {unreadTotal > 0 ? (
          <span
            className={cn(
              "absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full",
              "bg-destructive px-1 text-[10px] font-bold text-destructive-foreground shadow",
            )}
          >
            {unreadTotal > 99 ? "99+" : unreadTotal}
          </span>
        ) : null}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          id="apex-chat-drawer"
          side="left"
          showCloseButton={false}
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            "w-[min(100vw,42rem)] sm:max-w-[42rem]",
            "md:w-[min(100vw,48rem)] md:max-w-[48rem]",
            "max-sm:w-full max-sm:max-w-none",
          )}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>گفتگو</SheetTitle>
            <SheetDescription>پیام‌رسانی امن بین اعضای تیم</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            {open ? (
              <ChatWorkspace
                variant="drawer"
                conversationId={conversationId}
                onConversationChange={setConversationId}
                onRequestClose={() => setOpen(false)}
                className="h-[100dvh]"
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * Floating circular chat control (physical left) + left→right drawer.
 * Single entry point for internal chat across the dashboard.
 */
export function FloatingChatLauncher() {
  return (
    <Suspense fallback={null}>
      <FloatingChatLauncherInner />
    </Suspense>
  );
}

