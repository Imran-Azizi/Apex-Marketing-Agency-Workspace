"use client";

import {
  Eye,
  Pencil,
  Trash2,
  Send,
  MoreHorizontal,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { VideoStorageItem } from "./types";

export function VideoStorageActions({
  item,
  canEdit,
  canDelete,
  canSendPortfolio,
  sendPending,
  onPreview,
  onEdit,
  onDelete,
  onSendPortfolio,
}: {
  item: VideoStorageItem;
  canEdit?: boolean;
  canDelete?: boolean;
  canSendPortfolio?: boolean;
  sendPending?: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSendPortfolio: () => void;
}) {
  const showSend = canSendPortfolio && item.canSendToPortfolio;

  return (
    <div className="flex flex-wrap items-center gap-1.5" dir="rtl">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 rounded-lg px-2.5"
        onClick={onPreview}
      >
        <Eye className="me-1 h-3.5 w-3.5" />
        پخش
      </Button>

      {showSend ? (
        <Button
          type="button"
          size="sm"
          variant="brand"
          className="h-8 rounded-lg px-2.5"
          disabled={sendPending}
          onClick={onSendPortfolio}
        >
          <Send className="me-1 h-3.5 w-3.5" />
          ارسال به نمونه‌کارها
        </Button>
      ) : null}

      {(canEdit || canDelete || item.inPortfolio) ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="ms-auto h-8 w-8 rounded-lg"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">عملیات بیشتر</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44" dir="rtl">
            {canEdit ? (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="ms-2 h-4 w-4" />
                ویرایش اطلاعات
              </DropdownMenuItem>
            ) : null}
            {item.inPortfolio ? (
              <DropdownMenuItem asChild>
                <Link href="/manager/portfolio">
                  <ExternalLink className="ms-2 h-4 w-4" />
                  رفتن به نمونه‌کارها
                </Link>
              </DropdownMenuItem>
            ) : null}
            {canDelete ? (
              <>
                {(canEdit || item.inPortfolio) ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="ms-2 h-4 w-4" />
                  حذف ویدیو
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
