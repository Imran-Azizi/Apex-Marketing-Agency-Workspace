"use client";

import type { ReactNode } from "react";
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
import {
  ICON_OPTIONS,
  bool,
  num,
  str,
  type LandingContent,
  type LandingElement,
  type LandingHero,
  type LandingSection,
} from "@/lib/landing-content";

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function StyleFields({
  element,
  onChange,
}: {
  element: LandingElement;
  onChange: (next: LandingElement) => void;
}) {
  const s = element.styles;
  const set = (patch: Partial<typeof s>) =>
    onChange({ ...element, styles: { ...s, ...patch } });
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="اندازه قلم">
        <Input
          type="number"
          value={s.fontSize}
          onChange={(e) => set({ fontSize: Number(e.target.value) || 16 })}
        />
      </Field>
      <Field label="وزن قلم">
        <Input
          type="number"
          value={s.fontWeight}
          onChange={(e) => set({ fontWeight: Number(e.target.value) || 400 })}
        />
      </Field>
      <Field label="رنگ متن">
        <Input type="color" value={s.color || "#111827"} onChange={(e) => set({ color: e.target.value })} />
      </Field>
      <Field label="تراز">
        <Select value={s.align} onValueChange={(v) => set({ align: v as typeof s.align })}>
          <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="right">راست</SelectItem>
            <SelectItem value="center">وسط</SelectItem>
            <SelectItem value="left">چپ</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="فاصله خطوط">
        <Input
          type="number"
          step="0.1"
          value={s.lineHeight}
          onChange={(e) => set({ lineHeight: Number(e.target.value) || 1.6 })}
        />
      </Field>
      <Field label="فاصله حروف">
        <Input
          type="number"
          value={s.letterSpacing}
          onChange={(e) => set({ letterSpacing: Number(e.target.value) || 0 })}
        />
      </Field>
      <Field label="حاشیه بالا">
        <Input type="number" value={s.marginTop} onChange={(e) => set({ marginTop: Number(e.target.value) || 0 })} />
      </Field>
      <Field label="حاشیه پایین">
        <Input type="number" value={s.marginBottom} onChange={(e) => set({ marginBottom: Number(e.target.value) || 0 })} />
      </Field>
      <Field label="پدینگ">
        <Input type="number" value={s.padding} onChange={(e) => set({ padding: Number(e.target.value) || 0 })} />
      </Field>
      <Field label="عرض">
        <Input value={s.width} onChange={(e) => set({ width: e.target.value })} />
      </Field>
      <label className="col-span-2 flex items-center gap-2 text-xs">
        <Checkbox checked={s.hiddenOnMobile} onCheckedChange={(v) => set({ hiddenOnMobile: v === true })} />
        مخفی در موبایل
      </label>
      <label className="col-span-2 flex items-center gap-2 text-xs">
        <Checkbox checked={s.hiddenOnDesktop} onCheckedChange={(v) => set({ hiddenOnDesktop: v === true })} />
        مخفی در دسکتاپ
      </label>
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
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={hero.enabled} onCheckedChange={(v) => set({ enabled: v === true })} />
        نمایش بنر
      </label>
      <Field label="عنوان بنر">
        <Input value={hero.heading} onChange={(e) => set({ heading: e.target.value })} />
      </Field>
      <Field label="توضیحات">
        <Textarea value={hero.description} onChange={(e) => set({ description: e.target.value })} rows={4} />
      </Field>
      <Field label="تصویر پس‌زمینه">
        <LandingMediaUploader
          kind="image"
          src={hero.backgroundImageSrc || null}
          storageKey={hero.backgroundImageKey}
          onChange={({ key, url }) => set({ backgroundImageKey: key, backgroundImageSrc: url })}
        />
      </Field>
      <Field label="ویدیو پس‌زمینه (اختیاری)">
        <LandingMediaUploader
          kind="video"
          src={hero.backgroundVideoSrc || null}
          storageKey={hero.backgroundVideoKey}
          onChange={({ key, url }) => set({ backgroundVideoKey: key, backgroundVideoSrc: url })}
        />
      </Field>
      <Field label="متن دکمه">
        <Input value={hero.ctaText} onChange={(e) => set({ ctaText: e.target.value })} />
      </Field>
      <Field label="لینک دکمه">
        <Input dir="ltr" className="text-start" value={hero.ctaUrl} onChange={(e) => set({ ctaUrl: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2 text-xs">
        <Checkbox checked={hero.ctaOpenInNewTab} onCheckedChange={(v) => set({ ctaOpenInNewTab: v === true })} />
        باز شدن در تب جدید
      </label>
      <Field label="تراز متن">
        <Select value={hero.textAlign} onValueChange={(v) => set({ textAlign: v as LandingHero["textAlign"] })}>
          <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="right">راست</SelectItem>
            <SelectItem value="center">وسط</SelectItem>
            <SelectItem value="left">چپ</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <label className="flex items-center gap-2 text-xs">
        <Checkbox checked={hero.overlay} onCheckedChange={(v) => set({ overlay: v === true })} />
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
        <Input value={hero.minHeight} onChange={(e) => set({ minHeight: e.target.value })} />
      </Field>
      <Field label="ارتفاع موبایل">
        <Input value={hero.mobileMinHeight} onChange={(e) => set({ mobileMinHeight: e.target.value })} />
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
      <Field label="رنگ پس‌زمینه">
        <Input type="color" value={s.backgroundColor || "#ffffff"} onChange={(e) => set({ backgroundColor: e.target.value })} />
      </Field>
      <Field label="تصویر پس‌زمینه">
        <LandingMediaUploader
          kind="image"
          src={s.backgroundImageSrc || null}
          storageKey={s.backgroundImageKey}
          onChange={({ key, url }) => set({ backgroundImageKey: key, backgroundImageSrc: url })}
        />
      </Field>
      <Field label="عرض">
        <Select value={s.width} onValueChange={(v) => set({ width: v as typeof s.width })}>
          <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="default">استاندارد</SelectItem>
            <SelectItem value="wide">عریض</SelectItem>
            <SelectItem value="full">تمام‌عرض</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="حداقل ارتفاع">
        <Input value={s.minHeight} onChange={(e) => set({ minHeight: e.target.value })} />
      </Field>
      <Field label="پدینگ عمودی">
        <Input type="number" value={s.paddingY} onChange={(e) => set({ paddingY: Number(e.target.value) || 0 })} />
      </Field>
      <Field label="پدینگ افقی">
        <Input type="number" value={s.paddingX} onChange={(e) => set({ paddingX: Number(e.target.value) || 0 })} />
      </Field>
      <Field label="حاشیه عمودی">
        <Input type="number" value={s.marginY} onChange={(e) => set({ marginY: Number(e.target.value) || 0 })} />
      </Field>
      <Field label="گردی گوشه">
        <Input type="number" value={s.borderRadius} onChange={(e) => set({ borderRadius: Number(e.target.value) || 0 })} />
      </Field>
    </div>
  );
}

export function ElementSettingsForm({
  element,
  onChange,
}: {
  element: LandingElement;
  onChange: (element: LandingElement) => void;
}) {
  const setContent = (patch: Record<string, unknown>) =>
    onChange({ ...element, content: { ...element.content, ...patch } });

  return (
    <div className="space-y-4">
      {element.type === "heading" || element.type === "paragraph" || element.type === "text" ? (
        <>
          <Field label="متن">
            <Textarea
              value={str(element.content.text)}
              onChange={(e) => setContent({ text: e.target.value })}
              rows={element.type === "heading" ? 2 : 6}
            />
          </Field>
          {element.type === "heading" ? (
            <Field label="سطح عنوان">
              <Select
                value={String(num(element.content.level, 2))}
                onValueChange={(v) => setContent({ level: Number(v) })}
              >
                <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="1">H1</SelectItem>
                  <SelectItem value="2">H2</SelectItem>
                  <SelectItem value="3">H3</SelectItem>
                  <SelectItem value="4">H4</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </>
      ) : null}

      {element.type === "image" ? (
        <>
          <LandingMediaUploader
            kind="image"
            src={str(element.content.imageSrc || element.content.imageUrl) || null}
            storageKey={str(element.content.imageKey) || null}
            onChange={({ key, url }) => setContent({ imageKey: key, imageSrc: url, imageUrl: url })}
          />
          <Field label="یا آدرس تصویر">
            <Input
              dir="ltr"
              className="text-start"
              value={str(element.content.imageUrl)}
              onChange={(e) => setContent({ imageUrl: e.target.value, imageSrc: e.target.value })}
            />
          </Field>
          <Field label="متن جایگزین">
            <Input value={str(element.content.alt)} onChange={(e) => setContent({ alt: e.target.value })} />
          </Field>
          <Field label="لینک">
            <Input dir="ltr" className="text-start" value={str(element.content.linkUrl)} onChange={(e) => setContent({ linkUrl: e.target.value })} />
          </Field>
          <Field label="ارتفاع (۰ = خودکار)">
            <Input type="number" value={num(element.content.height)} onChange={(e) => setContent({ height: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="برازش تصویر">
            <Select
              value={element.styles.objectFit}
              onValueChange={(v) => onChange({ ...element, styles: { ...element.styles, objectFit: v as LandingElement["styles"]["objectFit"] } })}
            >
              <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="cover">پوشش</SelectItem>
                <SelectItem value="contain">جا شدن</SelectItem>
                <SelectItem value="fill">کشیده</SelectItem>
                <SelectItem value="none">بدون تغییر</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      ) : null}

      {element.type === "video" ? (
        <>
          <LandingMediaUploader
            kind="video"
            src={str(element.content.videoSrc || element.content.videoUrl) || null}
            storageKey={str(element.content.videoKey) || null}
            onChange={({ key, url }) => setContent({ videoKey: key, videoSrc: url, videoUrl: url })}
          />
          <Field label="یا آدرس ویدیو">
            <Input dir="ltr" className="text-start" value={str(element.content.videoUrl)} onChange={(e) => setContent({ videoUrl: e.target.value, videoSrc: e.target.value })} />
          </Field>
          <Field label="تصویر پوستر">
            <LandingMediaUploader
              kind="image"
              src={str(element.content.posterSrc) || null}
              storageKey={str(element.content.posterKey) || null}
              onChange={({ key, url }) => setContent({ posterKey: key, posterSrc: url })}
            />
          </Field>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={bool(element.content.autoplay)} onCheckedChange={(v) => setContent({ autoplay: v === true, muted: true })} />
            پخش خودکار (با صدا خاموش)
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={bool(element.content.muted, true)} onCheckedChange={(v) => setContent({ muted: v === true })} />
            بی‌صدا
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={bool(element.content.loop)} onCheckedChange={(v) => setContent({ loop: v === true })} />
            تکرار
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={bool(element.content.controls, true)} onCheckedChange={(v) => setContent({ controls: v === true })} />
            کنترل‌ها
          </label>
        </>
      ) : null}

      {element.type === "audio" ? (
        <>
          <LandingMediaUploader
            kind="audio"
            src={str(element.content.audioSrc || element.content.audioUrl) || null}
            storageKey={str(element.content.audioKey) || null}
            onChange={({ key, url }) => setContent({ audioKey: key, audioSrc: url, audioUrl: url })}
          />
          <Field label="عنوان">
            <Input value={str(element.content.title)} onChange={(e) => setContent({ title: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={bool(element.content.loop)} onCheckedChange={(v) => setContent({ loop: v === true })} />
            تکرار
          </label>
        </>
      ) : null}

      {element.type === "button" || element.type === "link" ? (
        <>
          <Field label="متن">
            <Input value={str(element.content.text)} onChange={(e) => setContent({ text: e.target.value })} />
          </Field>
          <Field label="آدرس / صفحه داخلی">
            <Input dir="ltr" className="text-start" value={str(element.content.url)} onChange={(e) => setContent({ url: e.target.value })} />
          </Field>
          <Field label="سبک دکمه">
            <Select value={str(element.content.variant, "brand")} onValueChange={(v) => setContent({ variant: v })}>
              <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="brand">اصلی</SelectItem>
                <SelectItem value="outline">حاشیه‌دار</SelectItem>
                <SelectItem value="secondary">ثانویه</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={bool(element.content.openInNewTab)} onCheckedChange={(v) => setContent({ openInNewTab: v === true })} />
            باز شدن در تب جدید
          </label>
        </>
      ) : null}

      {element.type === "icon" ? (
        <>
          <Field label="آیکون">
            <Select value={str(element.content.name, "Sparkles")} onValueChange={(v) => setContent({ name: v })}>
              <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
              <SelectContent dir="rtl">
                {ICON_OPTIONS.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="اندازه">
            <Input type="number" value={num(element.content.size, 32)} onChange={(e) => setContent({ size: Number(e.target.value) || 32 })} />
          </Field>
          <Field label="لینک اختیاری">
            <Input dir="ltr" className="text-start" value={str(element.content.url)} onChange={(e) => setContent({ url: e.target.value })} />
          </Field>
        </>
      ) : null}

      {element.type === "spacer" ? (
        <Field label="ارتفاع">
          <Input type="number" value={num(element.content.height, 32)} onChange={(e) => setContent({ height: Number(e.target.value) || 32 })} />
        </Field>
      ) : null}

      <div className="border-t border-border/70 pt-3">
        <p className="mb-2 text-xs font-semibold">ظاهر</p>
        <StyleFields element={element} onChange={onChange} />
      </div>
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
    | { kind: "element"; sectionId: string; elementId: string };
  onHero: (hero: LandingHero) => void;
  onSection: (section: LandingSection) => void;
  onElement: (sectionId: string, element: LandingElement) => void;
}) {
  if (selection.kind === "hero") {
    return <HeroSettingsForm hero={content.hero} onChange={onHero} />;
  }
  if (selection.kind === "section") {
    const section = content.sections.find((s) => s.id === selection.id);
    if (!section) return <p className="text-sm text-muted-foreground">بخش پیدا نشد</p>;
    return <SectionSettingsForm section={section} onChange={onSection} />;
  }
  if (selection.kind === "element") {
    const section = content.sections.find((s) => s.id === selection.sectionId);
    const element = findElement(section, selection.elementId);
    if (!element) return <p className="text-sm text-muted-foreground">عنصر پیدا نشد</p>;
    return (
      <ElementSettingsForm
        element={element}
        onChange={(next) => onElement(selection.sectionId, next)}
      />
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      یک بخش یا عنصر را در بوم انتخاب کنید تا تنظیمات آن نمایش داده شود.
    </p>
  );
}

function findElement(
  section: LandingSection | undefined,
  elementId: string,
): LandingElement | null {
  if (!section) return null;
  const walk = (list: LandingElement[] = []): LandingElement | null => {
    for (const el of list) {
      if (el.id === elementId) return el;
      for (const col of el.columns || []) {
        const found = walk(col);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(section.elements) || (section.columns || []).reduce<LandingElement | null>(
    (found, col) => found || walk(col),
    null,
  );
}
