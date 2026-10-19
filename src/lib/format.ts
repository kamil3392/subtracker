/** Formats an amount in the given ISO currency for the `pl-PL` locale (e.g. `59,99 zł`). */
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency }).format(amount);
}

// Calendar dates are `YYYY-MM-DD`; format them in UTC so no timezone shift moves the day.
const dateFormat = new Intl.DateTimeFormat("pl-PL", { dateStyle: "long", timeZone: "UTC" });

/** Formats a `YYYY-MM-DD` calendar date as a long `pl-PL` date (e.g. `19 października 2026`). */
export function formatDate(date: string): string {
  return dateFormat.format(new Date(`${date}T00:00:00Z`));
}
