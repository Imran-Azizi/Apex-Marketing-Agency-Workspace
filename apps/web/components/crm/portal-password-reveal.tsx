"use client";

import { useState } from "react";
import { Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { PortalPasswordRevealResponse } from "@/lib/portal-invites";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function PortalPasswordReveal({
  customerId,
  hasPassword,
  canReveal,
  compact,
  className,
}: {
  customerId: string;
  hasPassword: boolean;
  canReveal: boolean;
  compact?: boolean;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clearSecret = () => {
    setVisible(false);
    setPassword(null);
  };

  const toggle = async () => {
    if (visible) {
      clearSecret();
      return;
    }
    if (!canReveal || !hasPassword) return;
    setLoading(true);
    try {
      const res = await apiPost<PortalPasswordRevealResponse>(
        `/crm/customers/${customerId}/reveal-portal-password`,
      );
      setPassword(res.password);
      setVisible(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "بازیابی رمز عبور ناموفق بود",
      );
    } finally {
      setLoading(false);
    }
  };

  const copyPassword = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      toast.success("رمز عبور کپی شد");
    } catch {
      toast.error("کپی رمز عبور ناموفق بود");
    }
  };

  if (!hasPassword) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        رمز ذخیره‌شده موجود نیست
      </p>
    );
  }

  if (!canReveal) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        فقط مدیر مجاز است
      </p>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <div className="relative min-w-0 flex-1">
        <Input
          readOnly
          dir="ltr"
          autoComplete="off"
          normalizeDigits={false}
          type={visible ? "text" : "password"}
          value={visible && password ? password : "••••••••"}
          className={cn(
            "rounded-xl bg-background/80 pe-10 font-mono text-sm text-start",
            compact ? "h-8" : "h-9",
          )}
          aria-label="رمز عبور پورتال"
        />
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={loading}
          aria-label={visible ? "مخفی کردن رمز عبور" : "نمایش رمز عبور"}
          title={visible ? "مخفی کردن رمز عبور" : "نمایش رمز عبور"}
          className={cn(
            "absolute inset-y-0 end-0 z-10 inline-flex w-9 items-center justify-center rounded-e-xl text-muted-foreground transition-colors",
            "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : visible ? (
            <EyeOff className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Eye className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      </div>
      {visible && password ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "shrink-0 rounded-xl",
            compact ? "h-8 w-8" : "h-9 w-9",
          )}
          aria-label="کپی رمز عبور"
          onClick={() => void copyPassword()}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
