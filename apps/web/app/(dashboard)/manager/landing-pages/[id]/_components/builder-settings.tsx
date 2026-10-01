"use client";

import { type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LandingMediaUploader } from "@/components/landing/landing-media-uploader";
import { ResponsiveImageFields } from "@/components/landing/responsive-image-fields";
import {
  findElementInSection,
  type LandingContent,
  type LandingElement,
  type LandingHero,
  type LandingSection,
} from "@/lib/landing-content";
import { ElementSettingsForm } from "./builder-element-props";

export { ElementSettingsForm };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function HeroSettingsForm({
  hero,
  onChange,
}: {
  hero: LandingHero;
  onChange: (hero: LandingHero) => void;
}) {
  const set = (patch: Partial<LandingHero>) => onChange({ ...hero, ...patch });
  return (
    <div className="space-y-3">
      <div className="mb-1">
        <p className="text-sm font-semibold">بنر اصلی</p>
        <p className="text-[10px] text-muted-foreground">
          تنظیمات هدر و فراخوان اقدام
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={hero.enabled}
          onCheckedChange={(v) => set({ enabled: v === true })}
        />
        نمایش بنر
      </label>
      <Field label="عنوان بنر">
        <Input
          value={hero.heading}
          onChange={(e) => set({ heading: e.target.value })}
        />
      </Field>
      <Field label="توضیحات">
        <Textarea
          value={hero.description}
          onChange={(e) => set({ description: e.target.value })}
          rows={4}
        />
      </Field>
      <Field label="تصویر پس‌زمینه">
        <ResponsiveImageFields
          desktopSrc={hero.backgroundImageSrc || null}
          desktopKey={hero.backgroundImageKey}
          mobileSrc={hero.mobileBackgroundImageSrc || null}
          mobileKey={hero.mobileBackgroundImageKey || null}
          onDesktopChange={({ key, url }) =>
            set({ backgroundImageKey: key, backgroundImageSrc: url })
          }
          onMobileChange={({ key, url }) =>
            set({
              mobileBackgroundImageKey: key,
              mobileBackgroundImageSrc: url,
            })
          }
        />
      </Field>
      <Field label="ویدیو پس‌زمینه (اختیاری)">
        <LandingMediaUploader
          kind="video"
          src={hero.backgroundVideoSrc || null}
          storageKey={hero.backgroundVideoKey}
          onChange={({ key, url }) =>
            set({ backgroundVideoKey: key, backgroundVideoSrc: url })
          }
        />
      </Field>
      <Field label="متن دکمه">
        <Input
          value={hero.ctaText}
          onChange={(e) => set({ ctaText: e.target.value })}
        />
      </Field>
      <Field label="لینک دکمه">
        <Input
          dir="ltr"
          className="text-start"
          value={hero.ctaUrl}
          onChange={(e) => set({ ctaUrl: e.target.value })}
        />
      </Field>
      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={hero.ctaOpenInNewTab}
          onCheckedChange={(v) => set({ ctaOpenInNewTab: v === true })}
        />
        باز شدن در تب جدید
      </label>
      <Field label="تراز متن">
        <Select
          value={hero.textAlign}
          onValueChange={(v) =>
            set({ textAlign: v as LandingHero["textAlign"] })
          }
        >
          <SelectTrigger dir="rtl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="right">راست</SelectItem>
            <SelectItem value="center">وسط</SelectItem>
            <SelectItem value="left">چپ</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={hero.overlay}
          onCheckedChange={(v) => set({ overlay: v === true })}
        />
        پوشش تیره روی پس‌زمینه
      </label>
      <Field label="شفافیت پوشش">
        <Input
          type="number"
          step="0.05"
          min={0}
          max={0.9}
          value={hero.overlayOpacity}
          onChange={(e) => set({ overlayOpacity: Number(e.target.value) })}
        />
      </Field>
      <Field label="ارتفاع دسکتاپ">
        <Input
          value={hero.minHeight}
          onChange={(e) => set({ minHeight: e.target.value })}
        />
      </Field>
      <Field label="ارتفاع موبایل">
        <Input
          value={hero.mobileMinHeight}
          onChange={(e) => set({ mobileMinHeight: e.target.value })}
        />
      </Field>
    </div>
  );
}

export function SectionSettingsForm({
  section,
  onChange,
}: {
  section: LandingSection;
  onChange: (section: LandingSection) => void;
}) {
  const s = section.settings;
  const set = (patch: Partial<typeof s>) =>
    onChange({ ...section, settings: { ...s, ...patch } });
  return (
    <div className="space-y-3">
      <div className="mb-1">
        <p className="text-sm font-semibold">
          {section.label || "تنظیمات بخش"}
        </p>
        <p className="text-[10px] text-muted-foreground">ظاهر و فاصله‌گذاری بخش</p>
      </div>
      <Field label="رنگ پس‌زمینه">
        <Input
          type="color"
          value={s.backgroundColor || "#ffffff"}
          onChange={(e) => set({ backgroundColor: e.target.value })}
        />
      </Field>
      <Field label="تصویر پس‌زمینه">
        <ResponsiveImageFields
          desktopSrc={s.backgroundImageSrc || null}
          desktopKey={s.backgroundImageKey}
          mobileSrc={s.mobileBackgroundImageSrc || null}
          mobileKey={s.mobileBackgroundImageKey || null}
          onDesktopChange={({ key, url }) =>
            set({ backgroundImageKey: key, backgroundImageSrc: url })
          }
          onMobileChange={({ key, url }) =>
            set({
              mobileBackgroundImageKey: key,
              mobileBackgroundImageSrc: url,
            })
          }
        />
      </Field>
      <Field label="عرض">
        <Select
          value={s.width}
          onValueChange={(v) => set({ width: v as typeof s.width })}
        >
          <SelectTrigger dir="rtl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="default">استاندارد</SelectItem>
            <SelectItem value="wide">عریض</SelectItem>
            <SelectItem value="full">تمام‌عرض</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="حداقل ارتفاع">
        <Input
          value={s.minHeight}
          onChange={(e) => set({ minHeight: e.target.value })}
        />
      </Field>
      <Field label="پدینگ عمودی">
        <Input
          type="number"
          value={s.paddingY}
          onChange={(e) => set({ paddingY: Number(e.target.value) || 0 })}
        />
      </Field>
      <Field label="پدینگ افقی">
        <Input
          type="number"
          value={s.paddingX}
          onChange={(e) => set({ paddingX: Number(e.target.value) || 0 })}
        />
      </Field>
      <Field label="حاشیه عمودی">
        <Input
          type="number"
          value={s.marginY}
          onChange={(e) => set({ marginY: Number(e.target.value) || 0 })}
        />
      </Field>
      <Field label="گردی گوشه">
        <Input
          type="number"
          value={s.borderRadius}
          onChange={(e) => set({ borderRadius: Number(e.target.value) || 0 })}
        />
      </Field>
      <Field label="گرادیان پس‌زمینه">
        <Input
          value={s.backgroundGradient}
          placeholder="linear-gradient(...)"
          onChange={(e) => set({ backgroundGradient: e.target.value })}
        />
      </Field>
      <Field label="تراز عمودی">
        <Select
          value={s.verticalAlign}
          onValueChange={(v) =>
            set({ verticalAlign: v as typeof s.verticalAlign })
          }
        >
          <SelectTrigger dir="rtl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="top">بالا</SelectItem>
            <SelectItem value="center">وسط</SelectItem>
            <SelectItem value="bottom">پایین</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="فاصله عناصر">
        <Input
          type="number"
          value={s.gap}
          onChange={(e) => set({ gap: Number(e.target.value) || 0 })}
        />
      </Field>
      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={s.backgroundOverlay}
          onCheckedChange={(v) => set({ backgroundOverlay: v === true })}
        />
        پوشش روی تصویر پس‌زمینه
      </label>
      {s.backgroundOverlay ? (
        <>
          <Field label="رنگ پوشش">
            <Input
              type="color"
              value={s.overlayColor || "#000000"}
              onChange={(e) => set({ overlayColor: e.target.value })}
            />
          </Field>
          <Field label="شفافیت پوشش">
            <Input
              type="number"
              step="0.05"
              min={0}
              max={0.9}
              value={s.overlayOpacity}
              onChange={(e) => set({ overlayOpacity: Number(e.target.value) })}
            />
          </Field>
        </>
      ) : null}
      <Field label="نام بخش">
        <Input
          value={section.label || ""}
          onChange={(e) => onChange({ ...section, label: e.target.value })}
        />
      </Field>
    </div>
  );
}

export function BuilderSettingsPanel({
  content,
  selection,
  onHero,
  onSection,
  onElement,
}: {
  content: LandingContent;
  selection:
    | { kind: "hero" }
    | { kind: "section"; id: string }
    | { kind: "element"; sectionId: string; elementId: string }
    | { kind: "none" }
    | null;
  onHero: (hero: LandingHero) => void;
  onSection: (section: LandingSection) => void;
  onElement: (sectionId: string, element: LandingElement) => void;
}) {
  if (!selection || selection.kind === "none") {
    return (
      <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-sm font-medium text-foreground">
          یک عنصر را برای ویرایش انتخاب کنید
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          روی بنر، بخش یا هر جزء در بوم کلیک کنید تا تنظیمات مربوط به آن اینجا
          نمایش داده شود.
        </p>
      </div>
    );
  }

  if (selection.kind === "hero") {
    return <HeroSettingsForm hero={content.hero} onChange={onHero} />;
  }

  if (selection.kind === "section") {
    const section = content.sections.find((s) => s.id === selection.id);
    if (!section) {
      return (
        <p className="text-sm text-muted-foreground">بخش پیدا نشد</p>
      );
    }
    return <SectionSettingsForm section={section} onChange={onSection} />;
  }

  if (selection.kind === "element") {
    const section = content.sections.find((s) => s.id === selection.sectionId);
    const element = findElementInSection(section, selection.elementId);
    if (!element) {
      return (
        <p className="text-sm text-muted-foreground">عنصر پیدا نشد</p>
      );
    }
    return (
      <ElementSettingsForm
        element={element}
        onChange={(next) => onElement(selection.sectionId, next)}
      />
    );
  }

  return (
    <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 px-4 text-center">
      <p className="text-sm font-medium text-foreground">
        یک عنصر را برای ویرایش انتخاب کنید
      </p>
    </div>
  );
}
