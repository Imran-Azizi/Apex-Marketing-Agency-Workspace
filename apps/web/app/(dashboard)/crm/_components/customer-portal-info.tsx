"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { formatPhoneDisplay } from "@/lib/utils";
import type { PortalCredentials } from "@/lib/portal-invites";
import { PortalPasswordReveal } from "@/components/crm/portal-password-reveal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function copyText(value: string, success: string) {
  navigator.clipboard.writeText(value).then(
    () => toast.success(success),
    () => toast.error("کپی ناموفق بود"),
  );
}

function WhatsAppField({
  value,
  compact,
}: {
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span
        dir="ltr"
        className="min-w-0 truncate font-mono text-sm tabular-nums"
        title={value}
      >
        {formatPhoneDisplay(value)}
      </span>
      {!compact ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="کپی شماره واتساپ"
          onClick={() => copyText(value, "شماره واتساپ کپی شد")}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

/** Portal WhatsApp + password fields for the invite tab after registration. */
export function CustomerPortalCredentialsFields({
  customerId,
  credentials,
  compact,
}: {
  customerId: string;
  credentials: PortalCredentials;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "space-y-1"
          : "grid gap-4 sm:grid-cols-2"
      }
    >
      <div className="space-y-1.5">
        {!compact ? (
          <Label className="text-sm font-medium">شماره واتساپ</Label>
        ) : null}
        <WhatsAppField
          value={credentials.whatsappNumber || ""}
          compact={compact}
        />
      </div>
      <div className="space-y-1.5">
        {!compact ? (
          <Label className="text-sm font-medium">رمز عبور پورتال</Label>
        ) : null}
        <PortalPasswordReveal
          customerId={customerId}
          hasPassword={credentials.hasPassword}
          canReveal={credentials.canRevealPassword}
          compact={compact}
        />
      </div>
    </div>
  );
}
