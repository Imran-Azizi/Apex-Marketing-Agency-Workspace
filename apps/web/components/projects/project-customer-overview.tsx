"use client";

import { useMemo, type ReactNode } from "react";
import {
  Building2,
  Clapperboard,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  PortalProjectAssets,
  type PortalProjectAsset,
} from "@/components/portal/portal-project-assets";
import { formatDurationLabel } from "@/lib/upload";
import {
  cn,
  formatPhoneDisplay,
} from "@/lib/utils";

const EMPTY = "ارائه نشده";

const PLATFORM_LABELS: Record<string, string> = {
  Facebook: "فیسبوک",
  Instagram: "اینستاگرام",
  TikTok: "تیک‌تاک",
  YouTube: "یوتیوب",
  Other: "سایر",
};

const LANGUAGE_LABELS: Record<string, string> = {
  fa: "فارسی / دری",
  ps: "پشتو",
  en: "انگلیسی",
};

export type ProjectInfoTabId =
  | "customer"
  | "brief"
  | "assets";

export type ProjectCustomerOverviewData = {
  id: string;
  code: string;
  title: string;
  status: string;
  customerFacingStatus: string;
  createdAt?: string | null;
  deadlineAt: string | null;
  completedAt?: string | null;
  language: string | null;
  tone: string | null;
  durationSec: number | null;
  platforms?: unknown;
  brief: Record<string, unknown> | null;
  holdReason?: string | null;
  service?: { id: string; name: string } | null;
  format?: { id: string; name: string; ratio: string } | null;
  crmCustomer: {
    id?: string;
    personName: string;
    companyName: string | null;
    jobTitle?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    normalizedWhatsapp?: string | null;
    whatsappRaw?: string | null;
    notes?: string | null;
  };
  assignments?: Array<{
    role: string;
    teamProfile?: { displayName: string } | null;
  }>;
  assets?: PortalProjectAsset[];
};

function asString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

const KNOWN_BRIEF_KEYS = new Set([
  "personName",
  "jobTitle",
  "companyName",
  "phone",
  "email",
  "website",
  "address",
  "city",
  "productName",
  "productDescription",
  "features",
  "audience",
  "goal",
  "mainMessage",
  "cta",
  "tone",
  "language",
  "durationSec",
  "aspectRatio",
  "customAspectRatio",
  "platforms",
  "allowedClaims",
  "mandatoryTexts",
  "brandLimits",
  "notes",
  "narratorProfileId",
  "formatId",
  "serviceId",
]);

const BRIEF_KEY_LABELS: Record<string, string> = {
  personName: "نام",
  jobTitle: "سمت",
  companyName: "شرکت / سازمان",
  phone: "تلفن",
  email: "ایمیل",
  website: "وب‌سایت",
  address: "آدرس",
  city: "شهر",
  productName: "نام محصول / خدمت",
  productDescription: "توضیح کوتاه",
  features: "ویژگی‌ها و مزایا",
  audience: "مخاطب هدف",
  goal: "هدف تبلیغ",
  mainMessage: "پیام اصلی",
  cta: "CTA",
  tone: "لحن برند",
  language: "زبان",
  durationSec: "مدت ویدیو",
  aspectRatio: "نسبت تصویر",
  customAspectRatio: "نسبت تصویر سفارشی",
  platforms: "پلتفرم‌ها",
  allowedClaims: "ادعاهای مجاز",
  mandatoryTexts: "متون اجباری",
  brandLimits: "محدودیت‌های برند",
  notes: "یادداشت‌ها",
};

function humanizeBriefKey(key: string): string {
  return BRIEF_KEY_LABELS[key] || key;
}

function formatBriefExtraValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return asString(value);
  }
  if (Array.isArray(value)) {
    return asStringList(value).join("، ");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "";
    }
  }
  return "";
}

function collectExtraBriefFields(brief: Record<string, unknown>) {
  return Object.entries(brief)
    .filter(([key, value]) => {
      if (KNOWN_BRIEF_KEYS.has(key)) return false;
      if (key.endsWith("Id") || key.endsWith("Ids")) return false;
      if (value == null) return false;
      if (typeof value === "string" && !value.trim()) return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    })
    .map(([key, value]) => ({
      key,
      label: humanizeBriefKey(key),
      value: formatBriefExtraValue(value),
      ltr: key.toLowerCase().includes("url") || key.toLowerCase().includes("email") || key.toLowerCase().includes("phone") || key.toLowerCase().includes("website"),
      wide: true,
    }))
    .filter((item) => item.value);
}

function MixedValue({
  value,
  ltr,
  empty,
}: {
  value: string;
  ltr?: boolean;
  empty?: boolean;
}) {
  if (empty) return <span className="text-muted-foreground">{EMPTY}</span>;
  if (!ltr) return <span className="break-words">{value}</span>;
  return (
    <bdi dir="ltr" className="inline-block max-w-full break-words">
      {value}
    </bdi>
  );
}

function FieldTile({
  label,
  value,
  ltr,
  wide,
}: {
  label: string;
  value?: string | null;
  ltr?: boolean;
  wide?: boolean;
}) {
  const trimmed = value?.trim() || "";
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-background/80 px-3.5 py-3 text-start shadow-sm",
        wide && "sm:col-span-2",
      )}
    >
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-sm font-medium leading-relaxed">
        <MixedValue value={trimmed} ltr={ltr} empty={!trimmed} />
      </p>
    </div>
  );
}

function TagList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/80 px-3.5 py-3 text-start shadow-sm sm:col-span-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {items.length === 0 ? (
        <p className="mt-1.5 text-sm text-muted-foreground">{EMPTY}</p>
      ) : (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="rounded-lg border bg-muted/40 px-2.5 py-1 text-xs font-medium"
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BulletList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/80 px-3.5 py-3 text-start shadow-sm sm:col-span-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {items.length === 0 ? (
        <p className="mt-1.5 text-sm text-muted-foreground">{EMPTY}</p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {items.map((item, index) => (
            <li key={`${index}-${item.slice(0, 24)}`} className="flex gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              <span className="min-w-0 flex-1 break-words text-sm font-medium">
                {item}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  contentClassName,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-gradient-to-l from-muted/40 to-transparent pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <CardTitle className="text-base">{title}</CardTitle>
            {description && (
              <CardDescription className="text-xs sm:text-sm">
                {description}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent
        className={cn("grid gap-3 p-3 sm:grid-cols-2 sm:p-5", contentClassName)}
      >
        {children}
      </CardContent>
    </Card>
  );
}

/** Renders only the selected info tab — never mounts sibling sections. */
export function ProjectInfoTabContent({
  tab,
  project,
}: {
  tab: ProjectInfoTabId;
  project: ProjectCustomerOverviewData;
}) {
  const brief = project.brief || {};

  const platforms = useMemo(() => {
    if (tab !== "brief") return [] as string[];
    const raw = Array.isArray(project.platforms)
      ? project.platforms
      : asStringList(project.platforms);
    return raw.map((p) => PLATFORM_LABELS[String(p)] || String(p));
  }, [project.platforms, tab]);

  const features = useMemo(
    () => (tab === "brief" ? asStringList(brief.features) : []),
    [brief.features, tab],
  );

  const fileAssets = useMemo(() => {
    if (tab !== "assets") return [] as PortalProjectAsset[];
    return project.assets || [];
  }, [project.assets, tab]);

  if (tab === "customer") {
    const personName =
      asString(brief.personName) || project.crmCustomer.personName || "";
    const jobTitle =
      asString(brief.jobTitle) || project.crmCustomer.jobTitle || "";
    const company =
      asString(brief.companyName) || project.crmCustomer.companyName || "";
    const phoneFromBrief = asString(brief.phone);
    const phoneDisplay = phoneFromBrief
      ? formatPhoneDisplay(phoneFromBrief)
      : project.crmCustomer.phone
        ? formatPhoneDisplay(project.crmCustomer.phone)
        : "";
    const whatsappRaw =
      project.crmCustomer.normalizedWhatsapp ||
      project.crmCustomer.whatsappRaw ||
      "";
    const whatsapp = whatsappRaw ? formatPhoneDisplay(whatsappRaw) : "";
    const email = asString(brief.email) || project.crmCustomer.email || "";
    const website = asString(brief.website);
    const address =
      asString(brief.address) || project.crmCustomer.address || "";
    const city = asString(brief.city) || project.crmCustomer.city || "";

    return (
      <SectionCard
        icon={UserRound}
        title="اطلاعات مشتری"
        description="نام، سازمان و راه‌های تماس"
      >
        <FieldTile label="نام" value={personName} />
        <FieldTile label="سمت" value={jobTitle} />
        <FieldTile label="شرکت / سازمان" value={company} wide />
        <FieldTile label="تلفن" value={phoneDisplay} ltr />
        <FieldTile label="واتساپ" value={whatsapp} ltr />
        <FieldTile label="ایمیل" value={email} ltr wide />
        <FieldTile label="وب‌سایت" value={website} ltr wide />
        <FieldTile label="آدرس" value={address} wide />
        <FieldTile label="شهر" value={city} />
      </SectionCard>
    );
  }

  if (tab === "brief") {
    const proposedNarrator =
      project.assignments?.find((a) => a.role === "PROPOSED_NARRATOR")
        ?.teamProfile?.displayName || "";
    const customAspectRatio = asString(brief.customAspectRatio);
    const aspectValue = customAspectRatio
      ? customAspectRatio
      : project.format
        ? `${project.format.name} (${project.format.ratio})`
        : asString(brief.aspectRatio);
    const durationLabel = project.durationSec
      ? formatDurationLabel(project.durationSec)
      : asString(brief.durationSec)
        ? `${asString(brief.durationSec)} ثانیه`
        : "";
    const brandClaims = asString(brief.allowedClaims);
    const mandatoryTexts = asString(brief.mandatoryTexts);
    const brandLimits = asString(brief.brandLimits);
    const briefNotes = asString(brief.notes) || project.crmCustomer.notes || "";
    const hasBrandSection = Boolean(
      brandClaims || mandatoryTexts || brandLimits,
    );
    const extraFields = collectExtraBriefFields(brief);

    return (
      <div className="space-y-4">
        <SectionCard
          icon={Building2}
          title="اطلاعات پایه و اهداف پروژه"
          description="محتوای تبلیغ، مخاطب و پیام‌های کلیدی"
        >
          <FieldTile
            label="نام محصول / خدمت"
            value={asString(brief.productName)}
          />
          <FieldTile
            label="خدمت"
            value={project.service?.name || ""}
          />
          <FieldTile
            label="توضیح کوتاه"
            value={asString(brief.productDescription)}
            wide
          />
          <BulletList label="ویژگی‌ها و مزایا" items={features} />
          <FieldTile label="مخاطب هدف" value={asString(brief.audience)} />
          <FieldTile label="هدف تبلیغ" value={asString(brief.goal)} />
          <FieldTile
            label="پیام اصلی"
            value={asString(brief.mainMessage)}
            wide
          />
          <FieldTile label="CTA" value={asString(brief.cta)} wide />
          <FieldTile
            label="لحن برند"
            value={asString(brief.tone) || project.tone || ""}
          />
        </SectionCard>

        <SectionCard
          icon={Clapperboard}
          title="دستورالعمل ویدیو"
          description="مشخصات فنی و خلاقانه"
        >
          <FieldTile label="مدت ویدیو" value={durationLabel} />
          <FieldTile
            label="نسبت تصویر"
            value={aspectValue}
            ltr={Boolean(customAspectRatio || aspectValue)}
          />
          <FieldTile
            label="فرمت"
            value={
              project.format
                ? `${project.format.name}${project.format.ratio ? ` (${project.format.ratio})` : ""}`
                : ""
            }
          />
          <FieldTile
            label="زبان"
            value={
              project.language
                ? LANGUAGE_LABELS[project.language] || project.language
                : asString(brief.language)
                  ? LANGUAGE_LABELS[asString(brief.language)] ||
                    asString(brief.language)
                  : ""
            }
          />
          <FieldTile
            label="لحن"
            value={asString(brief.tone) || project.tone || ""}
          />
          <FieldTile label="گوینده پیشنهادی" value={proposedNarrator} />
          <TagList label="پلتفرم‌ها" items={platforms} />
        </SectionCard>

        {hasBrandSection ? (
          <SectionCard
            icon={ShieldCheck}
            title="الزامات برند"
            description="محدودیت‌ها، ادعاها و متون اجباری اعلام‌شده توسط مشتری"
          >
            <FieldTile label="ادعاهای مجاز" value={brandClaims} wide />
            <FieldTile label="متون اجباری" value={mandatoryTexts} wide />
            <FieldTile label="محدودیت‌های برند" value={brandLimits} wide />
          </SectionCard>
        ) : null}

        {briefNotes ? (
          <SectionCard
            icon={Building2}
            title="یادداشت‌های مشتری"
            description="توضیحات تکمیلی ثبت‌شده هنگام ایجاد پروژه"
          >
            <FieldTile label="یادداشت" value={briefNotes} wide />
          </SectionCard>
        ) : null}

        {extraFields.length > 0 ? (
          <SectionCard
            icon={Building2}
            title="سایر اطلاعات ثبت‌شده"
            description="فیلدهای تکمیلی ارسال‌شده توسط مشتری"
          >
            {extraFields.map((field) => (
              <FieldTile
                key={field.key}
                label={field.label}
                value={field.value}
                ltr={field.ltr}
                wide={field.wide}
              />
            ))}
          </SectionCard>
        ) : null}
      </div>
    );
  }

  if (tab === "assets") {
    return (
      <PortalProjectAssets
        assets={fileAssets}
        title="فایل‌ها و دارایی‌های مشتری"
        description="فایل‌ها و رسانه‌های ارسالی توسط مشتری"
        emptyTitle="دارایی‌ای آپلود نشده است"
        emptyDescription="مشتری هنوز فایلی ارسال نکرده است. پس از آپلود از پورتال، اینجا نمایش داده می‌شود."
      />
    );
  }

  return null;
}
