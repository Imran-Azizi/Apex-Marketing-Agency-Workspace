"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { useHasPermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessageIcon, UnreadMessageBadge } from "@/components/contact/unread-message-badge";

export function MessageInboxButton({ className }: { className?: string }) {
  const canView = useHasPermission("contact.view");

  const query = useQuery({
    queryKey: ["contact-unread-count"],
    queryFn: () => apiGet<{ unreadCount: number; total?: number; readCount?: number }>("/contact/unread-count"),
    enabled: canView,
    staleTime: 20_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  if (!canView) return null;

  const unreadCount = query.data?.unreadCount ?? 0;

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative", className)}
      asChild
    >
      <Link
        href="/manager/messages"
        aria-label={
          unreadCount > 0
            ? `پیام‌های تماس، ${unreadCount} خوانده‌نشده`
            : "پیام‌های تماس"
        }
        title="پیام‌های تماس"
      >
        <MessageIcon />
        <UnreadMessageBadge count={unreadCount} />
      </Link>
    </Button>
  );
}
