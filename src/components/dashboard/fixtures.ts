import { addDays } from "@/lib/services/dates";
import type { Subscription, SubscriptionFormValues } from "@/types";

/**
 * Fixtures for the dev kitchen sink (`src/pages/dev/dashboard-states.astro`). Dates are relative to
 * `today` (from `todayInWarsaw`) so every state stays meaningful whenever the page is opened.
 */

const FIXTURE_USER_ID = "00000000-0000-4000-8000-000000000000";

function fixture(
  id: number,
  values: Pick<Subscription, "name" | "price" | "currency" | "billing_cycle" | "next_renewal_date" | "status">,
  today: string,
): Subscription {
  return {
    id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    user_id: FIXTURE_USER_ID,
    created_at: `${addDays(today, -90)}T12:00:00Z`,
    ...values,
  };
}

/**
 * Default state: two currencies; active entries (one renewing within 30 days, one later), a cancelled
 * entry that still counts until its end date, and a cancelled entry already past it (FR-007: listed,
 * but not in the cost nor the renewals).
 */
export function defaultSubscriptions(today: string): Subscription[] {
  return [
    fixture(
      1,
      {
        name: "Netflix",
        price: 49.99,
        currency: "PLN",
        billing_cycle: "monthly",
        next_renewal_date: addDays(today, 5),
        status: "active",
      },
      today,
    ),
    fixture(
      2,
      {
        name: "GitHub Copilot",
        price: 100,
        currency: "USD",
        billing_cycle: "yearly",
        next_renewal_date: addDays(today, 120),
        status: "active",
      },
      today,
    ),
    fixture(
      3,
      {
        name: "Spotify",
        price: 89.97,
        currency: "PLN",
        billing_cycle: "quarterly",
        next_renewal_date: addDays(today, 12),
        status: "cancelled",
      },
      today,
    ),
    fixture(
      4,
      {
        name: "Disney+",
        price: 37.99,
        currency: "PLN",
        billing_cycle: "monthly",
        next_renewal_date: addDays(today, -4),
        status: "cancelled",
      },
      today,
    ),
  ];
}

/** Values carried back into the "Add" form after a failed submit (F6). */
/**
 * Cost-share chart with more subscriptions than slices: seven counted PLN entries (mixed cycles), so
 * the two smallest fold into "Other".
 */
export function manySubscriptions(today: string): Subscription[] {
  const entries: [string, number, Subscription["billing_cycle"]][] = [
    ["Netflix", 49.99, "monthly"],
    ["Spotify", 23.99, "monthly"],
    ["Adobe Creative Cloud", 1199, "yearly"],
    ["iCloud+", 11.99, "monthly"],
    ["Gym", 270, "quarterly"],
    ["YouTube Premium", 25.99, "monthly"],
    ["Medium", 199, "yearly"],
  ];
  return entries.map(([name, price, billing_cycle], i) =>
    fixture(
      100 + i,
      { name, price, currency: "PLN", billing_cycle, next_renewal_date: addDays(today, 3 + i * 9), status: "active" },
      today,
    ),
  );
}

export function carriedFormValues(today: string): Partial<SubscriptionFormValues> {
  return {
    name: "Hulu",
    price: "12,99",
    currency: "USD",
    billing_cycle: "monthly",
    next_renewal_date: addDays(today, 3),
  };
}
