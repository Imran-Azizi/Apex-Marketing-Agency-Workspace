"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  disableWebPush,
  enableWebPush,
  getLocalWebPushStatus,
  isWebPushSupported,
  type WebPushStatus,
} from "@/lib/web-push-client";

type WebPushControlsProps = {
  className?: string;
  compact?: boolean;
};

export function WebPushControls({
  className,
  compact = false,
}: WebPushControlsProps) {
  const [status, setStatus] = useState<WebPushStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getLocalWebPushStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({
            configured: false,
            subscribed: false,
            deviceCount: 0,
            permission: isWebPushSupported()
              ? Notification.permission
              : "unsupported",
            unsupportedReason: "browser",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;

  if (status.permission === "unsupported") {
    const needsIosHomeScreen =
      status.unsupportedReason === "ios-home-screen-required";

    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border/70 bg-muted/30 px-3 py-2.5 text-[11px] leading-5 text-muted-foreground",
          className,
        )}
        dir="rtl"
      >
        {needsIosHomeScreen ? (
          <div className="space-y-2">
            <p className="font-medium text-foreground">
              روی آیفون، اعلان خارج از برنامه فقط از «اپ صفحه اصلی» فعال می‌شود
            </p>
            <ol className="list-decimal space-y-1 pe-4 text-muted-foreground">
              <li>
                سایت را در <span className="font-medium text-foreground">Safari</span>{" "}
                باز کنید (نه فقط تب Chrome)
              </li>
              <li>
                دکمه Share (مربع با فلش) →{" "}
                <span className="font-medium text-foreground">
                  Add to Home Screen
                </span>{" "}
                / افزودن به صفحه اصلی
              </li>
              <li>
                اپ را از آیکون صفحه اصلی باز کنید، وارد شوید، سپس اینجا اعلان را
                فعال کنید
              </li>
            </ol>
            <p className="text-[10px] leading-4 text-muted-foreground/90">
              نیاز به iOS ۱۶.۴ یا جدیدتر. Chrome روی آیفون از موتور Safari
              استفاده می‌کند و داخل تب مرورگر Push ندارد.
            </p>
          </div>
        ) : (
          <p>مرورگر فعلی از اعلان خارج از برنامه پشتیبانی نمی‌کند.</p>
        )}
      </div>
    );
  }

  if (!status.configured) {
    return (
      <p
        className={cn(
          "rounded-lg border border-dashed border-border/70 bg-muted/30 px-3 py-2 text-[11px] leading-5 text-muted-foreground",
          className,
        )}
      >
        اعلان خارج از برنامه روی سرور هنوز فعال نشده است. با مدیر سیستم هماهنگ
        کنید تا پیکربندی سرور تکمیل شود.
      </p>
    );
  }

  const enabled = status.subscribed && status.permission === "granted";

  async function handleEnable() {
    setBusy(true);
    try {
      const next = await enableWebPush();
      setStatus(next);
      toast.success("اعلان خارج از برنامه فعال شد");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فعال‌سازی ناموفق بود");
      const next = await getLocalWebPushStatus().catch(() => status);
      setStatus(next);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    try {
      const next = await disableWebPush();
      setStatus(next);
      toast.success("اعلان خارج از برنامه غیرفعال شد");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "غیرفعال‌سازی ناموفق بود");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-muted/20 p-3",
        className,
      )}
      dir="rtl"
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Smartphone className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">
            اعلان خارج از برنامه
          </p>
          {!compact ? (
            <p className="text-[11px] leading-5 text-muted-foreground">
              حتی وقتی سیستم باز نیست، اعلان‌ها نمایش داده می‌شوند. در{" "}
              <span className="font-medium text-foreground">
                اندروید / Chrome
              </span>{" "}
              همین‌جا فعال کنید (نیازی به صفحه اصلی نیست). در آیفون فقط از آیکون
              صفحه اصلی.
            </p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            وضعیت:{" "}
            <span className="font-medium text-foreground">
              {enabled
                ? status.deviceCount > 1
                  ? `فعال (${status.deviceCount} دستگاه)`
                  : "فعال"
                : status.permission === "denied"
                  ? "مسدود شده در مرورگر"
                  : "غیرفعال"}
            </span>
          </p>
          {status.permission === "denied" && !compact ? (
            <p className="text-[10px] leading-4 text-amber-700 dark:text-amber-400/90">
              در Chrome: قفل کنار آدرس → Permissions / Site settings →
              Notifications → Allow، بعد صفحه را رفرش کنید.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {enabled ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            disabled={busy}
            isLoading={busy}
            loadingText="…"
            onClick={() => void handleDisable()}
          >
            <BellOff className="h-3.5 w-3.5" />
            غیرفعال کردن
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="brand"
            className="h-8 gap-1.5 text-xs"
            disabled={busy || status.permission === "denied"}
            isLoading={busy}
            loadingText="…"
            onClick={() => void handleEnable()}
          >
            <BellRing className="h-3.5 w-3.5" />
            فعال‌سازی اعلان موبایل
          </Button>
        )}
      </div>
    </div>
  );
}
