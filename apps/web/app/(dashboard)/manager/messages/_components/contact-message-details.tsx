"use client";

import { Building2, Mail, MailOpen, Phone, Trash2 } from "lucide-react";
import { formatPhoneDisplay } from "@/lib/utils";
import type { ContactMessage } from "@/lib/contact";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function DetailRow({
  icon: Icon,
  label,
  value,
  href,
  ltr,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  href?: string;
  ltr?: boolean;
}) {
  const content = href ? (
    <a
      href={href}
      className="font-medium text-foreground underline-offset-4 hover:text-brand hover:underline"
      dir={ltr ? "ltr" : undefined}
    >
      {value}
    </a>
  ) : (
    <span className="font-medium text-foreground" dir={ltr ? "ltr" : undefined}>
      {value}
    </span>
  );

  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-[11px] leading-4 text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words text-sm leading-6">{content}</p>
      </div>
    </div>
  );
}

export function ContactMessageDetailsSkeleton() {
  return (
    <div className="space-y-5 p-6" aria-busy="true" aria-label="در حال بارگذاری پیام">
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-44 rounded-xl" />
    </div>
  );
}

export function ContactMessageDetails({
  message,
  canEdit,
  canDelete,
  onMarkRead,
  onMarkUnread,
  onDelete,
  pending,
}: {
  message: ContactMessage;
  canEdit: boolean;
  canDelete: boolean;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onDelete: () => void;
  pending?: boolean;
}) {
  const tel = message.phone.replace(/\D/g, "");
  const telHref = tel
    ? tel.startsWith("93")
      ? `tel:+${tel}`
      : `tel:${message.phone}`
    : undefined;
  const hasActions = canEdit || canDelete;

  return (
    <article className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-border/70 px-5 py-4 pe-12 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {message.name}
          </h2>
          {message.isRead ? (
            <Badge variant="secondary">خوانده‌شده</Badge>
          ) : (
            <Badge variant="brand">خوانده‌نشده</Badge>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
        <section className="grid gap-4 sm:grid-cols-2">
          <DetailRow
            icon={Mail}
            label="ایمیل"
            value={message.email}
            href={`mailto:${message.email}`}
            ltr
          />
          <DetailRow
            icon={Phone}
            label="شماره تماس"
            value={formatPhoneDisplay(message.phone)}
            href={telHref}
            ltr
          />
          <DetailRow
            icon={Building2}
            label="شرکت"
            value={message.company || "—"}
          />
          <DetailRow
            icon={MailOpen}
            label="موضوع"
            value={message.subjectLabel}
          />
        </section>

        <section className="rounded-xl border border-border/70 bg-muted/20 p-4 sm:p-5">
          <h3 className="text-xs font-medium text-muted-foreground">متن پیام</h3>
          <p className="mt-2.5 whitespace-pre-wrap break-words text-sm leading-8 text-foreground">
            {message.message}
          </p>
        </section>
      </div>

      {hasActions ? (
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 px-5 py-3 sm:px-6">
          {canEdit && !message.isRead ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={onMarkRead}
            >
              <MailOpen className="h-3.5 w-3.5" />
              خوانده‌شده
            </Button>
          ) : null}
          {canEdit && message.isRead ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={onMarkUnread}
            >
              <Mail className="h-3.5 w-3.5" />
              خوانده‌نشده
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              حذف
            </Button>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}
