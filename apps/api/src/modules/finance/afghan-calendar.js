/**
 * Afghan Solar Hijri (Jalali) arithmetic calendar — Borkowski algorithm.
 * Used so PnL month filters map to exact Gregorian civil-day bounds
 * without timezone shifts (local noon-safe Date construction).
 */

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
  2192, 2262, 2324, 2394, 2456, 3178,
];

const MIN_JALAALI_YEAR = BREAKS[0];
const MAX_JALAALI_YEAR = BREAKS[BREAKS.length - 1] - 1;

/** Afghan Solar Hijri years used by this product (distinct from Gregorian ≥ 1700). */
export const AFGHAN_YEAR_MIN = 1300;
export const AFGHAN_YEAR_MAX = 1600;

export const AFGHAN_MONTHS = [
  'حمل',
  'ثور',
  'جوزا',
  'سرطان',
  'اسد',
  'سنبله',
  'میزان',
  'عقرب',
  'قوس',
  'جدی',
  'دلو',
  'حوت',
];

function div(a, b) {
  return ~~(a / b);
}

function mod(a, b) {
  return a - ~~(a / b) * b;
}

function jalCalCore(jy) {
  if (!Number.isFinite(jy) || jy < MIN_JALAALI_YEAR || jy > MAX_JALAALI_YEAR) {
    throw new RangeError(`Invalid Afghan year ${jy}`);
  }
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jm = 0;
  let jump = 0;
  for (let i = 1; i < BREAKS.length; i += 1) {
    jm = BREAKS[i];
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

function leapFromCycle(jump, n) {
  let adjusted = n;
  if (jump - n < 6) {
    adjusted = n - jump + div(jump + 4, 33) * 33;
  }
  let leap = mod(mod(adjusted + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return leap;
}

function jalCalLeap(jy) {
  let jp = BREAKS[0];
  let jm = 0;
  let jump = 0;
  for (let i = 1; i < BREAKS.length; i += 1) {
    jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    jp = jm;
  }
  return leapFromCycle(jump, jy - jp);
}

export function isLeapAfghanYear(jy) {
  return jalCalLeap(jy) === 0;
}

export function afghanMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapAfghanYear(jy) ? 30 : 29;
}

export function isValidAfghanDate(jy, jm, jd) {
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

function g2d(gy, gm, gd) {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy, jm, jd) {
  const r = jalCalCore(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

const FIRST_JALAALI_JDN = j2d(MIN_JALAALI_YEAR, 1, 1);
const LAST_JALAALI_JDN = j2d(
  MAX_JALAALI_YEAR,
  12,
  afghanMonthLength(MAX_JALAALI_YEAR, 12),
);

function d2j(jdn) {
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

export function isAfghanYear(year) {
  const y = Number(year);
  return Number.isInteger(y) && y >= AFGHAN_YEAR_MIN && y <= AFGHAN_YEAR_MAX;
}

export function afghanToGregorian(jy, jm, jd) {
  if (!isValidAfghanDate(jy, jm, jd)) return null;
  try {
    return d2g(j2d(jy, jm, jd));
  } catch {
    return null;
  }
}

export function gregorianToAfghan(gy, gm, gd) {
  try {
    return d2j(g2d(gy, gm, gd));
  } catch {
    return null;
  }
}

/**
 * Inclusive local civil-day bounds for an Afghan Solar Hijri month.
 * Dates are constructed in local time (same pattern as Gregorian monthBounds).
 */
export function afghanMonthBounds(year, month) {
  const jy = Number(year);
  const jm = Number(month);
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || jm < 1 || jm > 12) {
    throw new RangeError(`Invalid Afghan month ${year}-${month}`);
  }
  const start = afghanToGregorian(jy, jm, 1);
  const end = afghanToGregorian(jy, jm, afghanMonthLength(jy, jm));
  if (!start || !end) {
    throw new RangeError(`Cannot resolve Afghan month ${year}-${month}`);
  }
  return {
    from: new Date(start.gy, start.gm - 1, start.gd, 0, 0, 0, 0),
    to: new Date(end.gy, end.gm - 1, end.gd, 23, 59, 59, 999),
  };
}

/** Local "today" as Afghan Solar Hijri (host timezone civil day). */
export function localTodayAfghan(now = new Date()) {
  return gregorianToAfghan(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function formatAfghanMonthYear(year, month) {
  const name = AFGHAN_MONTHS[Number(month) - 1];
  return name ? `${name} ${year}` : `${month} ${year}`;
}
