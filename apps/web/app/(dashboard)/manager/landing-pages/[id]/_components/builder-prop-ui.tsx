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
import type { LandingElement, TextAlign } from "@/lib/landing-content";
import { ResponsiveImageFields } from "@/components/landing/responsive-image-fields";
import { useLandingDevicePreview } from "@/components/landing/landing-device-preview";
import {
  teamAvatarImageGuide,
  type LandingImageGuide,
} from "@/lib/landing-image-guide";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint ? (
        <p className="text-[10px] leading-relaxed text-muted-foreground/80">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PanelSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2.5 border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
      <p className="text-[11px] font-semibold tracking-wide text-foreground">
        {title}
      </p>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

export function AlignSelect({
  value,
  onChange,
}: {
  value: TextAlign;
  onChange: (v: TextAlign) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TextAlign)}>
      <SelectTrigger dir="rtl">
        <SelectValue />
      </SelectTrigger>
      <SelectContent dir="rtl">
        <SelectItem value="right">راست</SelectItem>
        <SelectItem value="center">وسط</SelectItem>
        <SelectItem value="left">چپ</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function ColorField({
  label,
  value,
  fallback = "#111827",
  onChange,
}: {
  label: string;
  value: string;
  fallback?: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <Input
          type="color"
          className="h-9 w-12 shrink-0 cursor-pointer p-1"
          value={value || fallback}
          onChange={(e) => onChange(e.target.value)}
        />
        <Input
          dir="ltr"
          className="text-start font-mono text-xs"
          value={value || ""}
          placeholder={fallback}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </Field>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
      />
    </Field>
  );
}

export function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      {label}
    </label>
  );
}

export function UrlField({
  label,
  value,
  onChange,
  placeholder = "https://",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <Input
        dir="ltr"
        className="text-start"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.trimStart())}
      />
    </Field>
  );
}

type StyleKey = keyof LandingElement["styles"];

export function patchStyles(
  element: LandingElement,
  patch: Partial<LandingElement["styles"]>,
): LandingElement {
  return { ...element, styles: { ...element.styles, ...patch } };
}

export function TypographyControls({
  element,
  onChange,
  showSize = true,
  showWeight = true,
  showColor = true,
  showAlign = true,
  showLineHeight = true,
  showLetterSpacing = false,
}: {
  element: LandingElement;
  onChange: (el: LandingElement) => void;
  showSize?: boolean;
  showWeight?: boolean;
  showColor?: boolean;
  showAlign?: boolean;
  showLineHeight?: boolean;
  showLetterSpacing?: boolean;
}) {
  const s = element.styles;
  const set = (patch: Partial<LandingElement["styles"]>) =>
    onChange(patchStyles(element, patch));

  return (
    <PanelSection title="تایپوگرافی">
      <div className="grid grid-cols-2 gap-2">
        {showSize ? (
          <NumberField
            label="اندازه قلم"
            value={s.fontSize}
            min={10}
            max={96}
            onChange={(n) => set({ fontSize: Math.min(96, Math.max(10, n)) })}
          />
        ) : null}
        {showWeight ? (
          <Field label="وزن قلم">
            <Select
              value={String(s.fontWeight || 400)}
              onValueChange={(v) => set({ fontWeight: Number(v) })}
            >
              <SelectTrigger dir="rtl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="300">نازک</SelectItem>
                <SelectItem value="400">عادی</SelectItem>
                <SelectItem value="500">متوسط</SelectItem>
                <SelectItem value="600">نیمه‌ضخیم</SelectItem>
                <SelectItem value="700">ضخیم</SelectItem>
                <SelectItem value="800">خیلی ضخیم</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        {showAlign ? (
          <Field label="تراز">
            <AlignSelect value={s.align} onChange={(v) => set({ align: v })} />
          </Field>
        ) : null}
        {showLineHeight ? (
          <NumberField
            label="ارتفاع خط"
            value={s.lineHeight}
            min={0.8}
            max={3}
            step={0.05}
            onChange={(n) => set({ lineHeight: n })}
          />
        ) : null}
        {showLetterSpacing ? (
          <NumberField
            label="فاصله حروف"
            value={s.letterSpacing}
            min={-2}
            max={12}
            step={0.5}
            onChange={(n) => set({ letterSpacing: n })}
          />
        ) : null}
      </div>
      {showColor ? (
        <ColorField
          label="رنگ متن"
          value={s.color}
          onChange={(v) => set({ color: v })}
        />
      ) : null}
    </PanelSection>
  );
}

export function SpacingControls({
  element,
  onChange,
  showPadding = true,
  showWidth = true,
  showMaxWidth = false,
  showGap = false,
}: {
  element: LandingElement;
  onChange: (el: LandingElement) => void;
  showPadding?: boolean;
  showWidth?: boolean;
  showMaxWidth?: boolean;
  showGap?: boolean;
}) {
  const s = element.styles;
  const set = (patch: Partial<LandingElement["styles"]>) =>
    onChange(patchStyles(element, patch));

  return (
    <PanelSection title="فاصله و ابعاد">
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="حاشیه بالا"
          value={s.marginTop}
          min={0}
          max={160}
          onChange={(n) => set({ marginTop: n })}
        />
        <NumberField
          label="حاشیه پایین"
          value={s.marginBottom}
          min={0}
          max={160}
          onChange={(n) => set({ marginBottom: n })}
        />
        {showPadding ? (
          <NumberField
            label="پدینگ"
            value={s.padding}
            min={0}
            max={80}
            onChange={(n) => set({ padding: n })}
          />
        ) : null}
        {showGap ? (
          <NumberField
            label="فاصله داخلی"
            value={s.gap}
            min={0}
            max={80}
            onChange={(n) => set({ gap: n })}
          />
        ) : null}
        {showWidth ? (
          <Field label="عرض">
            <Input
              value={s.width}
              placeholder="100%"
              onChange={(e) => set({ width: e.target.value || "100%" })}
            />
          </Field>
        ) : null}
        {showMaxWidth ? (
          <Field label="حداکثر عرض">
            <Input
              value={s.maxWidth}
              placeholder="100%"
              onChange={(e) => set({ maxWidth: e.target.value || "100%" })}
            />
          </Field>
        ) : null}
      </div>
    </PanelSection>
  );
}

export function VisibilityControls({
  element,
  onChange,
}: {
  element: LandingElement;
  onChange: (el: LandingElement) => void;
}) {
  const preview = useLandingDevicePreview();
  const s = element.styles;
  const set = (patch: Partial<LandingElement["styles"]>) =>
    onChange(patchStyles(element, patch));

  const previewLabel =
    preview.band === "mobile"
      ? "موبایل"
      : preview.band === "tablet"
        ? "تبلت"
        : "دسکتاپ";

  return (
    <PanelSection title="نمایش">
      {preview.enabled ? (
        <p className="mb-2 rounded-md bg-muted/60 px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
          پیش‌نمایش فعلی: {previewLabel} ({preview.viewportLabel}) — مخفی‌سازی
          بر اساس باند استاندارد (موبایل &lt;۷۶۸ / تبلت ۷۶۸–۱۰۲۳ / دسکتاپ
          ≥۱۰۲۴).
        </p>
      ) : null}
      <ToggleRow
        label="مخفی در موبایل"
        checked={s.hiddenOnMobile}
        onChange={(v) => set({ hiddenOnMobile: v })}
      />
      <ToggleRow
        label="مخفی در تبلت"
        checked={s.hiddenOnTablet}
        onChange={(v) => set({ hiddenOnTablet: v })}
      />
      <ToggleRow
        label="مخفی در دسکتاپ"
        checked={s.hiddenOnDesktop}
        onChange={(v) => set({ hiddenOnDesktop: v })}
      />
      <ToggleRow
        label="قفل عنصر"
        checked={!!element.locked}
        onChange={(v) => onChange({ ...element, locked: v })}
      />
    </PanelSection>
  );
}

export function BoxControls({
  element,
  onChange,
  showBackground = true,
  showBorder = true,
  showRadius = true,
  showShadow = false,
}: {
  element: LandingElement;
  onChange: (el: LandingElement) => void;
  showBackground?: boolean;
  showBorder?: boolean;
  showRadius?: boolean;
  showShadow?: boolean;
}) {
  const s = element.styles;
  const set = (patch: Partial<LandingElement["styles"]>) =>
    onChange(patchStyles(element, patch));

  return (
    <PanelSection title="ظاهر جعبه">
      {showBackground ? (
        <ColorField
          label="رنگ پس‌زمینه"
          value={s.backgroundColor}
          fallback="#ffffff"
          onChange={(v) => set({ backgroundColor: v })}
        />
      ) : null}
      {showBorder ? (
        <div className="grid grid-cols-2 gap-2">
          <ColorField
            label="رنگ حاشیه"
            value={s.borderColor}
            fallback="#e5e7eb"
            onChange={(v) => set({ borderColor: v })}
          />
          <NumberField
            label="ضخامت حاشیه"
            value={s.borderWidth}
            min={0}
            max={12}
            onChange={(n) => set({ borderWidth: n })}
          />
        </div>
      ) : null}
      {showRadius ? (
        <NumberField
          label="گردی گوشه"
          value={s.borderRadius}
          min={0}
          max={80}
          onChange={(n) => set({ borderRadius: n })}
        />
      ) : null}
      {showShadow ? (
        <Field label="سایه" hint="مثال: 0 4px 16px rgba(0,0,0,0.08)">
          <Input
            dir="ltr"
            className="text-start"
            value={s.boxShadow}
            onChange={(e) => set({ boxShadow: e.target.value })}
          />
        </Field>
      ) : null}
    </PanelSection>
  );
}

export function CardItemsEditor({
  items,
  onChange,
  fields,
  withImage = false,
  imageGuide,
}: {
  items: Record<string, unknown>[];
  onChange: (items: Record<string, unknown>[]) => void;
  fields: Array<{ key: string; label: string; multiline?: boolean }>;
  withImage?: boolean;
  imageGuide?: LandingImageGuide | null;
}) {
  const guide = imageGuide ?? (withImage ? teamAvatarImageGuide() : null);
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium">مورد {i + 1}</span>
            <button
              type="button"
              className="text-[10px] text-muted-foreground hover:text-destructive"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              حذف
            </button>
          </div>
          {withImage ? (
            <ResponsiveImageFields
              compact
              guide={guide}
              desktopSrc={
                String(item.imageSrc || item.imageUrl || "") || null
              }
              desktopKey={String(item.imageKey || "") || null}
              mobileSrc={
                String(item.mobileImageSrc || item.mobileImageUrl || "") ||
                null
              }
              mobileKey={String(item.mobileImageKey || "") || null}
              onDesktopChange={({ key, url }) => {
                const next = [...items];
                next[i] = {
                  ...item,
                  imageKey: key,
                  imageSrc: url,
                  imageUrl: url,
                };
                onChange(next);
              }}
              onMobileChange={({ key, url }) => {
                const next = [...items];
                next[i] = {
                  ...item,
                  mobileImageKey: key,
                  mobileImageSrc: url,
                  mobileImageUrl: url,
                };
                onChange(next);
              }}
            />
          ) : null}
          {fields.map((field) => (
            <Field key={field.key} label={field.label}>
              {field.multiline ? (
                <Textarea
                  value={String(item[field.key] ?? "")}
                  rows={2}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...item, [field.key]: e.target.value };
                    onChange(next);
                  }}
                />
              ) : (
                <Input
                  value={String(item[field.key] ?? "")}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...item, [field.key]: e.target.value };
                    onChange(next);
                  }}
                />
              )}
            </Field>
          ))}
        </div>
      ))}
      <button
        type="button"
        className="w-full rounded-lg border border-dashed border-border/70 py-2 text-xs text-muted-foreground hover:border-brand/40 hover:bg-brand/5"
        onClick={() => onChange([...items, {}])}
      >
        افزودن مورد
      </button>
    </div>
  );
}

export type { StyleKey };
