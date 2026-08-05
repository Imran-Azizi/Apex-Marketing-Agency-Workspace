"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type FormatOption = { id: string; name: string; ratio: string };

export type AspectRatioValue = {
  formatId: string;
  customRatio?: string;
};

const ASPECT_META: Record<
  string,
  { title: string; description: string; w: number; h: number }
> = {
  "16:9": {
    title: "۱۶:۹ افقی",
    description: "یوتیوب، وب، تلویزیون",
    w: 16,
    h: 9,
  },
  "9:16": {
    title: "۹:۱۶ عمودی",
    description: "ریلز، شورتز، تیک‌تاک",
    w: 9,
    h: 16,
  },
  "1:1": {
    title: "۱:۱ مربعی",
    description: "فید اینستاگرام / پست",
    w: 1,
    h: 1,
  },
  "4:5": {
    title: "۴:۵ پرتره",
    description: "اینستاگرام پرتره",
    w: 4,
    h: 5,
  },
  "3:4": {
    title: "۳:۴ پرتره",
    description: "پرتره عمومی",
    w: 3,
    h: 4,
  },
  "21:9": {
    title: "۲۱:۹ سینمایی",
    description: "نمای عریض سینمایی",
    w: 21,
    h: 9,
  },
};

const ORDERED_RATIOS = ["16:9", "9:16", "1:1", "4:5", "3:4", "21:9"] as const;

type AspectRatioSelectorProps = {
  formats: FormatOption[];
  value: AspectRatioValue;
  onChange: (next: AspectRatioValue) => void;
  className?: string;
};

function RatioPreview({ w, h, active }: { w: number; h: number; active: boolean }) {
  const max = 36;
  const scale = max / Math.max(w, h);
  const width = Math.max(10, Math.round(w * scale));
  const height = Math.max(10, Math.round(h * scale));
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted/60">
      <span
        className={cn(
          "block rounded-[2px] border-2",
          active ? "border-brand bg-brand/15" : "border-muted-foreground/40 bg-background",
        )}
        style={{ width, height }}
        aria-hidden
      />
    </div>
  );
}

function parseCustomRatio(raw: string): string | null {
  const cleaned = raw.trim().replace(/\s+/g, "").replace("×", ":").replace("x", ":").replace("/", ":");
  const m = cleaned.match(/^(\d{1,3}):(\d{1,3})$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a < 1 || b < 1 || a > 100 || b > 100) return null;
  return `${a}:${b}`;
}

export function AspectRatioSelector({
  formats,
  value,
  onChange,
  className,
}: AspectRatioSelectorProps) {
  const byRatio = useMemo(() => {
    const map = new Map<string, FormatOption>();
    for (const f of formats) map.set(f.ratio, f);
    return map;
  }, [formats]);

  const [customDraft, setCustomDraft] = useState(
    value.customRatio && !ORDERED_RATIOS.includes(value.customRatio as (typeof ORDERED_RATIOS)[number])
      ? value.customRatio
      : "",
  );
  const [customError, setCustomError] = useState<string | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(
    Boolean(
      value.customRatio &&
        !ORDERED_RATIOS.includes(value.customRatio as (typeof ORDERED_RATIOS)[number]),
    ),
  );

  const selectedRatio = useMemo(() => {
    if (showCustomInput) return "custom";
    if (value.customRatio) {
      if (ORDERED_RATIOS.includes(value.customRatio as (typeof ORDERED_RATIOS)[number])) {
        return value.customRatio;
      }
      return "custom";
    }
    const found = formats.find((f) => f.id === value.formatId);
    return found?.ratio || "";
  }, [formats, showCustomInput, value]);

  function selectRatio(ratio: string) {
    const format = byRatio.get(ratio);
    setCustomError(null);
    setCustomDraft("");
    setShowCustomInput(false);
    if (format) {
      onChange({ formatId: format.id, customRatio: undefined });
      return;
    }
    // Catalog may not have every ratio yet — persist via customAspectRatio.
    onChange({ formatId: "", customRatio: ratio });
  }

  function selectCustom() {
    setShowCustomInput(true);
    onChange({ formatId: "", customRatio: customDraft || undefined });
  }

  function commitCustom(raw: string) {
    setCustomDraft(raw);
    setShowCustomInput(true);
    const parsed = parseCustomRatio(raw);
    if (!raw.trim()) {
      setCustomError(null);
      onChange({ formatId: "", customRatio: undefined });
      return;
    }
    if (!parsed) {
      setCustomError("نسبت معتبر نیست. مثال: 2:1 یا 5:4");
      return;
    }
    const existing = byRatio.get(parsed);
    if (existing) {
      setCustomError(null);
      setShowCustomInput(false);
      onChange({ formatId: existing.id, customRatio: undefined });
      return;
    }
    setCustomError(null);
    onChange({ formatId: "", customRatio: parsed });
  }

  return (
    <div className={cn("space-y-3 sm:col-span-2", className)}>
      <div>
        <Label>نسبت تصویر</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          اندازه ویدیو را بر اساس پلتفرم هدف انتخاب کنید.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {ORDERED_RATIOS.map((ratio) => {
          const meta = ASPECT_META[ratio];
          const active = selectedRatio === ratio;
          return (
            <button
              key={ratio}
              type="button"
              title={meta.description}
              onClick={() => selectRatio(ratio)}
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-3 text-start transition-colors",
                active
                  ? "border-brand bg-brand/5 ring-1 ring-brand"
                  : "hover:border-brand/40 hover:bg-muted/40",
              )}
            >
              <div className="flex items-center gap-2">
                <RatioPreview w={meta.w} h={meta.h} active={active} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight" dir="ltr">
                    {ratio}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{meta.title}</div>
                </div>
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">{meta.description}</p>
            </button>
          );
        })}

        <button
          type="button"
          title="نسبت سفارشی"
          onClick={selectCustom}
          className={cn(
            "flex flex-col gap-2 rounded-lg border p-3 text-start transition-colors",
            selectedRatio === "custom"
              ? "border-brand bg-brand/5 ring-1 ring-brand"
              : "hover:border-brand/40 hover:bg-muted/40",
          )}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted/60 text-xs font-bold text-muted-foreground">
              ?
            </div>
            <div>
              <div className="text-sm font-semibold">سفارشی</div>
              <div className="text-xs text-muted-foreground">Custom Ratio</div>
            </div>
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">نسبت دلخواه خود را وارد کنید</p>
        </button>
      </div>

      {(selectedRatio === "custom" || showCustomInput) && (
        <div className="space-y-1 rounded-lg border bg-muted/30 p-3">
          <Label className="text-xs text-muted-foreground">نسبت سفارشی (عرض:ارتفاع)</Label>
          <Input
            dir="ltr"
            placeholder="مثلاً 2:1"
            value={customDraft}
            onChange={(e) => commitCustom(e.target.value)}
          />
          {customError && <p className="text-xs text-destructive">{customError}</p>}
        </div>
      )}

      {/* Formats from API that aren't in the curated list */}
      {formats.some((f) => !ORDERED_RATIOS.includes(f.ratio as (typeof ORDERED_RATIOS)[number])) && (
        <div className="flex flex-wrap gap-2">
          {formats
            .filter((f) => !ORDERED_RATIOS.includes(f.ratio as (typeof ORDERED_RATIOS)[number]))
            .map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onChange({ formatId: f.id, customRatio: undefined })}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs",
                  value.formatId === f.id ? "border-brand bg-brand/5" : "hover:bg-muted/40",
                )}
              >
                {f.name || f.ratio} ({f.ratio})
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
