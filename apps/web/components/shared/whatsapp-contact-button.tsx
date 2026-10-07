"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import {
  buildWhatsAppChatUrl,
  cn,
  openWhatsAppChat,
  resolveWhatsAppContactSource,
  type WhatsAppContactFields,
} from "@/lib/utils";

const TOOLTIP_ACTIVE = "تماس در واتساپ";
const TOOLTIP_MISSING = "شماره واتساپ ثبت نشده است";

export function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export type WhatsAppContactButtonProps = {
  /** Customer-like record; preferred source for CRM rows. */
  contact?: WhatsAppContactFields | null;
  /** Direct phone/WhatsApp value when a full contact object is unavailable. */
  phone?: string | null;
  /** Optional prefilled chat message. */
  message?: string;
  className?: string;
  /** Prevent parent row click / navigation handlers. */
  stopPropagation?: boolean;
  /** Show text next to the icon (default: icon-only). */
  showLabel?: boolean;
  label?: string;
  size?: "sm" | "md";
};

/**
 * Reusable WhatsApp contact action for customer / lead records.
 * Builds https://wa.me/<digits> from stored phone fields (no hard-coded numbers).
 */
export function WhatsAppContactButton({
  contact,
  phone,
  message,
  className,
  stopPropagation = false,
  showLabel = false,
  label = "واتساپ",
  size = "sm",
}: WhatsAppContactButtonProps) {
  const source =
    resolveWhatsAppContactSource(contact) ||
    (toUsablePhone(phone) ? String(phone).trim() : null);
  const href = buildWhatsAppChatUrl(source, message);
  const enabled = Boolean(href);
  const tooltip = enabled ? TOOLTIP_ACTIVE : TOOLTIP_MISSING;

  const handleActivate = (event: MouseEvent | KeyboardEvent) => {
    if (stopPropagation) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!enabled) {
      event.preventDefault();
      return;
    }
    openWhatsAppChat(source, message);
  };

  const dim = size === "md" ? "h-9 w-9" : "h-8 w-8";
  const iconDim = size === "md" ? "h-5 w-5" : "h-4 w-4";

  return (
    <span
      className={cn("inline-flex shrink-0", className)}
      title={tooltip}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      onKeyDown={stopPropagation ? (e) => e.stopPropagation() : undefined}
    >
      <button
        type="button"
        aria-disabled={!enabled}
        aria-label={tooltip}
        title={tooltip}
        tabIndex={enabled ? 0 : -1}
        onClick={handleActivate}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-md transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          enabled
            ? "bg-[#25D366]/12 text-[#128C7E] hover:bg-[#25D366]/20 hover:text-[#075E54] active:bg-[#25D366]/25"
            : "cursor-not-allowed bg-muted/60 text-muted-foreground opacity-55",
          showLabel ? "h-8 px-2.5 text-xs font-medium" : dim,
        )}
      >
        <WhatsAppGlyph className={iconDim} />
        {showLabel ? <span className="whitespace-nowrap">{label}</span> : null}
      </button>
    </span>
  );
}

function toUsablePhone(value: string | null | undefined): boolean {
  return Boolean(buildWhatsAppChatUrl(value));
}
