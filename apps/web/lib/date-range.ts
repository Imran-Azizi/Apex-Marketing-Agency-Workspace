import {
  afghanMonthGregorianBounds,
  localTodayAfghan,
  localTodayGregorian,
  toGregorianInputValue,
} from "@/lib/afghan-calendar";

export type DatePreset = "all" | "today" | "week" | "month" | "year" | "custom";

export interface DateRange {
  preset: DatePreset;
  from: Date | null;
  to: Date | null;
}

export const DATE_PRESET_OPTIONS: Array<{ key: DatePreset; label: string }> = [
  { key: "all", label: "همه" },
  { key: "today", label: "امروز" },
  { key: "week", label: "این هفته" },
  { key: "month", label: "این ماه" },
  { key: "year", label: "امسال" },
  { key: "custom", label: "بازه سفارشی" },
];

export const EMPTY_DATE_RANGE: DateRange = {
  preset: "all",
  from: null,
  to: null,
};

/** Local calendar YYYY-MM-DD — never use toISOString() for date filters. */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day, 0, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Civil "today" as a local midnight Date (browser / workstation calendar day). */
export function todayStart(): Date {
  const { gy, gm, gd } = localTodayGregorian();
  return new Date(gy, gm - 1, gd, 0, 0, 0, 0);
}

/**
 * Last 7 calendar days including today.
 * Example: if today is the 9th → from the 3rd through the 9th (7 days).
 */
export function startOfLastSevenDays(d: Date = todayStart()): Date {
  const from = startOfDay(d);
  from.setDate(from.getDate() - 6);
  return from;
}

/** First day of the current Afghan (Solar Hijri) month as a local Date. */
export function startOfCurrentAfghanMonth(): Date | null {
  const afghan = localTodayAfghan();
  if (!afghan) return null;
  const bounds = afghanMonthGregorianBounds(afghan.jy, afghan.jm);
  if (!bounds) return null;
  return parseLocalDate(bounds.fromIso);
}

/** 1 حمل of the current Afghan year as a local Date. */
export function startOfCurrentAfghanYear(): Date | null {
  const afghan = localTodayAfghan();
  if (!afghan) return null;
  const iso = toGregorianInputValue(afghan.jy, 1, 1);
  if (!iso) return null;
  return parseLocalDate(iso);
}

export function resolveDateRange(range: DateRange): {
  from: Date | null;
  to: Date | null;
} {
  const now = todayStart();
  const todayEnd = endOfDay(now);

  if (range.preset === "all") return { from: null, to: null };

  if (range.preset === "custom") {
    let from = range.from ? startOfDay(range.from) : null;
    let to = range.to ? endOfDay(range.to) : null;
    if (from && to && from.getTime() > to.getTime()) {
      const originalFrom = from;
      from = startOfDay(to);
      to = endOfDay(originalFrom);
    }
    return { from, to };
  }

  if (range.preset === "today") {
    return { from: startOfDay(now), to: todayEnd };
  }

  if (range.preset === "week") {
    return { from: startOfLastSevenDays(now), to: todayEnd };
  }

  if (range.preset === "month") {
    const monthStart = startOfCurrentAfghanMonth();
    return {
      from: monthStart ? startOfDay(monthStart) : startOfDay(now),
      to: todayEnd,
    };
  }

  // year — current Afghan year from 1 حمل through today
  const yearStart = startOfCurrentAfghanYear();
  return {
    from: yearStart ? startOfDay(yearStart) : startOfDay(now),
    to: todayEnd,
  };
}

export function dateRangeQueryParams(range: DateRange): {
  from?: string;
  to?: string;
} {
  const { from, to } = resolveDateRange(range);
  const params: { from?: string; to?: string } = {};
  if (from) params.from = toLocalDateString(from);
  if (to) params.to = toLocalDateString(to);
  return params;
}

export function isDateRangeReady(range: DateRange): boolean {
  if (range.preset !== "custom") return true;
  return Boolean(range.from && range.to);
}

/** Seed custom dates from the current preset so the picker is never empty. */
export function toCustomDateRange(range: DateRange): DateRange {
  if (range.preset === "custom" && range.from && range.to) {
    return {
      preset: "custom",
      from: startOfDay(range.from),
      to: startOfDay(range.to),
    };
  }
  const resolved = resolveDateRange(range);
  if (resolved.from && resolved.to) {
    return {
      preset: "custom",
      from: startOfDay(resolved.from),
      to: startOfDay(resolved.to),
    };
  }
  const monthStart = startOfCurrentAfghanMonth();
  const now = todayStart();
  return {
    preset: "custom",
    from: monthStart ? startOfDay(monthStart) : startOfDay(now),
    to: startOfDay(now),
  };
}

export function patchCustomDateRange(
  range: DateRange,
  patch: { from?: Date | null; to?: Date | null },
): DateRange {
  let from = patch.from !== undefined ? patch.from : range.from;
  let to = patch.to !== undefined ? patch.to : range.to;
  if (from && to && startOfDay(from).getTime() > startOfDay(to).getTime()) {
    if (patch.from !== undefined) to = startOfDay(from);
    else from = startOfDay(to);
  }
  return {
    preset: "custom",
    from: from ? startOfDay(from) : null,
    to: to ? startOfDay(to) : null,
  };
}
