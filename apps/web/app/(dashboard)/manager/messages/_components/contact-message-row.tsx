"use client";

import { cn, formatDateTime, formatPhoneDisplay } from "@/lib/utils";
import type { ContactMessage } from "@/lib/contact";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { ContactMessageActions } from "./contact-message-actions";

export function ContactMessageRow({
  message,
  canEdit,
  canDelete,
  onOpen,
  onMarkRead,
  onMarkUnread,
  onDelete,
}: {
  message: ContactMessage;
  canEdit: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onDelete: () => void;
}) {
  const unread = !message.isRead;

  return (
    <TableRow
      tabIndex={0}
      aria-label={`${unread ? "خوانده‌نشده" : "خوانده‌شده"}، ${message.name}، ${message.subjectLabel}`}
      className={cn(
        "cursor-pointer border-border/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40",
        unread
          ? "bg-brand/[0.04] hover:bg-brand/[0.07] dark:bg-brand/[0.07] dark:hover:bg-brand/[0.11]"
          : "hover:bg-muted/40",
      )}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <TableCell className="whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              unread ? "bg-brand" : "bg-muted-foreground/30",
            )}
            aria-hidden
          />
          {unread ? (
            <Badge variant="brand" className="h-6 px-2 text-[10px] font-bold">
              جدید
            </Badge>
          ) : (
            <Badge variant="secondary" className="h-6 px-2 text-[10px]">
              خوانده‌شده
            </Badge>
          )}
          <span className="sr-only">
            {unread ? "خوانده‌نشده" : "خوانده‌شده"}
          </span>
        </div>
      </TableCell>

      <TableCell>
        <p
          className={cn(
            "max-w-[10rem] truncate text-sm text-foreground",
            unread ? "font-bold" : "font-medium",
          )}
          title={message.name}
        >
          {message.name}
        </p>
      </TableCell>

      <TableCell>
        <p
          className={cn(
            "max-w-[11rem] truncate text-sm",
            unread ? "font-semibold text-foreground" : "text-foreground/85",
          )}
          title={message.subjectLabel}
        >
          {message.subjectLabel}
        </p>
      </TableCell>

      <TableCell className="hidden md:table-cell">
        <p
          className="max-w-[9rem] truncate text-sm text-muted-foreground"
          title={message.company || undefined}
        >
          {message.company || "—"}
        </p>
      </TableCell>

      <TableCell className="hidden sm:table-cell">
        <span dir="ltr" className="block whitespace-nowrap text-sm tabular-nums">
          {formatPhoneDisplay(message.phone)}
        </span>
      </TableCell>

      <TableCell className="hidden lg:table-cell">
        <span
          dir="ltr"
          className="block max-w-[13rem] truncate text-sm text-muted-foreground"
          title={message.email}
        >
          {message.email}
        </span>
      </TableCell>

      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
        <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
      </TableCell>

      <TableCell
        className="text-center"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <ContactMessageActions
          message={message}
          canEdit={canEdit}
          canDelete={canDelete}
          onView={onOpen}
          onMarkRead={onMarkRead}
          onMarkUnread={onMarkUnread}
          onDelete={onDelete}
        />
      </TableCell>
    </TableRow>
  );
}
