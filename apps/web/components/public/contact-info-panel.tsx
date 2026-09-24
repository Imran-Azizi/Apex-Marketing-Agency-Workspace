"use client";

import { useQuery } from "@tanstack/react-query";
import { Mail, MessageCircle, Phone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { apiGet } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CONTACT_HOURS_TEXT,
  type ContactChannel,
  type PublicContactInfo,
} from "@/lib/contact";

const CHANNEL_ICONS: Record<ContactChannel["id"], LucideIcon> = {
  whatsapp: MessageCircle,
  phone: Phone,
  email: Mail,
};

const STALE_MS = 5 * 60_000;

function ContactInfoCard({ channel }: { channel: ContactChannel }) {
  const Icon = CHANNEL_ICONS[channel.id];
  const isExternal = channel.href.startsWith("http");
  const disabled = !channel.href || !channel.value;

  const className = cn(
    "group flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card/80 p-3.5 text-start shadow-sm sm:gap-4 sm:p-4",
    "transition-[transform,box-shadow,border-color,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
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
          "transition-[border-color,background-color,transform] duration-200",
          !disabled &&
            "group-hover:border-brand/40 group-hover:bg-brand/15 group-hover:scale-105",
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
          className={cn(
            "mt-0.5 block text-sm font-semibold text-foreground",
            channel.id === "email" ? "break-all" : "truncate",
          )}
          dir="ltr"
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
  isLoading: isLoadingProp,
}: {
  info?: PublicContactInfo | null;
  isLoading?: boolean;
}) {
  const contactQ = useQuery({
    queryKey: ["public-contact-info"],
    queryFn: () => apiGet<PublicContactInfo>("/public/contact-info"),
    staleTime: STALE_MS,
    initialData: info ?? undefined,
    initialDataUpdatedAt: info ? Date.now() : undefined,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const resolved = contactQ.data ?? info ?? undefined;
  const channels = resolved
    ? [resolved.whatsapp, resolved.phone, resolved.email].filter(
        (channel): channel is ContactChannel => Boolean(channel?.id),
      )
    : [];
  const isLoading =
    Boolean(isLoadingProp) || (contactQ.isLoading && !resolved);

  return (
    <aside className="overflow-visible rounded-3xl border border-border/60 bg-card p-5 shadow-sm sm:p-6 lg:p-7">
      <p className="text-xs font-semibold tracking-wide text-brand">
        راه‌های ارتباطی
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        مستقیم با ما در تماس باشید
      </h3>

      <div className="mt-5 space-y-3 sm:mt-6">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[4.5rem] w-full rounded-2xl" />
            ))
          : channels.map((channel) => (
              <ContactInfoCard key={channel.id} channel={channel} />
            ))}
      </div>

      <div className="mt-5 rounded-2xl bg-brand/5 px-4 py-3.5 text-sm leading-7 text-muted-foreground sm:mt-6 sm:py-4 dark:bg-brand/10">
        {CONTACT_HOURS_TEXT}
      </div>
    </aside>
  );
}
