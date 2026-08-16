"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  FileText,
  Mail,
  MapPin,
  Megaphone,
  Phone,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPhoneDisplay, cn } from "@/lib/utils";
import { formatLeadSource } from "./constants";
import { CrmInfoTile } from "./crm-ui";

interface CustomerProfileHeaderProps {
  personName: string;
  companyName: string | null;
  jobTitle: string | null;
  displayPhone: string | null;
  email: string | null;
  city: string | null;
  source: string | null;
  salesOwnerName: string | null;
  hasValidWhatsapp: boolean;
  onWhatsAppClick: () => void;
  compact?: boolean;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[parts.length - 1][0]}`;
}

export function CustomerProfileHeader({
  personName,
  companyName,
  jobTitle,
  displayPhone,
  email,
  city,
  source,
  salesOwnerName,
  hasValidWhatsapp,
  onWhatsAppClick,
  compact = false,
}: CustomerProfileHeaderProps) {
  const initials = getInitials(personName);
  const metaLine = [companyName, jobTitle].filter(Boolean).join(" | ");

  if (compact) {
    return (
      <Card
        dir="rtl"
        className="overflow-hidden border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
      >
        <div className="h-1.5 bg-gradient-to-l from-brand via-brand to-brand/70" />
        <CardContent className="p-3 sm:p-5">
          {/* Identity + actions: always one professional row */}
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-4">
              <div
                className={cn(
                  "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:h-14 sm:w-14 sm:rounded-2xl",
                  "bg-gradient-to-bl from-brand to-brand/75 text-sm font-bold text-brand-foreground sm:text-base",
                  "shadow-lg shadow-brand/20 ring-2 ring-brand/10 sm:ring-4",
                )}
                aria-hidden
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1 text-start">
                <h1 className="truncate text-base font-bold tracking-tight sm:text-2xl">
                  {personName}
                </h1>
                {metaLine ? (
                  <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground sm:mt-1 sm:text-sm">
                    <Building2 className="h-3 w-3 shrink-0 text-brand/70 sm:h-3.5 sm:w-3.5" />
                    <span className="truncate font-medium text-foreground/80">
                      {metaLine}
                    </span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {hasValidWhatsapp && (
                <Button
                  type="button"
                  variant="brand"
                  size="sm"
                  onClick={onWhatsAppClick}
                  className="h-8 gap-1 px-2.5 text-xs shadow-sm shadow-brand/20 sm:h-9 sm:gap-1.5 sm:px-3 sm:text-sm"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span className="whitespace-nowrap">واتساپ</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-8 gap-1 border-border/70 bg-background px-2.5 text-xs sm:h-9 sm:gap-1.5 sm:px-3 sm:text-sm"
              >
                <Link href="/crm">
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span className="whitespace-nowrap">بازگشت</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* Meta fields: one-row tabular chips */}
          <div className="mt-3 border-t border-border/40 pt-3 sm:mt-4 sm:pt-4">
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2 lg:grid-cols-5">
              <MetaChip
                icon={Phone}
                label="تماس"
                value={
                  displayPhone
                    ? formatPhoneDisplay(displayPhone)
                    : "بدون شماره"
                }
                dir="ltr"
              />
              <MetaChip
                icon={Mail}
                label="ایمیل"
                value={email || "ثبت نشده"}
                dir="ltr"
              />
              <MetaChip
                icon={MapPin}
                label="موقعیت"
                value={city || "ثبت نشده"}
              />
              <MetaChip
                icon={UserRound}
                label="مسئول"
                value={salesOwnerName || "تعیین نشده"}
              />
              <MetaChip
                icon={Megaphone}
                label="منبع"
                value={source ? formatLeadSource(source) : "ثبت نشده"}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

function MetaChip({
  icon: Icon,
  label,
  value,
  dir,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div
      className="flex min-h-10 items-center gap-2.5 rounded-xl border border-border/40 bg-muted/30 px-3 py-2"
      role="group"
      aria-label={`${label}: ${value}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
      <span className="shrink-0 text-[11px] font-medium text-muted-foreground sm:w-14 sm:text-xs">
        {label}
      </span>
      <span
        dir={dir || "rtl"}
        className={cn(
          "min-w-0 flex-1 truncate text-end text-xs font-semibold text-foreground sm:text-sm",
          dir === "ltr" && "tabular-nums tracking-wide [unicode-bidi:isolate]",
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

/** Full profile details for the Profile tab */
export function CustomerProfileDetails({
  displayPhone,
  email,
  city,
  source,
  salesOwnerName,
  address,
  notes,
  hasValidWhatsapp,
  onWhatsAppClick,
}: {
  displayPhone: string | null;
  email: string | null;
  city: string | null;
  source: string | null;
  salesOwnerName: string | null;
  address: string | null;
  notes: string | null;
  hasValidWhatsapp: boolean;
  onWhatsAppClick: () => void;
}) {
  return (
    <div dir="rtl" className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CrmInfoTile
          icon={Phone}
          label="شماره تماس"
          value={displayPhone ? formatPhoneDisplay(displayPhone) : "ثبت نشده"}
          dir="ltr"
          onClick={hasValidWhatsapp ? onWhatsAppClick : undefined}
          disabled={!hasValidWhatsapp}
          hint={
            !hasValidWhatsapp
              ? "شماره تماس معتبر برای این مشتری موجود نیست."
              : undefined
          }
        />
        <CrmInfoTile
          icon={Mail}
          label="ایمیل"
          value={email || "ثبت نشده"}
          dir="ltr"
        />
        <CrmInfoTile icon={MapPin} label="موقعیت" value={city || "ثبت نشده"} />
        <CrmInfoTile
          icon={UserRound}
          label="مسئول فروش"
          value={salesOwnerName || "تعیین نشده"}
        />
        <CrmInfoTile
          icon={Megaphone}
          label="منبع ورود"
          value={source ? formatLeadSource(source) : "ثبت نشده"}
        />
        {(address || notes) && (
          <CrmInfoTile
            icon={FileText}
            label="یادداشت / آدرس"
            value={notes ? "دارای یادداشت" : address || "—"}
            className="sm:col-span-2 lg:col-span-1"
          />
        )}
      </div>

      {(address || notes) && (
        <div className="grid gap-3 md:grid-cols-2">
          {address && (
            <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-muted/20 p-4 shadow-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0 text-start">
                <p className="text-xs font-medium text-muted-foreground">آدرس</p>
                <p className="mt-1 text-sm leading-relaxed">{address}</p>
              </div>
            </div>
          )}
          {notes && (
            <div
              className={cn(
                "flex items-start gap-3 rounded-2xl border border-border/50 bg-muted/20 p-4 shadow-sm",
                !address && "md:col-span-2",
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 text-start">
                <p className="text-xs font-medium text-muted-foreground">
                  یادداشت
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                  {notes}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
