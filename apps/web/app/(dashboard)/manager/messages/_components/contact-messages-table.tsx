"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContactMessage } from "@/lib/contact";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContactMessageRow } from "./contact-message-row";
import { formatCount } from "./types";

export function ContactMessagesTable({
  items,
  canEdit,
  canDelete,
  isFetching,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onOpen,
  onMarkRead,
  onMarkUnread,
  onDelete,
}: {
  items: ContactMessage[];
  canEdit: boolean;
  canDelete: boolean;
  isFetching?: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onOpen: (message: ContactMessage) => void;
  onMarkRead: (message: ContactMessage) => void;
  onMarkUnread: (message: ContactMessage) => void;
  onDelete: (message: ContactMessage) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm",
        "dark:shadow-none",
        isFetching && "opacity-70 transition-opacity",
      )}
    >
      <Table className="min-w-[40rem] lg:min-w-[64rem]">
        <TableHeader className="sticky top-0 z-[1]">
          <TableRow className="border-border/70 hover:bg-transparent">
            <TableHead className="whitespace-nowrap bg-muted/70 text-[11px] font-semibold tracking-wide text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-muted/80">
              وضعیت
            </TableHead>
            <TableHead className="whitespace-nowrap bg-muted/70 text-[11px] font-semibold tracking-wide text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-muted/80">
              مشتری
            </TableHead>
            <TableHead className="whitespace-nowrap bg-muted/70 text-[11px] font-semibold tracking-wide text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-muted/80">
              موضوع
            </TableHead>
            <TableHead className="hidden whitespace-nowrap bg-muted/70 text-[11px] font-semibold tracking-wide text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-muted/80 md:table-cell">
              شرکت
            </TableHead>
            <TableHead className="hidden whitespace-nowrap bg-muted/70 text-[11px] font-semibold tracking-wide text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-muted/80 sm:table-cell">
              شماره تماس
            </TableHead>
            <TableHead className="hidden whitespace-nowrap bg-muted/70 text-[11px] font-semibold tracking-wide text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-muted/80 lg:table-cell">
              ایمیل
            </TableHead>
            <TableHead className="whitespace-nowrap bg-muted/70 text-[11px] font-semibold tracking-wide text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-muted/80">
              تاریخ
            </TableHead>
            <TableHead className="w-14 bg-muted/70 text-center text-[11px] font-semibold tracking-wide text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-muted/80">
              عملیات
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((message) => (
            <ContactMessageRow
              key={message.id}
              message={message}
              canEdit={canEdit}
              canDelete={canDelete}
              onOpen={() => onOpen(message)}
              onMarkRead={() => onMarkRead(message)}
              onMarkUnread={() => onMarkUnread(message)}
              onDelete={() => onDelete(message)}
            />
          ))}
        </TableBody>
      </Table>

      <div className="flex flex-col items-center justify-between gap-3 border-t border-border/70 bg-muted/20 px-4 py-3 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          {total > 0
            ? `نمایش ${formatCount(from)} تا ${formatCount(to)} از ${formatCount(total)} نتیجه`
            : "نتیجه‌ای برای نمایش نیست"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1 || isFetching}
            aria-label="صفحه قبلی"
          >
            <ChevronRight className="h-4 w-4" />
            قبلی
          </Button>
          <span className="min-w-[5.5rem] text-center text-sm tabular-nums text-muted-foreground">
            صفحه {formatCount(page)} از {formatCount(totalPages)}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages || isFetching}
            aria-label="صفحه بعدی"
          >
            بعدی
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
