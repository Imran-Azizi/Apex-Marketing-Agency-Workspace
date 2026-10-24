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
            permission: isWebPushSupported() ? Notification.permission : "unsupported",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;

  if (status.permission === "unsupported") {
    return (
      <p
        className={cn(
          "rounded-lg border border-dashed border-border/70 bg-muted/30 px-3 py-2 text-[11px] leading-5 text-muted-foreground",
          className,
        )}
      >
        مرورگر فعلی از اعلان خارج از برنامه پشتیبانی نمی‌کند.
      </p>
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
        اعلان موبایل روی سرور هنوز پیکربندی نشده است.
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
              حتی وقتی سیستم باز نیست، اعلان‌ها روی موبایل یا دسکتاپ نمایش داده
              می‌شوند. در آیفون، سایت را به صفحه اصلی اضافه کنید.
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
