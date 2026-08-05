"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Lock, Send, Shield } from "lucide-react";
import { apiPost } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface InviteEligibility {
  eligible: boolean;
  gates: Record<string, boolean>;
  hasExistingPortal: boolean;
}

const GATE_LABELS: Record<string, string> = {
  hasPhone: "شماره تماس مشتری ثبت نشده است.",
  hasFirstPayment: "بعد از ثبت اولین پرداخت مشتری فعال می‌شود",
};

function getInviteBlockMessage(gates?: Record<string, boolean>) {
  if (!gates) return "بعد از ثبت اولین پرداخت مشتری فعال می‌شود";
  if (gates.hasFirstPayment === false) {
    return GATE_LABELS.hasFirstPayment;
  }
  const missing = Object.entries(gates).find(([, valid]) => !valid)?.[0];
  return missing
    ? GATE_LABELS[missing] || "بعد از ثبت اولین پرداخت مشتری فعال می‌شود"
    : "بعد از ثبت اولین پرداخت مشتری فعال می‌شود";
}

interface PortalInviteSectionProps {
  opportunityId: string;
  eligibility: InviteEligibility | undefined;
  inviteUrl: string;
  onInviteUrlChange: (url: string) => void;
  onChanged: () => void;
}

export function PortalInviteSection({
  opportunityId,
  eligibility,
  inviteUrl,
  onInviteUrlChange,
  onChanged,
}: PortalInviteSectionProps) {
  const isEligible = !!eligibility?.eligible;
  const waitingForPayment = eligibility?.gates?.hasFirstPayment === false;

  const inviteMut = useMutation({
    mutationFn: () =>
      apiPost<{ registerUrl: string }>(
        `/crm/opportunities/${opportunityId}/portal-invite`,
      ),
    onSuccess: (res) => {
      onInviteUrlChange(res.registerUrl);
      toast.success("دعوت ساخته شد");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا"),
  });

  return (
    <div
      dir="rtl"
      className={cn(
        "relative overflow-hidden rounded-2xl border shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300",
        isEligible
          ? "border-brand/30 bg-gradient-to-bl from-brand/[0.09] via-brand/[0.04] to-card"
          : "border-border/50 bg-muted/10",
      )}
    >
      <div
        className="absolute -start-10 -top-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl"
        aria-hidden
      />
      <div className="relative p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3.5">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1",
                isEligible
                  ? "bg-brand/15 text-brand ring-brand/15"
                  : "bg-muted text-muted-foreground ring-border/50",
              )}
            >
              {isEligible ? (
                <Send className="h-5 w-5" />
              ) : (
                <Lock className="h-5 w-5" />
              )}
            </div>
            <div className="text-start">
              <h4 className="text-lg font-bold">دعوت پورتال مشتری</h4>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
                دسترسی امن مشتری برای ثبت سفارش، پیگیری پروژه و مشاهده وضعیت
                پرداخت‌ها
              </p>
              <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5 text-brand" />
                لینک اختصاصی و امن برای هر مشتری
              </div>
            </div>
          </div>

          <div className="w-full shrink-0 lg:w-auto">
            <span
              className="inline-flex w-full lg:w-auto"
              title={
                !isEligible
                  ? getInviteBlockMessage(eligibility?.gates)
                  : undefined
              }
            >
              <Button
                variant="brand"
                size="lg"
                className={cn(
                  "w-full rounded-xl transition-all lg:w-auto",
                  isEligible
                    ? "shadow-md shadow-brand/25 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                    : "pointer-events-none cursor-not-allowed opacity-60 grayscale",
                )}
                disabled={!isEligible || inviteMut.isPending}
                onClick={() => inviteMut.mutate()}
              >
                {isEligible ? (
                  <ExternalLink className="h-4 w-4" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                {inviteMut.isPending
                  ? "در حال ساخت دعوت..."
                  : isEligible
                    ? "ایجاد دعوت پورتال"
                    : "دعوت غیرفعال"}
              </Button>
            </span>
          </div>
        </div>

        {eligibility && !isEligible && (
          <div
            className={cn(
              "mt-5 flex items-start gap-2.5 rounded-xl border px-4 py-3.5 text-sm",
              waitingForPayment
                ? "border-amber-200/80 bg-amber-50/90 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
                : "border-border/60 bg-muted/40 text-muted-foreground",
            )}
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200/80 text-xs font-bold dark:bg-amber-500/30">
              !
            </span>
            <p className="text-start leading-relaxed">
              {getInviteBlockMessage(eligibility.gates)}
            </p>
          </div>
        )}

        {isEligible && !inviteUrl && (
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            <Check className="h-4 w-4 shrink-0" />
            <p className="text-start">
              اولین پرداخت ثبت شده است — دعوت پورتال آماده ارسال است.
            </p>
          </div>
        )}

        {inviteUrl && (
          <div className="mt-5 space-y-2 border-t border-brand/15 pt-5">
            <Label className="text-sm font-medium">لینک ثبت‌نام مشتری</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                dir="ltr"
                readOnly
                value={inviteUrl}
                className="rounded-xl bg-background/80 font-mono text-sm text-start shadow-sm"
              />
              <Button
                variant="outline"
                className="shrink-0 rounded-xl sm:w-auto"
                aria-label="کپی لینک دعوت"
                onClick={() => {
                  navigator.clipboard.writeText(inviteUrl);
                  toast.success("لینک کپی شد");
                }}
              >
                <Copy className="h-4 w-4" />
                کپی لینک
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
