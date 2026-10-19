/**
 * Oracle tests for the cost and date rule (test plan §3 Phase 1, risks #1, #2, #4). Every expected
 * value comes from the PRD rule worked out by hand in a comment (FR-007, FR-008, FR-009), never from
 * the production formula: monthly counts in full, quarterly as 1/3, yearly as 1/12, a separate total
 * per currency, one rounding per currency, and a cancelled entry counts up to its end date D inclusive.
 */
import { describe, expect, it } from "vitest";

import type { BillingCycle, Subscription, SubscriptionStatus } from "@/types";

import { monthlyCostByCurrency, monthlyCostShares, upcomingRenewals } from "./subscriptions";

let nextId = 0;

function sub(overrides: {
  name?: string;
  price?: number;
  currency?: string;
  billing_cycle?: BillingCycle;
  next_renewal_date?: string;
  status?: SubscriptionStatus;
}): Subscription {
  nextId += 1;
  return {
    id: `00000000-0000-0000-0000-${String(nextId).padStart(12, "0")}`,
    user_id: "11111111-1111-1111-1111-111111111111",
    created_at: "2026-01-01T00:00:00Z",
    name: `Sub ${String(nextId)}`,
    price: 10,
    currency: "PLN",
    billing_cycle: "monthly",
    next_renewal_date: "2026-11-15",
    status: "active",
    ...overrides,
  };
}

describe("FR-008 monthly cost per currency (PRD oracle)", () => {
  const today = "2026-10-19";

  it("counts a quarterly price as 1/3 a month, rounded once per currency", () => {
    // 10.00 / 3 = 3.333… → 3.33
    expect(monthlyCostByCurrency([sub({ price: 10, billing_cycle: "quarterly" })], today)).toEqual([
      { currency: "PLN", monthlyCents: 333 },
    ]);
    // (10.00 + 10.00) / 3 = 6.666… → 6.67 (rounding each entry first would give 3.33 + 3.33 = 6.66)
    expect(
      monthlyCostByCurrency(
        [sub({ price: 10, billing_cycle: "quarterly" }), sub({ price: 10, billing_cycle: "quarterly" })],
        today,
      ),
    ).toEqual([{ currency: "PLN", monthlyCents: 667 }]);
  });

  it("keeps a separate total per currency across cycles and cancellation states", () => {
    const subs = [
      // PLN: 49.99 + 129.99 / 3 + 299.00 / 12 = 49.99 + 43.33 + 24.9166… = 118.2366… → 118.24
      sub({ price: 49.99, currency: "PLN", billing_cycle: "monthly" }),
      sub({ price: 129.99, currency: "PLN", billing_cycle: "quarterly" }),
      sub({ price: 299, currency: "PLN", billing_cycle: "yearly" }),
      // EUR: 9.99 + 60.00 / 12 = 9.99 + 5.00 = 14.99; the cancelled one ends today (D = today), so it still counts
      sub({ price: 9.99, currency: "EUR", billing_cycle: "monthly" }),
      sub({ price: 60, currency: "EUR", billing_cycle: "yearly", next_renewal_date: today, status: "cancelled" }),
      // GBP: 15.00 / 3 = 5.00
      sub({ price: 15, currency: "GBP", billing_cycle: "quarterly" }),
      // USD: the only entry ended yesterday (D = today − 1), so there is no USD total at all
      sub({
        price: 120,
        currency: "USD",
        billing_cycle: "yearly",
        next_renewal_date: "2026-10-18",
        status: "cancelled",
      }),
    ];

    expect(monthlyCostByCurrency(subs, today)).toEqual([
      { currency: "EUR", monthlyCents: 1499 },
      { currency: "GBP", monthlyCents: 500 },
      { currency: "PLN", monthlyCents: 11824 },
    ]);
  });

  it("stays exact at the largest price the form accepts (8 integer digits, 2 decimals)", () => {
    // 99 999 999.99 / 12 = 8 333 333.3325 → 8 333 333.33
    expect(monthlyCostByCurrency([sub({ price: 99999999.99, billing_cycle: "yearly" })], today)).toEqual([
      { currency: "PLN", monthlyCents: 833333333 },
    ]);
    // 2 × 99 999 999.99 = 199 999 999.98
    expect(monthlyCostByCurrency([sub({ price: 99999999.99 }), sub({ price: 99999999.99 })], today)).toEqual([
      { currency: "PLN", monthlyCents: 19999999998 },
    ]);
  });

  it("treats the card total as authoritative; chart slices may differ by at most 1 grosz each", () => {
    // Accepted 2026-10-19: the card shows 20.00 / 12 = 1.666… → 1.67, each slice shows 10.00 / 12 → 0.83.
    const subs = [sub({ price: 10, billing_cycle: "yearly" }), sub({ price: 10, billing_cycle: "yearly" })];

    const [total] = monthlyCostByCurrency(subs, today);
    const [group] = monthlyCostShares(subs, today);
    expect(total.monthlyCents).toBe(167);
    expect(group.slices.map((slice) => slice.monthlyCents)).toEqual([83, 83]);
  });

  it("keeps the slice drift within 1 grosz per slice for a mixed set", () => {
    const subs = [
      sub({ price: 49.99, billing_cycle: "monthly" }),
      sub({ price: 129.99, billing_cycle: "quarterly" }),
      sub({ price: 299, billing_cycle: "yearly" }),
      sub({ price: 10, billing_cycle: "yearly" }),
    ];

    const [total] = monthlyCostByCurrency(subs, today);
    const [group] = monthlyCostShares(subs, today);
    const sliceSum = group.slices.reduce((sum, slice) => sum + slice.monthlyCents, 0);
    expect(Math.abs(total.monthlyCents - sliceSum)).toBeLessThanOrEqual(group.slices.length);
  });
});

describe("FR-007 end date D in both the cost and the renewals", () => {
  // A cancelled 30.00 monthly subscription with end date D = 2026-10-25.
  const cancelled = sub({ name: "Cancelled", price: 30, next_renewal_date: "2026-10-25", status: "cancelled" });

  it.each(["2026-10-24", "2026-10-25"])("still counts and is listed with its end date on %s (≤ D)", (today) => {
    expect(monthlyCostByCurrency([cancelled], today)).toEqual([{ currency: "PLN", monthlyCents: 3000 }]);
    expect(upcomingRenewals([cancelled], today)).toEqual([{ subscription: cancelled, renewalDate: "2026-10-25" }]);
  });

  it("disappears from both the cost and the renewals on D + 1", () => {
    const today = "2026-10-26";

    expect(monthlyCostByCurrency([cancelled], today)).toEqual([]);
    expect(upcomingRenewals([cancelled], today)).toEqual([]);
  });
});
