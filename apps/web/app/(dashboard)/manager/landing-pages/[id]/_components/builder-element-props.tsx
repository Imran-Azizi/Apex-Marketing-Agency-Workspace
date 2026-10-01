"use client";

import {
  ELEMENT_TYPE_LABELS,
  ICON_OPTIONS,
  bool,
  num,
  str,
  type LandingElement,
} from "@/lib/landing-content";
import {
  BoxControls,
  CardItemsEditor,
  ColorField,
  Field,
  NumberField,
  PanelSection,
  SpacingControls,
  ToggleRow,
  TypographyControls,
  UrlField,
  VisibilityControls,
  patchStyles,
} from "./builder-prop-ui";
import { LandingMediaUploader } from "@/components/landing/landing-media-uploader";
import { ResponsiveImageFields } from "@/components/landing/responsive-image-fields";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ElementSettingsForm({
  element,
  onChange,
}: {
  element: LandingElement;
  onChange: (element: LandingElement) => void;
}) {
  const setContent = (patch: Record<string, unknown>) =>
    onChange({ ...element, content: { ...element.content, ...patch } });

  const title =
    element.label || ELEMENT_TYPE_LABELS[element.type] || element.type;

  return (
    <div className="space-y-1">
      <div className="mb-3">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-[10px] text-muted-foreground">
          ویژگی‌های {ELEMENT_TYPE_LABELS[element.type] || element.type}
        </p>
      </div>

      <PanelSection title="شناسه">
        <Field label="نام عنصر">
          <Input
            value={element.label || ""}
            placeholder={ELEMENT_TYPE_LABELS[element.type] || element.type}
            onChange={(e) => onChange({ ...element, label: e.target.value })}
          />
        </Field>
      </PanelSection>

      {element.type === "heading" ? (
        <>
          <PanelSection title="محتوا">
            <Field label="متن عنوان">
              <Textarea
                value={str(element.content.text)}
                onChange={(e) => setContent({ text: e.target.value })}
                rows={2}
              />
            </Field>
            <Field label="سطح عنوان">
              <Select
                value={String(num(element.content.level, 2))}
                onValueChange={(v) => setContent({ level: Number(v) })}
              >
                <SelectTrigger dir="rtl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="1">H1 — اصلی</SelectItem>
                  <SelectItem value="2">H2 — بخش</SelectItem>
                  <SelectItem value="3">H3 — زیربخش</SelectItem>
                  <SelectItem value="4">H4 — کوچک</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </PanelSection>
          <TypographyControls
            element={element}
            onChange={onChange}
            showLetterSpacing
          />
          <PanelSection title="لینک">
            <UrlField
              label="آدرس (اختیاری)"
              value={str(element.content.linkUrl)}
              onChange={(v) => setContent({ linkUrl: v })}
              placeholder="/page یا https://"
            />
            <ToggleRow
              label="باز شدن در تب جدید"
              checked={bool(element.content.linkNewTab)}
              onChange={(v) => setContent({ linkNewTab: v })}
            />
          </PanelSection>
          <SpacingControls element={element} onChange={onChange} showMaxWidth />
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}

      {element.type === "paragraph" || element.type === "text" ? (
        <>
          <PanelSection title="محتوا">
            <Field label="متن">
              <Textarea
                value={str(element.content.text)}
                onChange={(e) => setContent({ text: e.target.value })}
                rows={6}
              />
            </Field>
          </PanelSection>
          <TypographyControls element={element} onChange={onChange} />
          <PanelSection title="لینک">
            <UrlField
              label="آدرس (اختیاری)"
              value={str(element.content.linkUrl)}
              onChange={(v) => setContent({ linkUrl: v })}
              placeholder="/page یا https://"
            />
            <ToggleRow
              label="باز شدن در تب جدید"
              checked={bool(element.content.linkNewTab)}
              onChange={(v) => setContent({ linkNewTab: v })}
            />
          </PanelSection>
          <SpacingControls element={element} onChange={onChange} showMaxWidth />
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}

      {element.type === "quote" ? (
        <>
          <PanelSection title="محتوا">
            <Field label="نقل‌قول">
              <Textarea
                value={str(element.content.text)}
                onChange={(e) => setContent({ text: e.target.value })}
                rows={4}
              />
            </Field>
            <Field label="نویسنده">
              <Input
                value={str(element.content.author)}
                onChange={(e) => setContent({ author: e.target.value })}
              />
            </Field>
          </PanelSection>
          <TypographyControls element={element} onChange={onChange} />
          <BoxControls element={element} onChange={onChange} />
          <SpacingControls element={element} onChange={onChange} />
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}

      {element.type === "list" ? (
        <>
          <PanelSection title="محتوا">
            <ToggleRow
              label="فهرست شماره‌دار"
              checked={bool(element.content.ordered)}
              onChange={(v) => setContent({ ordered: v })}
            />
            <Field label="موارد" hint="هر خط یک مورد">
              <Textarea
                value={((element.content.items as string[]) || []).join("\n")}
                onChange={(e) =>
                  setContent({
                    items: e.target.value
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean),
                  })
                }
                rows={6}
              />
            </Field>
          </PanelSection>
          <TypographyControls element={element} onChange={onChange} />
          <SpacingControls element={element} onChange={onChange} />
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}

      {element.type === "divider" ? (
        <>
          <PanelSection title="خط جداکننده">
            <NumberField
              label="ضخامت"
              value={num(element.content.thickness, 1)}
              min={1}
              max={8}
              onChange={(n) => setContent({ thickness: Math.max(1, n) })}
            />
            <ColorField
              label="رنگ"
              value={element.styles.color}
              fallback="#e5e7eb"
              onChange={(v) => onChange(patchStyles(element, { color: v }))}
            />
          </PanelSection>
          <SpacingControls
            element={element}
            onChange={onChange}
            showPadding={false}
            showWidth={false}
          />
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}

      {element.type === "spacer" ? (
        <>
          <PanelSection title="فاصله">
            <NumberField
              label="ارتفاع (پیکسل)"
              value={num(element.content.height, 32)}
              min={8}
              max={240}
              onChange={(n) => setContent({ height: Math.max(8, n) })}
            />
          </PanelSection>
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}

      {element.type === "image" ? (
        <>
          <PanelSection title="تصاویر واکنش‌گرا">
            <ResponsiveImageFields
              desktopSrc={
                str(element.content.imageSrc || element.content.imageUrl) ||
                null
              }
              desktopKey={str(element.content.imageKey) || null}
              mobileSrc={
                str(
                  element.content.mobileImageSrc ||
                    element.content.mobileImageUrl,
                ) || null
              }
              mobileKey={str(element.content.mobileImageKey) || null}
              onDesktopChange={({ key, url }) =>
                setContent({ imageKey: key, imageSrc: url, imageUrl: url })
              }
              onMobileChange={({ key, url }) =>
                setContent({
                  mobileImageKey: key,
                  mobileImageSrc: url,
                  mobileImageUrl: url,
                })
              }
            />
          </PanelSection>
          <PanelSection title="متن و دسترسی">
            <Field label="متن جایگزین (Alt)">
              <Input
                value={str(element.content.alt)}
                onChange={(e) => setContent({ alt: e.target.value })}
              />
            </Field>
          </PanelSection>
          <PanelSection title="ابعاد و برازش">
            <NumberField
              label="ارتفاع (۰ = خودکار)"
              value={num(element.content.height)}
              min={0}
              max={1200}
              onChange={(n) => setContent({ height: Math.max(0, n) })}
            />
            <Field label="برازش تصویر">
              <Select
                value={element.styles.objectFit}
                onValueChange={(v) =>
                  onChange(
                    patchStyles(element, {
                      objectFit: v as LandingElement["styles"]["objectFit"],
                    }),
                  )
                }
              >
                <SelectTrigger dir="rtl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="cover">پوشش</SelectItem>
                  <SelectItem value="contain">جا شدن</SelectItem>
                  <SelectItem value="fill">کشیده</SelectItem>
                  <SelectItem value="none">بدون تغییر</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <NumberField
              label="گردی گوشه"
              value={element.styles.borderRadius}
              min={0}
              max={80}
              onChange={(n) =>
                onChange(patchStyles(element, { borderRadius: n }))
              }
            />
          </PanelSection>
          <PanelSection title="لینک">
            <UrlField
              label="آدرس لینک"
              value={str(element.content.linkUrl)}
              onChange={(v) => setContent({ linkUrl: v })}
              placeholder="/page یا https://"
            />
            <ToggleRow
              label="باز شدن در تب جدید"
              checked={bool(element.content.linkNewTab)}
              onChange={(v) => setContent({ linkNewTab: v })}
            />
          </PanelSection>
          <SpacingControls element={element} onChange={onChange} />
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}

      {element.type === "gallery" || element.type === "slider" ? (
        <>
          <PanelSection
            title={element.type === "gallery" ? "گالری تصاویر" : "اسلایدر"}
          >
            {(
              (element.content.items as Array<Record<string, unknown>>) || []
            ).map((item, i) => (
              <div
                key={i}
                className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium">تصویر {i + 1}</span>
                  <button
                    type="button"
                    className="text-[10px] text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      const items = [
                        ...((element.content.items as unknown[]) || []),
                      ];
                      items.splice(i, 1);
                      setContent({ items });
                    }}
                  >
                    حذف
                  </button>
                </div>
                <ResponsiveImageFields
                  compact
                  desktopSrc={str(item.imageSrc || item.imageUrl) || null}
                  desktopKey={str(item.imageKey) || null}
                  mobileSrc={
                    str(item.mobileImageSrc || item.mobileImageUrl) || null
                  }
                  mobileKey={str(item.mobileImageKey) || null}
                  onDesktopChange={({ key, url }) => {
                    const items = [
                      ...((element.content.items as Record<
                        string,
                        unknown
                      >[]) || []),
                    ];
                    items[i] = {
                      ...item,
                      imageKey: key,
                      imageSrc: url,
                      imageUrl: url,
                    };
                    setContent({ items });
                  }}
                  onMobileChange={({ key, url }) => {
                    const items = [
                      ...((element.content.items as Record<
                        string,
                        unknown
                      >[]) || []),
                    ];
                    items[i] = {
                      ...item,
                      mobileImageKey: key,
                      mobileImageSrc: url,
                      mobileImageUrl: url,
                    };
                    setContent({ items });
                  }}
                />
                <Field label="متن جایگزین">
                  <Input
                    value={str(item.alt)}
                    onChange={(e) => {
                      const items = [
                        ...((element.content.items as Record<
                          string,
                          unknown
                        >[]) || []),
                      ];
                      items[i] = { ...item, alt: e.target.value };
                      setContent({ items });
                    }}
                  />
                </Field>
              </div>
            ))}
            <button
              type="button"
              className="w-full rounded-lg border border-dashed border-border/70 py-2 text-xs text-muted-foreground hover:border-brand/40"
              onClick={() =>
                setContent({
                  items: [
                    ...((element.content.items as unknown[]) || []),
                    { alt: "" },
                  ],
                })
              }
            >
              افزودن تصویر
            </button>
          </PanelSection>
          {element.type === "gallery" ? (
            <PanelSection title="چیدمان گالری">
              <NumberField
                label="تعداد ستون"
                value={num(element.content.columns, 3)}
                min={1}
                max={4}
                onChange={(n) =>
                  setContent({ columns: Math.min(4, Math.max(1, n)) })
                }
              />
              <NumberField
                label="فاصله بین تصاویر"
                value={element.styles.gap}
                min={0}
                max={48}
                onChange={(n) => onChange(patchStyles(element, { gap: n }))}
              />
            </PanelSection>
          ) : (
            <PanelSection title="رفتار اسلایدر">
              <ToggleRow
                label="پخش خودکار"
                checked={bool(element.content.autoplay, true)}
                onChange={(v) => setContent({ autoplay: v })}
              />
              <NumberField
                label="فاصله تعویض (میلی‌ثانیه)"
                value={num(element.content.interval, 5000)}
                min={2000}
                max={15000}
                step={500}
                onChange={(n) => setContent({ interval: n })}
              />
              <NumberField
                label="گردی گوشه"
                value={element.styles.borderRadius}
                min={0}
                max={80}
                onChange={(n) =>
                  onChange(patchStyles(element, { borderRadius: n }))
                }
              />
            </PanelSection>
          )}
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}

      {element.type === "before-after" ? (
        <>
          <PanelSection title="تصویر قبل">
            <ResponsiveImageFields
              desktopSrc={str(element.content.beforeSrc) || null}
              desktopKey={str(element.content.beforeKey) || null}
              mobileSrc={str(element.content.mobileBeforeSrc) || null}
              mobileKey={str(element.content.mobileBeforeKey) || null}
              onDesktopChange={({ key, url }) =>
                setContent({ beforeKey: key, beforeSrc: url })
              }
              onMobileChange={({ key, url }) =>
                setContent({ mobileBeforeKey: key, mobileBeforeSrc: url })
              }
            />
            <Field label="متن جایگزین قبل">
              <Input
                value={str(element.content.beforeAlt)}
                onChange={(e) => setContent({ beforeAlt: e.target.value })}
              />
            </Field>
          </PanelSection>
          <PanelSection title="تصویر بعد">
            <ResponsiveImageFields
              desktopSrc={str(element.content.afterSrc) || null}
              desktopKey={str(element.content.afterKey) || null}
              mobileSrc={str(element.content.mobileAfterSrc) || null}
              mobileKey={str(element.content.mobileAfterKey) || null}
              onDesktopChange={({ key, url }) =>
                setContent({ afterKey: key, afterSrc: url })
              }
              onMobileChange={({ key, url }) =>
                setContent({ mobileAfterKey: key, mobileAfterSrc: url })
              }
            />
            <Field label="متن جایگزین بعد">
              <Input
                value={str(element.content.afterAlt)}
                onChange={(e) => setContent({ afterAlt: e.target.value })}
              />
            </Field>
          </PanelSection>
          <PanelSection title="کنترل">
            <Field label="برچسب اسلایدر">
              <Input
                value={str(element.content.label, "بکشید")}
                onChange={(e) => setContent({ label: e.target.value })}
              />
            </Field>
            <NumberField
              label="گردی گوشه"
              value={element.styles.borderRadius}
              min={0}
              max={80}
              onChange={(n) =>
                onChange(patchStyles(element, { borderRadius: n }))
              }
            />
          </PanelSection>
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}

      {element.type === "video" ? (
        <>
          <PanelSection title="منبع ویدیو">
            <LandingMediaUploader
              kind="video"
              src={
                str(element.content.videoSrc || element.content.videoUrl) || null
              }
              storageKey={str(element.content.videoKey) || null}
              onChange={({ key, url }) =>
                setContent({ videoKey: key, videoSrc: url, videoUrl: url })
              }
            />
            <UrlField
              label="یا آدرس ویدیو"
              value={str(element.content.videoUrl)}
              onChange={(v) => setContent({ videoUrl: v, videoSrc: v })}
            />
            <Field label="تصویر پوستر">
              <ResponsiveImageFields
                compact
                desktopSrc={str(element.content.posterSrc) || null}
                desktopKey={str(element.content.posterKey) || null}
                mobileSrc={str(element.content.mobilePosterSrc) || null}
                mobileKey={str(element.content.mobilePosterKey) || null}
                onDesktopChange={({ key, url }) =>
                  setContent({ posterKey: key, posterSrc: url })
                }
                onMobileChange={({ key, url }) =>
                  setContent({ mobilePosterKey: key, mobilePosterSrc: url })
                }
              />
            </Field>
          </PanelSection>
          <PanelSection title="پخش">
            <ToggleRow
              label="پخش خودکار (با صدا خاموش)"
              checked={bool(element.content.autoplay)}
              onChange={(v) => setContent({ autoplay: v, muted: true })}
            />
            <ToggleRow
              label="بی‌صدا"
              checked={bool(element.content.muted, true)}
              onChange={(v) => setContent({ muted: v })}
            />
            <ToggleRow
              label="تکرار"
              checked={bool(element.content.loop)}
              onChange={(v) => setContent({ loop: v })}
            />
            <ToggleRow
              label="نمایش کنترل‌ها"
              checked={bool(element.content.controls, true)}
              onChange={(v) => setContent({ controls: v })}
            />
          </PanelSection>
          <BoxControls
            element={element}
            onChange={onChange}
            showBackground={false}
            showBorder={false}
          />
          <SpacingControls element={element} onChange={onChange} />
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}

      {element.type === "audio" ? (
        <>
          <PanelSection title="فایل صوتی">
            <LandingMediaUploader
              kind="audio"
              src={
                str(element.content.audioSrc || element.content.audioUrl) || null
              }
              storageKey={str(element.content.audioKey) || null}
              onChange={({ key, url }) =>
                setContent({ audioKey: key, audioSrc: url, audioUrl: url })
              }
            />
            <Field label="عنوان">
              <Input
                value={str(element.content.title)}
                onChange={(e) => setContent({ title: e.target.value })}
              />
            </Field>
            <ToggleRow
              label="تکرار"
              checked={bool(element.content.loop)}
              onChange={(v) => setContent({ loop: v })}
            />
          </PanelSection>
          <SpacingControls element={element} onChange={onChange} />
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}

      {element.type === "button" || element.type === "link" ? (
        <>
          <PanelSection title="محتوا و لینک">
            <Field label="متن">
              <Input
                value={str(element.content.text)}
                onChange={(e) => setContent({ text: e.target.value })}
              />
            </Field>
            <UrlField
              label="آدرس / صفحه داخلی"
              value={str(element.content.url)}
              onChange={(v) => setContent({ url: v })}
              placeholder="#contact یا /page"
            />
            <ToggleRow
              label="باز شدن در تب جدید"
              checked={bool(element.content.openInNewTab)}
              onChange={(v) => setContent({ openInNewTab: v })}
            />
          </PanelSection>
          <PanelSection title="سبک دکمه">
            <Field label="نوع دکمه">
              <Select
                value={str(element.content.variant, "brand")}
                onValueChange={(v) => setContent({ variant: v })}
              >
                <SelectTrigger dir="rtl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="brand">اصلی</SelectItem>
                  <SelectItem value="outline">حاشیه‌دار</SelectItem>
                  <SelectItem value="secondary">ثانویه</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="تراز">
              <Select
                value={element.styles.align}
                onValueChange={(v) =>
                  onChange(
                    patchStyles(element, {
                      align: v as LandingElement["styles"]["align"],
                    }),
                  )
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
            <ColorField
              label="رنگ متن (اختیاری)"
              value={element.styles.color}
              onChange={(v) => onChange(patchStyles(element, { color: v }))}
            />
            <ColorField
              label="رنگ پس‌زمینه (اختیاری)"
              value={element.styles.backgroundColor}
              fallback="#d4af37"
              onChange={(v) =>
                onChange(patchStyles(element, { backgroundColor: v }))
              }
            />
            <NumberField
              label="گردی گوشه"
              value={element.styles.borderRadius}
              min={0}
              max={80}
              onChange={(n) =>
                onChange(patchStyles(element, { borderRadius: n }))
              }
            />
            <NumberField
              label="پدینگ"
              value={element.styles.padding}
              min={0}
              max={40}
              onChange={(n) => onChange(patchStyles(element, { padding: n }))}
            />
          </PanelSection>
          <SpacingControls
            element={element}
            onChange={onChange}
            showPadding={false}
            showWidth={false}
          />
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}

      {element.type === "icon" || element.type === "icon-button" ? (
        <>
          <PanelSection title="آیکون">
            <Field label="انتخاب آیکون">
              <Select
                value={str(
                  element.content.name,
                  element.type === "icon-button" ? "ArrowLeft" : "Sparkles",
                )}
                onValueChange={(v) => setContent({ name: v })}
              >
                <SelectTrigger dir="rtl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {ICON_OPTIONS.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <NumberField
              label="اندازه"
              value={num(
                element.content.size,
                element.type === "icon-button" ? 40 : 32,
              )}
              min={12}
              max={96}
              onChange={(n) => setContent({ size: n })}
            />
            <ColorField
              label="رنگ"
              value={element.styles.color}
              onChange={(v) => onChange(patchStyles(element, { color: v }))}
            />
          </PanelSection>
          <PanelSection title="لینک">
            <UrlField
              label="آدرس"
              value={str(element.content.url)}
              onChange={(v) => setContent({ url: v })}
            />
            {element.type === "icon-button" ? (
              <>
                <ToggleRow
                  label="باز شدن در تب جدید"
                  checked={bool(element.content.openInNewTab)}
                  onChange={(v) => setContent({ openInNewTab: v })}
                />
                <Field label="سبک دکمه">
                  <Select
                    value={str(element.content.variant, "brand")}
                    onValueChange={(v) => setContent({ variant: v })}
                  >
                    <SelectTrigger dir="rtl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="brand">اصلی</SelectItem>
                      <SelectItem value="outline">حاشیه‌دار</SelectItem>
                      <SelectItem value="secondary">ثانویه</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </>
            ) : null}
          </PanelSection>
          <Field label="تراز">
            <Select
              value={element.styles.align}
              onValueChange={(v) =>
                onChange(
                  patchStyles(element, {
                    align: v as LandingElement["styles"]["align"],
                  }),
                )
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
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}

      {element.type === "social-links" ? (
        <>
          <PanelSection title="شبکه‌های اجتماعی">
            <CardItemsEditor
              items={(element.content.items as Record<string, unknown>[]) || []}
              onChange={(items) => setContent({ items })}
              fields={[
                { key: "platform", label: "پلتفرم (instagram, telegram, …)" },
                { key: "url", label: "آدرس" },
              ]}
            />
          </PanelSection>
          <NumberField
            label="فاصله بین آیکون‌ها"
            value={element.styles.gap}
            min={4}
            max={48}
            onChange={(n) => onChange(patchStyles(element, { gap: n }))}
          />
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}

      {element.type === "whatsapp-cta" ? (
        <>
          <PanelSection title="واتساپ">
            <Field label="شماره (با کد کشور)" hint="مثال: 989123456789">
              <Input
                dir="ltr"
                className="text-start"
                value={str(element.content.phone)}
                onChange={(e) =>
                  setContent({ phone: e.target.value.replace(/[^\d]/g, "") })
                }
              />
            </Field>
            <Field label="پیام پیش‌فرض">
              <Textarea
                value={str(element.content.message)}
                onChange={(e) => setContent({ message: e.target.value })}
                rows={2}
              />
            </Field>
            <Field label="متن دکمه">
              <Input
                value={str(element.content.text)}
                onChange={(e) => setContent({ text: e.target.value })}
              />
            </Field>
          </PanelSection>
          <Field label="تراز">
            <Select
              value={element.styles.align}
              onValueChange={(v) =>
                onChange(
                  patchStyles(element, {
                    align: v as LandingElement["styles"]["align"],
                  }),
                )
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
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}

      {element.type === "accordion" || element.type === "faq" ? (
        <>
          <PanelSection
            title={element.type === "faq" ? "سوالات متداول" : "آکاردئون"}
          >
            <CardItemsEditor
              items={(element.content.items as Record<string, unknown>[]) || []}
              onChange={(items) => setContent({ items })}
              fields={[
                { key: "question", label: "سوال" },
                { key: "answer", label: "پاسخ", multiline: true },
              ]}
            />
          </PanelSection>
          <SpacingControls
            element={element}
            onChange={onChange}
            showGap
            showPadding={false}
          />
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}

      {element.type === "tabs" ? (
        <>
          <PanelSection title="تب‌ها">
            <CardItemsEditor
              items={(element.content.items as Record<string, unknown>[]) || []}
              onChange={(items) => setContent({ items })}
              fields={[
                { key: "label", label: "عنوان تب" },
                { key: "content", label: "محتوا", multiline: true },
              ]}
            />
          </PanelSection>
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}

      {element.type === "countdown" ? (
        <>
          <PanelSection title="شمارش معکوس">
            <Field label="تاریخ و زمان هدف">
              <Input
                type="datetime-local"
                dir="ltr"
                className="text-start"
                value={str(element.content.targetDate).slice(0, 16)}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setContent({
                    targetDate: new Date(e.target.value).toISOString(),
                  });
                }}
              />
            </Field>
          </PanelSection>
          <TypographyControls
            element={element}
            onChange={onChange}
            showLineHeight={false}
            showWeight={false}
          />
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}

      {element.type === "columns" || element.type === "grid" ? (
        <>
          <PanelSection title="چیدمان ردیف">
            <NumberField
              label="تعداد ستون"
              value={
                element.type === "grid"
                  ? num(element.content.columns, 3)
                  : num(element.content.count, 2)
              }
              min={element.type === "grid" ? 1 : 2}
              max={4}
              onChange={(n) => {
                const count = Math.min(4, Math.max(1, n));
                const cols = [...(element.columns || [])];
                while (cols.length < count) cols.push([]);
                onChange({
                  ...element,
                  content:
                    element.type === "grid"
                      ? { ...element.content, columns: count }
                      : { ...element.content, count },
                  columns: cols.slice(0, count),
                });
              }}
              hint="عناصر را با درگ به چپ/راست در یک ردیف قرار دهید"
            />
            <NumberField
              label="فاصله ستون‌ها"
              value={element.styles.gap}
              min={0}
              max={48}
              onChange={(n) => onChange(patchStyles(element, { gap: n }))}
            />
          </PanelSection>
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}

      {element.type === "feature-cards" ||
      element.type === "pricing-cards" ||
      element.type === "testimonial-cards" ||
      element.type === "team-cards" ||
      element.type === "stats" ||
      element.type === "timeline" ? (
        <>
          <PanelSection title="موارد">
            <CardItemsEditor
              items={(element.content.items as Record<string, unknown>[]) || []}
              onChange={(items) => setContent({ items })}
              withImage={element.type === "team-cards"}
              fields={
                element.type === "stats"
                  ? [
                      { key: "value", label: "مقدار" },
                      { key: "label", label: "برچسب" },
                    ]
                  : element.type === "timeline"
                    ? [
                        { key: "date", label: "تاریخ" },
                        { key: "title", label: "عنوان" },
                        { key: "description", label: "توضیح", multiline: true },
                      ]
                    : element.type === "testimonial-cards"
                      ? [
                          { key: "quote", label: "نظر", multiline: true },
                          { key: "author", label: "نام" },
                          { key: "role", label: "سمت" },
                        ]
                      : element.type === "team-cards"
                        ? [
                            { key: "name", label: "نام" },
                            { key: "role", label: "سمت" },
                          ]
                        : element.type === "pricing-cards"
                          ? [
                              { key: "title", label: "عنوان" },
                              { key: "price", label: "قیمت" },
                              { key: "description", label: "توضیح" },
                              { key: "badge", label: "نشان" },
                              { key: "url", label: "لینک" },
                            ]
                          : [
                              { key: "title", label: "عنوان" },
                              {
                                key: "description",
                                label: "توضیح",
                                multiline: true,
                              },
                              { key: "icon", label: "آیکون" },
                            ]
              }
            />
          </PanelSection>
          <SpacingControls
            element={element}
            onChange={onChange}
            showGap
            showPadding={false}
          />
          {element.type === "stats" ? (
            <ColorField
              label="رنگ متن"
              value={element.styles.color}
              onChange={(v) => onChange(patchStyles(element, { color: v }))}
            />
          ) : null}
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}

      {![
        "heading",
        "paragraph",
        "text",
        "quote",
        "list",
        "divider",
        "spacer",
        "image",
        "gallery",
        "slider",
        "before-after",
        "video",
        "audio",
        "button",
        "link",
        "icon",
        "icon-button",
        "social-links",
        "whatsapp-cta",
        "accordion",
        "faq",
        "tabs",
        "countdown",
        "columns",
        "grid",
        "feature-cards",
        "pricing-cards",
        "testimonial-cards",
        "team-cards",
        "stats",
        "timeline",
      ].includes(element.type) ? (
        <>
          <p className="py-2 text-[11px] text-muted-foreground">
            این نوع عنصر تنظیمات اختصاصی ندارد. می‌توانید نام لایه و نمایش آن را
            ویرایش کنید.
          </p>
          <VisibilityControls element={element} onChange={onChange} />
        </>
      ) : null}
    </div>
  );
}
