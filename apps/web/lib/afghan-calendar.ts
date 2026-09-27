import { toEnglishDigits } from "@/lib/utils";

/**
 * Afghan Solar Hijri (Jalali) calendar.
 *
 * Month names are the Afghan set (حمل … حوت), not the Iranian set.
 * Day and year numbers stay in English digits.
 *
 * Conversion uses Kazimierz M. Borkowski's arithmetic calendar (the same
 * algorithm as jalaali-js). It agrees with `Intl` calendar "persian" for
 * every civil day in the range this app uses, and it round-trips exactly,
 * so a picked day cannot shift by one when it is sent to the API.
 *
 * Stored and filtered values stay Gregorian `YYYY-MM-DD` civil dates.
 * Instants from the API are read as the calendar day in Asia/Kabul.
 */

export const AFGHAN_MONTHS = [
  "حمل",
  "ثور",
  "جوزا",
  "سرطان",
  "اسد",
  "سنبله",
  "میزان",
  "عقرب",
  "قوس",
  "جدی",
  "دلو",
  "حوت",
] as const;

/** Saturday-first, matching the Afghan week. */
export const AFGHAN_WEEKDAYS_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;

export const AFGHAN_TIME_ZONE = "Asia/Kabul";

const MONTH_INDEX = new Map<string, number>(
  AFGHAN_MONTHS.map((name, index) => [name, index + 1]),
);

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
  2192, 2262, 2324, 2394, 2456, 3178,
] as const;

const MIN_JALAALI_YEAR = BREAKS[0];
const MAX_JALAALI_YEAR = BREAKS[BREAKS.length - 1] - 1;

export interface AfghanDate {
  jy: number;
  jm: number;
  jd: number;
}

export interface GregorianDate {
  gy: number;
  gm: number;
  gd: number;
}

function div(a: number, b: number): number {
  return ~~(a / b);
}

function mod(a: number, b: number): number {
  return a - ~~(a / b) * b;
}

interface JalCalCore {
  gy: number;
  march: number;
  jump: number;
  n: number;
}

function jalCalCore(jy: number): JalCalCore {
  if (!Number.isFinite(jy) || jy < MIN_JALAALI_YEAR || jy > MAX_JALAALI_YEAR) {
    throw new RangeError(`Invalid Afghan year ${jy}`);
  }

  const gy = jy + 621;
  let leapJ = -14;
  let jp: number = BREAKS[0];
  let jm = 0;
  let jump = 0;

  for (let i = 1; i < BREAKS.length; i += 1) {
    jm = BREAKS[i] as number;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  const n = jy - jp;

  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  return { gy, march, jump, n };
}

function leapFromCycle(jump: number, n: number): number {
  let adjusted = n;
  if (jump - n < 6) {
    adjusted = n - jump + div(jump + 4, 33) * 33;
  }
  let leap = mod(mod(adjusted + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return leap;
}

function jalCalLeap(jy: number): number {
  if (!Number.isFinite(jy) || jy < MIN_JALAALI_YEAR || jy > MAX_JALAALI_YEAR) {
    throw new RangeError(`Invalid Afghan year ${jy}`);
  }
  let jp: number = BREAKS[0];
  let jm = 0;
  let jump = 0;
  for (let i = 1; i < BREAKS.length; i += 1) {
    jm = BREAKS[i] as number;
    jump = jm - jp;
    if (jy < jm) break;
    jp = jm;
  }
  return leapFromCycle(jump, jy - jp);
}

export function isLeapAfghanYear(jy: number): boolean {
  return jalCalLeap(jy) === 0;
}

export function afghanMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapAfghanYear(jy) ? 30 : 29;
}

export function isValidAfghanDate(jy: number, jm: number, jd: number): boolean {
  return (
    Number.isInteger(jy) &&
    Number.isInteger(jm) &&
    Number.isInteger(jd) &&
    jy >= MIN_JALAALI_YEAR &&
    jy <= MAX_JALAALI_YEAR &&
    jm >= 1 &&
    jm <= 12 &&
    jd >= 1 &&
    jd <= afghanMonthLength(jy, jm)
  );
}

function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number): GregorianDate {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCalCore(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

const FIRST_JALAALI_JDN = j2d(MIN_JALAALI_YEAR, 1, 1);
const LAST_JALAALI_JDN = j2d(
  MAX_JALAALI_YEAR,
  12,
  afghanMonthLength(MAX_JALAALI_YEAR, 12),
);

function d2j(jdn: number): AfghanDate {
  if (jdn < FIRST_JALAALI_JDN || jdn > LAST_JALAALI_JDN) {
    throw new RangeError(`Julian day ${jdn} is outside the Afghan calendar`);
  }

  const gy = d2g(jdn).gy;
  let jy = Math.min(gy - 621, MAX_JALAALI_YEAR);
  const r = jalCalCore(jy);
  const leap = leapFromCycle(r.jump, r.n);
  const jdn1f = g2d(r.gy, 3, r.march);

  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

export function isRealGregorianDate(gy: number, gm: number, gd: number): boolean {
  if (!Number.isInteger(gy) || !Number.isInteger(gm) || !Number.isInteger(gd)) {
    return false;
  }
  if (gm < 1 || gm > 12 || gd < 1 || gd > 31) return false;
  const date = new Date(gy, gm - 1, gd, 12, 0, 0, 0);
  return date.getFullYear() === gy && date.getMonth() === gm - 1 && date.getDate() === gd;
}

export function gregorianToAfghan(gy: number, gm: number, gd: number): AfghanDate | null {
  if (!isRealGregorianDate(gy, gm, gd)) return null;
  try {
    const afghan = d2j(g2d(gy, gm, gd));
    return isValidAfghanDate(afghan.jy, afghan.jm, afghan.jd) ? afghan : null;
  } catch {
    return null;
  }
}

export function afghanToGregorian(jy: number, jm: number, jd: number): GregorianDate | null {
  if (!isValidAfghanDate(jy, jm, jd)) return null;
  try {
    const gregorian = d2g(j2d(jy, jm, jd));
    return isRealGregorianDate(gregorian.gy, gregorian.gm, gregorian.gd)
      ? gregorian
      : null;
  } catch {
    return null;
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Gregorian civil date used by the expenses API (`YYYY-MM-DD`). */
export function toGregorianInputValue(jy: number, jm: number, jd: number): string | null {
  const gregorian = afghanToGregorian(jy, jm, jd);
  if (!gregorian) return null;
  return `${gregorian.gy}-${pad2(gregorian.gm)}-${pad2(gregorian.gd)}`;
}

export function formatAfghanParts(jy: number, jm: number, jd: number): string {
  const month = AFGHAN_MONTHS[jm - 1];
  if (!month) return "";
  return `${jy} ${month} ${pad2(jd)}`;
}

export function formatAfghanMonthYear(jy: number, jm: number): string {
  const month = AFGHAN_MONTHS[jm - 1];
  if (!month) return `${jm} ${jy}`;
  return `${month} ${jy}`;
}

export function afghanMonthGregorianBounds(
  jy: number,
  jm: number,
): { fromIso: string; toIso: string } | null {
  const start = afghanToGregorian(jy, jm, 1);
  const end = afghanToGregorian(jy, jm, afghanMonthLength(jy, jm));
  if (!start || !end) return null;
  return {
    fromIso: `${start.gy}-${pad2(start.gm)}-${pad2(start.gd)}`,
    toIso: `${end.gy}-${pad2(end.gm)}-${pad2(end.gd)}`,
  };
}

/**
 * Calendar day for a stored value.
 * `YYYY-MM-DD` is that civil date (no timezone).
 * A timestamp is the calendar day in Afghanistan (Asia/Kabul), so UTC midnight
 * and Kabul-local midnight both stay on the day the user picked.
 */
export function civilGregorianParts(
  value: string | Date | null | undefined,
): GregorianDate | null {
  if (value == null || value === "") return null;

  if (typeof value === "string") {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (dateOnly) {
      const gy = Number(dateOnly[1]);
      const gm = Number(dateOnly[2]);
      const gd = Number(dateOnly[3]);
      return isRealGregorianDate(gy, gm, gd) ? { gy, gm, gd } : null;
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: AFGHAN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const gy = Number(parts.find((part) => part.type === "year")?.value);
  const gm = Number(parts.find((part) => part.type === "month")?.value);
  const gd = Number(parts.find((part) => part.type === "day")?.value);
  return isRealGregorianDate(gy, gm, gd) ? { gy, gm, gd } : null;
}

export function formatStoredDateAsAfghan(
  value: string | Date | null | undefined,
): string {
  const gregorian = civilGregorianParts(value);
  if (!gregorian) return "—";
  const afghan = gregorianToAfghan(gregorian.gy, gregorian.gm, gregorian.gd);
  if (!afghan) return "—";
  return formatAfghanParts(afghan.jy, afghan.jm, afghan.jd);
}

export function afghanFromGregorianInput(value: string): AfghanDate | null {
  const gregorian = civilGregorianParts(value);
  if (!gregorian) return null;
  return gregorianToAfghan(gregorian.gy, gregorian.gm, gregorian.gd);
}

export function localTodayGregorian(): GregorianDate {
  const now = new Date();
  return {
    gy: now.getFullYear(),
    gm: now.getMonth() + 1,
    gd: now.getDate(),
  };
}

export function localTodayAfghan(): AfghanDate | null {
  const today = localTodayGregorian();
  return gregorianToAfghan(today.gy, today.gm, today.gd);
}

/** Saturday = 0 … Friday = 6. Noon avoids a DST midnight skip. */
export function afghanWeekdayIndex(jy: number, jm: number, jd: number): number | null {
  const gregorian = afghanToGregorian(jy, jm, jd);
  if (!gregorian) return null;
  const date = new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd, 12, 0, 0, 0);
  return (date.getDay() + 1) % 7;
}

export function addAfghanMonths(
  jy: number,
  jm: number,
  delta: number,
): { jy: number; jm: number } {
  const index = jy * 12 + (jm - 1) + delta;
  const year = Math.floor(index / 12);
  const month = ((index % 12) + 12) % 12;
  return { jy: year, jm: month + 1 };
}

export interface AfghanMonthCell extends AfghanDate {
  inMonth: boolean;
}

export function buildAfghanMonthGrid(jy: number, jm: number): AfghanMonthCell[] {
  const cells: AfghanMonthCell[] = [];
  const offset = afghanWeekdayIndex(jy, jm, 1) ?? 0;
  const previous = addAfghanMonths(jy, jm, -1);
  const previousLength = afghanMonthLength(previous.jy, previous.jm);

  for (let i = 0; i < offset; i += 1) {
    cells.push({
      jy: previous.jy,
      jm: previous.jm,
      jd: previousLength - offset + 1 + i,
      inMonth: false,
    });
  }

  const length = afghanMonthLength(jy, jm);
  for (let jd = 1; jd <= length; jd += 1) {
    cells.push({ jy, jm, jd, inMonth: true });
  }

  const next = addAfghanMonths(jy, jm, 1);
  let jd = 1;
  while (cells.length < 42) {
    cells.push({ jy: next.jy, jm: next.jm, jd, inMonth: false });
    jd += 1;
  }

  return cells;
}

function canonicalMonthName(token: string): string {
  return token
    .replace(/[\u200c\u200d]/g, "")
    .replace(/\u06c0/g, "\u0647")
    .replace(/\u0647\u0654/g, "\u0647")
    .replace(/\u0654/g, "")
    .trim();
}

function monthIndexFromName(token: string): number | null {
  return MONTH_INDEX.get(canonicalMonthName(token)) ?? null;
}

/**
 * Accepts the displayed form and numeric entry:
 * `1405 سنبله 05`, `05 سنبله 1405`, `1405/06/05`, `1405-6-5`.
 */
export function parseAfghanDateInput(raw: string): AfghanDate | null {
  const text = toEnglishDigits(raw).trim().replace(/\s+/g, " ");
  if (!text) return null;

  const named = /^(\d{1,4}) ([^\d\s]+) (\d{1,4})$/.exec(text);
  if (named) {
    const left = Number(named[1]);
    const month = monthIndexFromName(named[2]);
    const right = Number(named[3]);
    if (!month) return null;
    const yearFirst = left >= 1000;
    const dayFirst = right >= 1000;
    if (yearFirst === dayFirst) return null;
    const jy = yearFirst ? left : right;
    const jd = yearFirst ? right : left;
    return isValidAfghanDate(jy, month, jd) ? { jy, jm: month, jd } : null;
  }

  const numeric = /^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})$/.exec(text);
  if (!numeric) return null;

  const a = Number(numeric[1]);
  const b = Number(numeric[2]);
  const c = Number(numeric[3]);
  const yearFirst = a >= 1000;
  const dayFirst = c >= 1000 && a < 1000;
  if (!yearFirst && !dayFirst) return null;
  const jy = yearFirst ? a : c;
  const jm = b;
  const jd = yearFirst ? c : a;
  return isValidAfghanDate(jy, jm, jd) ? { jy, jm, jd } : null;
}
