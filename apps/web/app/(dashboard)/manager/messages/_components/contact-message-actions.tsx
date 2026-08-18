"use client";

import {
  Eye,
  Mail,
  MailOpen,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ContactMessage } from "@/lib/contact";

export function ContactMessageActions({
  message,
  canEdit,
  canDelete,
  onView,
  onMarkRead,
  onMarkUnread,
  onDelete,
}: {
  message: ContactMessage;
  canEdit: boolean;
  canDelete: boolean;
  onView: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          title="عملیات"
          aria-label={`عملیات پیام ${message.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>عملیات</DropdownMenuLabel>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
        >
          <Eye className="me-2 h-4 w-4" />
          مشاهده
        </DropdownMenuItem>
        {canEdit && !message.isRead ? (
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead();
            }}
          >
            <MailOpen className="me-2 h-4 w-4" />
            علامت‌گذاری به‌عنوان خوانده‌شده
          </DropdownMenuItem>
        ) : null}
        {canEdit && message.isRead ? (
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onMarkUnread();
            }}
          >
            <Mail className="me-2 h-4 w-4" />
            علامت‌گذاری به‌عنوان خوانده‌نشده
          </DropdownMenuItem>
        ) : null}
        {canDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="me-2 h-4 w-4" />
              حذف
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
