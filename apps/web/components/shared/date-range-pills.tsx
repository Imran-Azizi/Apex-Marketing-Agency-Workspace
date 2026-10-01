"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AfghanDateField } from "@/components/shared/afghan-date-field";
import { cn } from "@/lib/utils";
import { formatStoredDateAsAfghan } from "@/lib/afghan-calendar";
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
  const start = formatStoredDateAsAfghan(toLocalDateString(from));
  const end = formatStoredDateAsAfghan(toLocalDateString(to));
  if (start === "—" || end === "—") return null;
  return start === end ? start : `${start} – ${end}`;
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
          <div className="space-y-1">
            <Label
              htmlFor="dashboard-range-from"
              className="text-xs text-muted-foreground"
            >
              از تاریخ
            </Label>
            <AfghanDateField
              id="dashboard-range-from"
              aria-label="از تاریخ"
              value={fromValue}
              onChange={(value) =>
                onChange(
                  patchCustomDateRange(range, {
                    from: value ? parseLocalDate(value) : null,
                  }),
                )
              }
              className="w-[13.5rem] max-w-full"
            />
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="dashboard-range-to"
              className="text-xs text-muted-foreground"
            >
              تا تاریخ
            </Label>
            <AfghanDateField
              id="dashboard-range-to"
              aria-label="تا تاریخ"
              value={toValue}
              onChange={(value) =>
                onChange(
                  patchCustomDateRange(range, {
                    to: value ? parseLocalDate(value) : null,
                  }),
                )
              }
              className="w-[13.5rem] max-w-full"
            />
          </div>
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
