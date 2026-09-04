"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "../_components/types";

export default function BusinessAssistantChatPage() {
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");

  const { data: messages, isLoading } = useQuery({
    queryKey: ["business-assistant-chat"],
    queryFn: () => apiGet<ChatMessage[]>("/business-assistant/chat/messages"),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: (text: string) =>
      apiPost("/business-assistant/chat/messages", { message: text }),
    onSuccess: () => {
      setMessage("");
      qc.invalidateQueries({ queryKey: ["business-assistant-chat"] });
    },
    onError: () => toast.error("ارسال پیام ناموفق بود"),
  });

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col space-y-4">
      <PageHeader
        title="گفتگو با دستیار مدیریت"
        subtitle="سوال‌های خود درباره کسب‌وکار، عملکرد و استراتژی را بپرسید"
      />

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-4">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : !messages?.length ? (
              <p className="text-center text-sm text-muted-foreground">
                گفتگو را شروع کنید — مثلاً «وضعیت مالی این ماه چطور است؟» یا «چه
                استراتژی برای رشد پیشنهاد می‌دهی؟»
              </p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    msg.role === "USER"
                      ? "ms-auto bg-brand text-brand-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const text = message.trim();
              if (!text || sendMutation.isPending) return;
              sendMutation.mutate(text);
            }}
          >
            <Textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="سوال خود را بنویسید..."
              className="min-h-[60px] resize-none"
            />
            <Button
              type="submit"
              size="icon"
              className="h-auto shrink-0"
              disabled={sendMutation.isPending || !message.trim()}
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
