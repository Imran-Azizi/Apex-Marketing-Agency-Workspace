"use client";

import { useCallback, useState, type MouseEvent } from "react";
import { Copy, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiPost, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RevealPasswordResponse {
  employeeId: string;
  email: string;
  password: string;
}

function copyText(value: string, success: string) {
  return navigator.clipboard.writeText(value).then(
    () => toast.success(success),
    () => toast.error("کپی ناموفق بود"),
  );
}

function CredentialCopyButton({
  label,
  disabled,
  compact,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      disabled={disabled}
      className={cn("shrink-0 rounded-xl", compact ? "h-8 w-8" : "h-9 w-9")}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Copy className="h-3.5 w-3.5" />
    </Button>
  );
}

export function EmployeeLoginCredentialsFields({
  employeeId,
  email,
  hasPasswordCipher,
  compact,
  className,
}: {
  employeeId: string;
  email: string;
  hasPasswordCipher: boolean;
  compact?: boolean;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPassword = useCallback(async () => {
    if (password) return password;
    if (!hasPasswordCipher) return null;
    setLoading(true);
    try {
      const res = await apiPost<RevealPasswordResponse>(
        `/employees/${employeeId}/reveal-password`,
      );
      setPassword(res.password);
      return res.password;
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "بازیابی رمز عبور ناموفق بود",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, [employeeId, hasPasswordCipher, password]);

  const toggleVisibility = async (e: MouseEvent) => {
    e.stopPropagation();
    if (visible) {
      setVisible(false);
      return;
    }
    const secret = await loadPassword();
    if (secret) setVisible(true);
  };

  const copyEmail = () => {
    if (!email) return;
    void copyText(email, "ایمیل کپی شد");
  };

  const copyPassword = async () => {
    const secret = await loadPassword();
    if (!secret) return;
    await copyText(secret, "رمز عبور کپی شد");
  };

  return (
    <div
      className={cn(
        compact ? "space-y-2" : "grid gap-4 sm:grid-cols-2",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="space-y-1.5">
        {!compact ? (
          <Label className="text-sm font-medium">ایمیل ورود</Label>
        ) : (
          <p className="text-[11px] text-muted-foreground">ایمیل</p>
        )}
        <div className="flex min-w-0 items-center gap-1.5">
          <Input
            readOnly
            dir="ltr"
            autoComplete="off"
            normalizeDigits={false}
            value={email}
            className={cn(
              "rounded-xl bg-background/80 font-mono text-sm text-start",
              compact ? "h-8" : "h-9",
            )}
            aria-label="ایمیل ورود کارمند"
          />
          <CredentialCopyButton
            label="کپی ایمیل"
            compact={compact}
            disabled={!email}
            onClick={copyEmail}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        {!compact ? (
          <Label className="text-sm font-medium">رمز عبور</Label>
        ) : (
          <p className="text-[11px] text-muted-foreground">رمز عبور</p>
        )}
        {!hasPasswordCipher ? (
          <p className="text-xs leading-5 text-muted-foreground">
            رمز قابل نمایش موجود نیست. پس از بازنشانی رمز توسط مدیر، اینجا نمایش
            داده می‌شود.
          </p>
        ) : (
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="relative min-w-0 flex-1">
              <Input
                readOnly
                dir="ltr"
                autoComplete="off"
                normalizeDigits={false}
                type={visible ? "text" : "password"}
                value={visible && password ? password : "••••••••"}
                className={cn(
                  "rounded-xl bg-background/80 pr-10 font-mono text-sm text-start",
                  compact ? "h-8" : "h-9",
                )}
                aria-label="رمز عبور ورود کارمند"
              />
              <button
                type="button"
                onClick={(e) => void toggleVisibility(e)}
                disabled={loading}
                aria-label={visible ? "مخفی کردن رمز عبور" : "نمایش رمز عبور"}
                title={visible ? "مخفی کردن رمز عبور" : "نمایش رمز عبور"}
                className={cn(
                  "absolute inset-y-0 right-0 z-10 inline-flex w-9 items-center justify-center rounded-r-xl text-muted-foreground transition-colors",
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
            <CredentialCopyButton
              label="کپی رمز عبور"
              compact={compact}
              disabled={loading}
              onClick={() => void copyPassword()}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function EmployeeLoginCredentialsCard({
  employeeId,
  email,
  hasPasswordCipher,
}: {
  employeeId: string;
  email: string;
  hasPasswordCipher: boolean;
}) {
  return (
    <Card className="overflow-hidden border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <CardContent className="p-0" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <KeyRound className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold sm:text-base">
                اطلاعات ورود
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                ایمیل و رمز عبور ورود به سیستم
              </p>
            </div>
          </div>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <EmployeeLoginCredentialsFields
            employeeId={employeeId}
            email={email}
            hasPasswordCipher={hasPasswordCipher}
          />
        </div>
      </CardContent>
    </Card>
  );
}
