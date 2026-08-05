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

  if (compact) {
    return (
      <Card
        dir="rtl"
        className="overflow-hidden border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
      >
        <div className="h-1.5 bg-gradient-to-l from-brand via-brand to-brand/70" />
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div
                className={cn(
                  "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
                  "bg-gradient-to-bl from-brand to-brand/75 text-base font-bold text-white",
                  "shadow-lg shadow-brand/20 ring-4 ring-brand/10",
                )}
                aria-hidden
              >
                {initials}
              </div>
              <div className="min-w-0 text-start">
                <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                  {personName}
                </h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground sm:text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-brand/70" />
                    <span className="truncate font-medium text-foreground/80">
                      {companyName || "بدون نام شرکت"}
                    </span>
                  </span>
                  {jobTitle && (
                    <>
                      <span className="text-border">|</span>
                      <span className="truncate">{jobTitle}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {hasValidWhatsapp && (
                <Button
                  type="button"
                  variant="brand"
                  size="sm"
                  onClick={onWhatsAppClick}
                  className="shadow-sm shadow-brand/20"
                >
                  <Phone className="h-3.5 w-3.5" />
                  واتساپ
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                asChild
                className="border-border/70 bg-background"
              >
                <Link href="/crm">
                  <ArrowRight className="h-3.5 w-3.5" />
                  بازگشت
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 border-t border-border/40 pt-4 sm:grid-cols-2 lg:grid-cols-5">
            <MetaChip
              icon={Phone}
              label="تماس"
              value={
                displayPhone ? formatPhoneDisplay(displayPhone) : "بدون شماره"
              }
              dir="ltr"
            />
            <MetaChip
              icon={Mail}
              label="ایمیل"
              value={email || "ثبت نشده"}
              dir="ltr"
            />
            <MetaChip icon={MapPin} label="موقعیت" value={city || "ثبت نشده"} />
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
    <div className="flex items-center gap-2.5 rounded-xl border border-border/40 bg-muted/30 px-3 py-2.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-brand" />
      <div className="min-w-0 text-start">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p
          dir={dir || "rtl"}
          className={cn(
            "truncate text-xs font-semibold",
            dir === "ltr" && "tabular-nums [unicode-bidi:isolate]",
          )}
        >
          {value}
        </p>
      </div>
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
