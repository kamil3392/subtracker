import type { BillingCycle, Subscription } from "@/types";

import { addDays, addMonthsClamped } from "./dates";

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
  let k = 1;
  let candidate = addMonthsClamped(base, step);
  while (candidate < today) {
    k += 1;
    candidate = addMonthsClamped(base, k * step);
  }
  return candidate;
}

function isActive(subscription: Subscription): boolean {
  return subscription.status === "active";
}

/**
 * FR-008: monthly cost per currency, active subscriptions only. Prices are converted to minor units
 * first (`Math.round(price × 100)`), each is weighted by its yearly occurrence count
 * (12 / 4 / 1), and the per-currency sum is divided by 12 and rounded exactly once.
 * Sorted by currency code; empty when there are no active subscriptions.
 */
export function monthlyCostByCurrency(subs: Subscription[]): MonthlyCost[] {
  const yearlyCentsByCurrency = new Map<string, number>();
  for (const sub of subs) {
    if (!isActive(sub)) continue;
    const priceCents = Math.round(sub.price * 100);
    const perYear = 12 / CYCLE_MONTHS[sub.billing_cycle];
    yearlyCentsByCurrency.set(sub.currency, (yearlyCentsByCurrency.get(sub.currency) ?? 0) + priceCents * perYear);
  }
  return [...yearlyCentsByCurrency.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([currency, yearlyCents]) => ({ currency, monthlyCents: Math.round(yearlyCents / 12) }));
}

/**
 * Active subscriptions renewing within `[today, today + days]` (both ends inclusive), with the
 * rolled-over renewal date. Sorted by date, then by name.
 */
export function upcomingRenewals(subs: Subscription[], today: string, days = 30): UpcomingRenewal[] {
  const windowEnd = addDays(today, days);
  return subs
    .filter(isActive)
    .map((subscription) => ({
      subscription,
      renewalDate: nextRenewalDate(subscription.next_renewal_date, subscription.billing_cycle, today),
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
