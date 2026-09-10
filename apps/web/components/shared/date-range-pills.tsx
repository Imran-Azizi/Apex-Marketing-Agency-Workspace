"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import {
  DATE_PRESET_OPTIONS,
  isDateRangeReady,
  parseLocalDate,
  patchCustomDateRange,
  resolveDateRange,
  toCustomDateRange,
  toLocalDateString,
  type DatePreset,
  type DateRange,
} from "@/lib/date-range";

type DateRangePillsProps = {
  range: DateRange;
  onChange: (next: DateRange) => void;
  className?: string;
  /** Accessible name for the preset group. */
  ariaLabel?: string;
  showSummary?: boolean;
};

function selectPreset(current: DateRange, key: DatePreset): DateRange {
  if (key === "custom") return toCustomDateRange(current);
  return { preset: key, from: null, to: null };
}

function rangeSummary(range: DateRange): string | null {
  if (range.preset === "all") return "نمایش همه دوره‌ها";
  if (range.preset === "custom" && !isDateRangeReady(range)) {
    return "تاریخ شروع و پایان را انتخاب کنید";
  }
  const { from, to } = resolveDateRange(range);
  if (!from || !to) return null;
  const start = formatDate(from);
  const end = formatDate(to);
  return start === end ? start : `${start} — ${end}`;
}

export function DateRangePills({
  range,
  onChange,
  className,
  ariaLabel = "فیلتر بازه زمانی",
  showSummary = true,
}: DateRangePillsProps) {
  const summary = showSummary ? rangeSummary(range) : null;
  const fromValue = range.from ? toLocalDateString(range.from) : "";
  const toValue = range.to ? toLocalDateString(range.to) : "";

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        className="flex max-w-full flex-wrap gap-2"
        role="group"
        aria-label={ariaLabel}
      >
        {DATE_PRESET_OPTIONS.map((preset) => {
          const selected = range.preset === preset.key;
          return (
            <Button
              key={preset.key}
              type="button"
              size="sm"
              variant={selected ? "brand" : "secondary"}
              className={cn(
                "h-9 shrink-0 rounded-full px-4 shadow-none",
                selected
                  ? "border-transparent"
                  : "border-transparent bg-muted/80 text-foreground hover:bg-muted",
              )}
              aria-pressed={selected}
              onClick={() => onChange(selectPreset(range, preset.key))}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>

      {range.preset === "custom" ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-xs text-muted-foreground">
            از تاریخ
            <Input
              type="date"
              className="h-9 w-auto min-w-[10.5rem]"
              dir="ltr"
              value={fromValue}
              max={toValue || undefined}
              onChange={(event) =>
                onChange(
                  patchCustomDateRange(range, {
                    from: event.target.value
                      ? parseLocalDate(event.target.value)
                      : null,
                  }),
                )
              }
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            تا تاریخ
            <Input
              type="date"
              className="h-9 w-auto min-w-[10.5rem]"
              dir="ltr"
              value={toValue}
              min={fromValue || undefined}
              onChange={(event) =>
                onChange(
                  patchCustomDateRange(range, {
                    to: event.target.value
                      ? parseLocalDate(event.target.value)
                      : null,
                  }),
                )
              }
            />
          </label>
        </div>
      ) : null}

      {summary ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {summary}
        </p>
      ) : null}
    </div>
  );
}
