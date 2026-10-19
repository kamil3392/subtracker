import type { BillingCycle, Subscription } from "@/types";

import { addDays, addMonthsClamped, monthsBetween } from "./dates";

/** Length of each billing cycle in months. */
export const CYCLE_MONTHS: Record<BillingCycle, 1 | 3 | 12> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

export interface MonthlyCost {
  currency: string;
  /** Monthly cost in minor units (grosze/cents), rounded once per currency. */
  monthlyCents: number;
}

export interface CostShareSlice {
  /** Subscription id, or `"other"` for the folded remainder. */
  key: string;
  name: string;
  /** Monthly cost in minor units, rounded per slice (display only; the share uses unrounded values). */
  monthlyCents: number;
  /** Whole percent of the currency's monthly cost; the slices of one currency sum to 100. */
  percent: number;
}

export interface CostShareGroup {
  currency: string;
  /** Largest first; at most `maxSlices` slices, the last one "Other" when subscriptions were folded. */
  slices: CostShareSlice[];
}

export interface UpcomingRenewal {
  subscription: Subscription;
  renewalDate: string;
}

/**
 * FR-009 rollover computed at read time. Returns `base` when it is today or later; otherwise the
 * smallest `addMonthsClamped(base, k × cycleMonths)` that is ≥ `today`. Every candidate is anchored
 * to `base` (not to the previous clamped date), so 31.01 monthly yields 28.02, then 31.03 — no drift.
 */
export function nextRenewalDate(base: string, cycle: BillingCycle, today: string): string {
  if (base >= today) {
    return base;
  }
  const step = CYCLE_MONTHS[cycle];
  // Jump straight to the first cycle that reaches today's month (O(1) for any base date), then
  // correct for a base day later than today's day; the loop runs at most once or twice.
  let k = Math.max(1, Math.ceil(monthsBetween(base, today) / step));
  let candidate = addMonthsClamped(base, k * step);
  while (candidate < today) {
    k += 1;
    candidate = addMonthsClamped(base, k * step);
  }
  return candidate;
}

/**
 * Which base date to store when an existing subscription is edited. The edit form shows the
 * rolled-over date, so the stored base is kept if and only if the submitted date equals the
 * rolled-over date of the stored base AND the cycle is unchanged — otherwise an edit that touches
 * only the price would move the anchor day (31.01 shown as 28.02 would become 28.02 for good).
 * In every other case the submitted date becomes the new base.
 */
export function renewalDateToStore(
  stored: Pick<Subscription, "next_renewal_date" | "billing_cycle">,
  submitted: { next_renewal_date: string; billing_cycle: BillingCycle },
  today: string,
): string {
  const shown = nextRenewalDate(stored.next_renewal_date, stored.billing_cycle, today);
  if (submitted.next_renewal_date === shown && submitted.billing_cycle === stored.billing_cycle) {
    return stored.next_renewal_date;
  }
  return submitted.next_renewal_date;
}

/**
 * FR-007: whether a subscription counts toward the monthly cost and upcoming renewals on `today`.
 * Active entries always count. A cancelled entry counts up to and including its end date
 * (`next_renewal_date`, frozen at cancellation) and disappears from the day after.
 */
export function countsToward(sub: Subscription, today: string): boolean {
  if (sub.status === "active") {
    return true;
  }
  return today <= sub.next_renewal_date;
}

/**
 * The renewal date to show or compute with — the single place that distinguishes status. Active
 * entries roll over from their base date (FR-009); a cancelled entry keeps its stored end date as
 * is, even when it is in the past (it will not renew, so there is nothing to roll over).
 */
export function effectiveRenewalDate(sub: Subscription, today: string): string {
  if (sub.status === "active") {
    return nextRenewalDate(sub.next_renewal_date, sub.billing_cycle, today);
  }
  return sub.next_renewal_date;
}

/**
 * The end date to store when an active subscription is cancelled (FR-007): its next rolled-over
 * renewal date, i.e. the last day the already-paid period still counts.
 */
export function cancellationEndDate(
  stored: Pick<Subscription, "next_renewal_date" | "billing_cycle">,
  today: string,
): string {
  return nextRenewalDate(stored.next_renewal_date, stored.billing_cycle, today);
}

/**
 * FR-008: monthly cost per currency of the subscriptions that count on `today` (FR-007: active ones,
 * plus cancelled ones up to their end date). Prices are converted to minor units first
 * (`Math.round(price × 100)`), each is weighted by its yearly occurrence count (12 / 4 / 1), and
 * the per-currency sum is divided by 12 and rounded exactly once.
 * Sorted by currency code; empty when no subscription counts.
 */
export function monthlyCostByCurrency(subs: Subscription[], today: string): MonthlyCost[] {
  const yearlyCentsByCurrency = new Map<string, number>();
  for (const sub of subs) {
    if (!countsToward(sub, today)) continue;
    const priceCents = Math.round(sub.price * 100);
    const perYear = 12 / CYCLE_MONTHS[sub.billing_cycle];
    yearlyCentsByCurrency.set(sub.currency, (yearlyCentsByCurrency.get(sub.currency) ?? 0) + priceCents * perYear);
  }
  return [...yearlyCentsByCurrency.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([currency, yearlyCents]) => ({ currency, monthlyCents: Math.round(yearlyCents / 12) }));
}

/**
 * Share of each subscription in its currency's monthly cost (FR-008 breakdown; same counting rule
 * as `monthlyCostByCurrency`, no cross-currency totals). Within a currency, subscriptions are
 * sorted by cost (ties by name); when there are more than `maxSlices`, the smallest fold into one
 * "Other" slice so the total stays at `maxSlices` (a part-to-whole chart reads up to ~6 segments).
 * Percentages use the largest-remainder method so each currency's slices sum to exactly 100.
 * Sorted by currency code; empty when no subscription counts.
 */
export function monthlyCostShares(subs: Subscription[], today: string, maxSlices = 6): CostShareGroup[] {
  const byCurrency = new Map<string, { key: string; name: string; yearlyCents: number }[]>();
  for (const sub of subs) {
    if (!countsToward(sub, today)) continue;
    const yearlyCents = Math.round(sub.price * 100) * (12 / CYCLE_MONTHS[sub.billing_cycle]);
    const entries = byCurrency.get(sub.currency) ?? [];
    entries.push({ key: sub.id, name: sub.name, yearlyCents });
    byCurrency.set(sub.currency, entries);
  }

  return [...byCurrency.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([currency, entries]) => {
      entries.sort((a, b) => b.yearlyCents - a.yearlyCents || a.name.localeCompare(b.name));
      const kept = entries.length > maxSlices ? entries.slice(0, maxSlices - 1) : entries;
      const rest = entries.slice(kept.length);
      const slices = rest.length
        ? [...kept, { key: "other", name: "Other", yearlyCents: rest.reduce((sum, e) => sum + e.yearlyCents, 0) }]
        : kept;

      const total = slices.reduce((sum, s) => sum + s.yearlyCents, 0);
      const exact = slices.map((s) => (total > 0 ? (s.yearlyCents / total) * 100 : 0));
      const percents = exact.map(Math.floor);
      let missing = total > 0 ? 100 - percents.reduce((sum, p) => sum + p, 0) : 0;
      // Hand the remaining points to the largest fractional parts (stable: earlier, larger slices first).
      for (const index of exact
        .map((value, i) => ({ i, fraction: value - Math.floor(value) }))
        .sort((a, b) => b.fraction - a.fraction)
        .map(({ i }) => i)) {
        if (missing <= 0) break;
        percents[index] += 1;
        missing -= 1;
      }

      return {
        currency,
        slices: slices.map((s, i) => ({
          key: s.key,
          name: s.name,
          monthlyCents: Math.round(s.yearlyCents / 12),
          percent: percents[i],
        })),
      };
    });
}

/**
 * Subscriptions that count on `today` (FR-007) renewing within `[today, today + days]` (both ends
 * inclusive), with their effective renewal date (rolled over for active, the end date for
 * cancelled). Sorted by date, then by name.
 */
export function upcomingRenewals(subs: Subscription[], today: string, days = 30): UpcomingRenewal[] {
  const windowEnd = addDays(today, days);
  return subs
    .filter((subscription) => countsToward(subscription, today))
    .map((subscription) => ({
      subscription,
      renewalDate: effectiveRenewalDate(subscription, today),
    }))
    .filter(({ renewalDate }) => renewalDate >= today && renewalDate <= windowEnd)
    .sort((a, b) =>
      a.renewalDate < b.renewalDate
        ? -1
        : a.renewalDate > b.renewalDate
          ? 1
          : a.subscription.name.localeCompare(b.subscription.name),
    );
}
