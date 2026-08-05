"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDurationLabel } from "@/lib/upload";
import { cn, formatPhoneDisplay } from "@/lib/utils";
import { Building2, Clapperboard, Megaphone, ShieldCheck } from "lucide-react";

type BriefData = Record<string, unknown>;

/** Keep Latin/email/URL character order without flipping the RTL cell alignment. */
function MixedValue({
  value,
  ltr,
  className,
}: {
  value: string;
  ltr?: boolean;
  className?: string;
}) {
  if (!ltr) {
    return <span className={cn("break-words", className)}>{value}</span>;
  }
  return (
    <bdi dir="ltr" className={cn("inline-block max-w-full break-words", className)}>
      {value}
    </bdi>
  );
}

function InfoItem({
  label,
  value,
  ltr,
  className,
}: {
  label: string;
  value?: string | null;
  ltr?: boolean;
  className?: string;
}) {
  if (!value?.trim()) return null;
  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-background/80 px-3.5 py-3 text-start shadow-[0_1px_0_rgba(0,0,0,0.02)]",
        className,
      )}
    >
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-sm font-medium leading-relaxed text-foreground">
        <MixedValue value={value} ltr={ltr} />
      </p>
    </div>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/80 px-3.5 py-3 text-start shadow-[0_1px_0_rgba(0,0,0,0.02)] sm:col-span-2">
      <p className="text-[11px] font-semibold text-muted-foreground">
        ویژگی‌ها و مزایا
      </p>
      <ul className="mt-2.5 space-y-2">
        {items.map((item, index) => (
          <li key={`${index}-${item.slice(0, 24)}`} className="flex gap-2.5 text-start">
            <span
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
              aria-hidden
            />
            <span className="min-w-0 flex-1 break-all text-sm font-medium leading-relaxed">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlatformList({ items }: { items: string[] }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/80 px-3.5 py-3 text-start shadow-[0_1px_0_rgba(0,0,0,0.02)] sm:col-span-2">
      <p className="text-[11px] font-semibold text-muted-foreground">پلتفرم‌ها</p>
      <div className="mt-2.5 flex flex-wrap justify-start gap-2">
        {items.map((item) => (
          <Badge key={item} variant="secondary" className="rounded-md px-2.5 py-1 text-xs font-medium">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function PortalProjectBriefView({
  brief,
  durationSec,
  language,
  tone,
  platforms,
  format,
  customAspectRatio,
}: {
  brief: BriefData;
  durationSec?: number | null;
  language?: string | null;
  tone?: string | null;
  platforms?: string[];
  format?: { name: string; ratio: string } | null;
  customAspectRatio?: string | null;
}) {
  const phoneRaw = String(brief.phone || "");
  const phoneDisplay = phoneRaw ? formatPhoneDisplay(phoneRaw) : "";
  const features = Array.isArray(brief.features)
    ? (brief.features as string[]).filter(Boolean)
    : [];
  const aspectValue = customAspectRatio
    ? customAspectRatio
    : format
      ? `${format.name} (${format.ratio})`
      : "";

  const languageLabel =
    language === "fa"
      ? "فارسی / دری"
      : language === "ps"
        ? "پشتو"
        : language === "en"
          ? "انگلیسی"
          : language || "";

  return (
    <div dir="rtl" className="space-y-5 text-start">
      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-b bg-gradient-to-b from-muted/40 to-background pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand">
              <Building2 className="h-4 w-4" />
            </span>
            اطلاعات تماس
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          <InfoItem label="نام سفارش‌دهنده" value={String(brief.personName || "")} />
          <InfoItem label="سمت شغلی" value={String(brief.jobTitle || "")} />
          <InfoItem label="نام شرکت / برند" value={String(brief.companyName || "")} />
          <InfoItem label="شماره تماس" value={phoneDisplay || phoneRaw} ltr />
          <InfoItem label="ایمیل" value={String(brief.email || "")} ltr />
          <InfoItem label="وب‌سایت" value={String(brief.website || "")} ltr />
          <InfoItem
            label="آدرس"
            value={String(brief.address || "")}
            className="sm:col-span-2"
          />
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-b bg-gradient-to-b from-muted/40 to-background pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand">
              <Megaphone className="h-4 w-4" />
            </span>
            محتوای تبلیغ
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          <InfoItem
            label="نام محصول / خدمت"
            value={String(brief.productName || "")}
          />
          <InfoItem
            label="توضیح کوتاه"
            value={String(brief.productDescription || "")}
            className="sm:col-span-2"
          />
          {features.length > 0 && <FeatureList items={features} />}
          <InfoItem label="مخاطب هدف" value={String(brief.audience || "")} />
          <InfoItem label="هدف تبلیغ" value={String(brief.goal || "")} />
          <InfoItem
            label="پیام اصلی تبلیغ"
            value={String(brief.mainMessage || "")}
          />
          <InfoItem
            label="دعوت به اقدام (CTA)"
            value={String(brief.cta || "")}
          />
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-b bg-gradient-to-b from-muted/40 to-background pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand">
              <Clapperboard className="h-4 w-4" />
            </span>
            مشخصات ویدیو
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          <InfoItem
            label="مدت ویدیو"
            value={durationSec ? formatDurationLabel(durationSec) : undefined}
          />
          <InfoItem
            label="نسبت تصویر"
            value={aspectValue || undefined}
          />
          <InfoItem label="زبان ویدیو" value={languageLabel || undefined} />
          <InfoItem label="لحن ویدیو" value={tone || undefined} />
          {platforms && platforms.length > 0 && (
            <PlatformList items={platforms} />
          )}
        </CardContent>
      </Card>

      {Boolean(brief.allowedClaims || brief.mandatoryTexts || brief.brandLimits) && (
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <CardHeader className="border-b bg-gradient-to-b from-muted/40 to-background pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand">
                <ShieldCheck className="h-4 w-4" />
              </span>
              الزامات برند
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 sm:p-5">
            <InfoItem
              label="ادعاهای مجاز"
              value={String(brief.allowedClaims || "")}
            />
            <InfoItem
              label="متون اجباری"
              value={String(brief.mandatoryTexts || "")}
            />
            <InfoItem
              label="محدودیت‌های برند"
              value={String(brief.brandLimits || "")}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
