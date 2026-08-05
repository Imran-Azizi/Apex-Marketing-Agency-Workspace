"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ComponentType } from "react";
import {
  Briefcase,
  Building2,
  Mail,
  MapPin,
  Phone,
  UserRound,
  Palette,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { formatPhoneDisplay, cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/layout/theme-toggle";

interface PortalProfile {
  id: string;
  personName: string;
  companyName: string | null;
  jobTitle: string | null;
  phone: string | null;
  normalizedWhatsapp: string;
  email: string | null;
  city: string | null;
  address: string | null;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "؟";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function ProfileField({
  icon: Icon,
  label,
  value,
  ltr,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
  ltr?: boolean;
  className?: string;
}) {
  if (!value?.trim()) return null;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border border-border/70 bg-muted/20 p-3.5 text-start",
        className,
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-semibold leading-relaxed">
          {ltr ? (
            <bdi dir="ltr" className="inline-block max-w-full">
              {value}
            </bdi>
          ) : (
            value
          )}
        </p>
      </div>
    </div>
  );
}

export default function PortalProfilePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-profile"],
    queryFn: () => apiGet<PortalProfile>("/portal/profile"),
  });

  if (isLoading) {
    return (
      <div dir="rtl" className="space-y-4 text-start">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div dir="rtl" className="text-start">
        <EmptyState title="بارگذاری پروفایل ناموفق بود" />
      </div>
    );
  }

  const phoneDisplay = data.phone
    ? formatPhoneDisplay(data.phone)
    : null;
  const whatsappDisplay = formatPhoneDisplay(data.normalizedWhatsapp);

  return (
    <div dir="rtl" className="mx-auto max-w-4xl space-y-6 text-start">
      <PageHeader
        title="پروفایل"
        subtitle="اطلاعات حساب و مشخصات تماس شما در پورتال مشتری"
      />

      <Card className="overflow-hidden shadow-sm">
        <div className="border-b bg-gradient-to-l from-brand/10 via-brand/5 to-transparent px-5 py-6 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand text-lg font-bold text-brand-foreground shadow-sm">
              {initials(data.personName)}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">
                  {data.personName}
                </h2>
                <Badge variant="secondary">حساب مشتری</Badge>
              </div>
              {data.companyName && (
                <p className="text-sm text-muted-foreground">
                  {data.companyName}
                </p>
              )}
              {data.jobTitle && (
                <p className="text-xs text-muted-foreground">
                  {data.jobTitle}
                </p>
              )}
            </div>
          </div>
        </div>

        <CardHeader className="pb-2">
          <CardTitle className="text-base">اطلاعات تماس</CardTitle>
          <CardDescription>
            این اطلاعات از پرونده مشتری شما در سیستم گرفته شده است.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pb-6 sm:grid-cols-2">
          <ProfileField
            icon={UserRound}
            label="نام کامل"
            value={data.personName}
          />
          <ProfileField
            icon={Briefcase}
            label="سمت شغلی"
            value={data.jobTitle}
          />
          <ProfileField
            icon={Building2}
            label="شرکت / برند"
            value={data.companyName}
          />
          <ProfileField
            icon={Phone}
            label="واتساپ"
            value={whatsappDisplay || data.normalizedWhatsapp}
            ltr
          />
          <ProfileField
            icon={Phone}
            label="شماره تماس"
            value={phoneDisplay || data.phone}
            ltr
          />
          <ProfileField
            icon={Mail}
            label="ایمیل"
            value={data.email}
            ltr
          />
          <ProfileField icon={MapPin} label="شهر" value={data.city} />
          <ProfileField
            icon={MapPin}
            label="آدرس"
            value={data.address}
            className="sm:col-span-2"
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Palette className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">ظاهر برنامه</CardTitle>
              <CardDescription>
                تم روشن، تاریک یا مطابق سیستم‌عامل
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ThemeToggle variant="panel" />
        </CardContent>
      </Card>
    </div>
  );
}
