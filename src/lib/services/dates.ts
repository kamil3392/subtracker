/**
 * Calendar-date arithmetic on `YYYY-MM-DD` strings, handled as year/month/day integers.
 * No `Date` is ever interpreted in the local timezone; the only timezone-aware function is
 * `todayInWarsaw`. Because the format is zero-padded and fixed-width, lexicographic string
 * comparison (`a < b`, `a >= b`) is chronological comparison.
 */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Accepted range for a subscription's renewal date (form and server validation). */
export const RENEWAL_DATE_MIN = "2000-01-01";
export const RENEWAL_DATE_MAX = "2099-12-31";

const warsawDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

interface CalendarDate {
  year: number;
  month: number; // 1–12
  day: number; // 1–31
}

function parseDate(date: string): CalendarDate {
  const match = DATE_PATTERN.exec(date);
  if (!match) {
    throw new Error(`Invalid calendar date: ${date}`);
  }
  const [, year, month, day] = match;
  return { year: Number(year), month: Number(month), day: Number(day) };
}

function formatDate({ year, month, day }: CalendarDate): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of `month`; UTC avoids any local-timezone shift.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Today's calendar date in Europe/Warsaw for the given instant (injected for testability). */
export function todayInWarsaw(now: Date): string {
  return warsawDateFormat.format(now);
}

/** Adds whole months; the day is clamped to the last day of the target month (31.01 + 1 → 28.02 / 29.02). */
export function addMonthsClamped(date: string, months: number): string {
  const { year, month, day } = parseDate(date);
  const monthIndex = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = monthIndex - targetYear * 12 + 1;
  return formatDate({
    year: targetYear,
    month: targetMonth,
    day: Math.min(day, daysInMonth(targetYear, targetMonth)),
  });
}

/** Whole calendar months from `from` to `to`, ignoring the day of month (e.g. 2026-01-31 → 2026-04-01 is 3). */
export function monthsBetween(from: string, to: string): number {
  const a = parseDate(from);
  const b = parseDate(to);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

/** Adds (or, with a negative value, subtracts) calendar days. */
export function addDays(date: string, days: number): string {
  const { year, month, day } = parseDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return formatDate({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}
