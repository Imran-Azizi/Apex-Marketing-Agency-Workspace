"use client";

import { Mail, MessageCircle, Phone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ContactChannel, PublicContactInfo } from "@/lib/contact";

const CHANNEL_ICONS: Record<ContactChannel["id"], LucideIcon> = {
  whatsapp: MessageCircle,
  phone: Phone,
  email: Mail,
};

function ContactInfoCard({ channel }: { channel: ContactChannel }) {
  const Icon = CHANNEL_ICONS[channel.id];
  const isExternal = channel.href.startsWith("http");
  const disabled = !channel.href || !channel.value;

  const className = cn(
    "group flex w-full items-center gap-4 rounded-2xl border border-border/70 bg-card/80 p-4 text-start shadow-sm",
    "transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    disabled
      ? "cursor-not-allowed opacity-60"
      : "hover:-translate-y-0.5 hover:border-brand/40 hover:bg-card hover:shadow-md hover:shadow-brand/5 dark:bg-card/60 dark:hover:bg-card/80",
  );

  const body = (
    <>
      <span
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand",
          "transition-colors",
          !disabled && "group-hover:border-brand/40 group-hover:bg-brand/15",
        )}
        aria-hidden
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-muted-foreground">
          {channel.label}
        </span>
        <span
          className="mt-0.5 block truncate text-sm font-semibold text-foreground"
          dir={channel.id === "email" ? "ltr" : "ltr"}
        >
          {channel.value || "—"}
        </span>
      </span>
    </>
  );

  if (disabled) {
    return (
      <div className={className} aria-disabled="true">
        {body}
      </div>
    );
  }

  return (
    <a
      href={channel.href}
      className={className}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
    >
      {body}
    </a>
  );
}

export function ContactInfoPanel({
  info,
  isLoading,
}: {
  info?: PublicContactInfo;
  isLoading?: boolean;
}) {
  const channels = info
    ? [info.whatsapp, info.phone, info.email]
    : [];

  return (
    <aside className="flex h-full flex-col rounded-3xl border border-border/70 bg-gradient-to-b from-card via-card to-muted/20 p-6 shadow-sm dark:from-card/80 dark:via-card/70 dark:to-background/40 sm:p-7">
      <p className="text-xs font-semibold tracking-wide text-brand">راه‌های ارتباطی</p>
      <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground">
        مستقیم با ما در تماس باشید
      </h2>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        از طریق واتساپ، تماس تلفنی یا ایمیل می‌توانید با تیم اپیکس ارتباط بگیرید.
      </p>

      <div className="mt-6 space-y-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[4.5rem] w-full rounded-2xl" />
            ))
          : channels.map((channel) => (
              <ContactInfoCard key={channel.id} channel={channel} />
            ))}
      </div>

      <div className="mt-8 rounded-2xl border border-brand/20 bg-brand/5 px-4 py-4 text-sm leading-7 text-muted-foreground dark:bg-brand/10">
        ساعات پاسخگویی: همه‌روزه از ۹ صبح تا ۶ عصر
      </div>
    </aside>
  );
}
