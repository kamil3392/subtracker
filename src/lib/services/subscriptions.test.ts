import { describe, expect, it } from "vitest";

import type { BillingCycle, Subscription, SubscriptionStatus } from "@/types";

import { monthlyCostByCurrency, nextRenewalDate, upcomingRenewals } from "./subscriptions";

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
    next_renewal_date: "2026-10-15",
    status: "active",
    ...overrides,
  };
}

describe("nextRenewalDate", () => {
  it("returns a future base date unchanged", () => {
    expect(nextRenewalDate("2026-11-20", "monthly", "2026-10-02")).toBe("2026-11-20");
  });

  it("returns a base date equal to today unchanged", () => {
    expect(nextRenewalDate("2026-10-02", "yearly", "2026-10-02")).toBe("2026-10-02");
  });

  it("anchors monthly rollover to the base day (31.01 → 30.04, not 28.04)", () => {
    expect(nextRenewalDate("2026-01-31", "monthly", "2026-04-01")).toBe("2026-04-30");
  });

  it("rolls a quarterly subscription over many past cycles", () => {
    expect(nextRenewalDate("2025-01-15", "quarterly", "2026-10-02")).toBe("2026-10-15");
    expect(nextRenewalDate("2025-01-15", "quarterly", "2026-10-16")).toBe("2027-01-15");
  });

  it("rolls a yearly subscription over many past cycles", () => {
    expect(nextRenewalDate("2020-05-10", "yearly", "2026-10-02")).toBe("2027-05-10");
  });

  it("clamps a yearly 29.02 base in common years and restores it in leap years", () => {
    expect(nextRenewalDate("2024-02-29", "yearly", "2025-01-01")).toBe("2025-02-28");
    expect(nextRenewalDate("2024-02-29", "yearly", "2027-03-01")).toBe("2028-02-29");
  });
});

describe("upcomingRenewals", () => {
  const today = "2026-10-02";

  it("includes both ends of the [today, today + 30] window and excludes the day after", () => {
    const onToday = sub({ name: "Today", next_renewal_date: "2026-10-02" });
    const onLastDay = sub({ name: "Last day", next_renewal_date: "2026-11-01" });
    const outside = sub({ name: "Outside", next_renewal_date: "2026-11-02" });

    const result = upcomingRenewals([outside, onLastDay, onToday], today);

    expect(result).toEqual([
      { subscription: onToday, renewalDate: "2026-10-02" },
      { subscription: onLastDay, renewalDate: "2026-11-01" },
    ]);
  });

  it("uses the rolled-over date for past base dates", () => {
    const rolled = sub({ name: "Rolled", billing_cycle: "monthly", next_renewal_date: "2026-01-31" });

    expect(upcomingRenewals([rolled], today)).toEqual([{ subscription: rolled, renewalDate: "2026-10-31" }]);
  });

  it("skips cancelled subscriptions", () => {
    const cancelled = sub({ name: "Cancelled", next_renewal_date: "2026-10-10", status: "cancelled" });

    expect(upcomingRenewals([cancelled], today)).toEqual([]);
  });

  it("sorts by renewal date, then by name", () => {
    const later = sub({ name: "Alpha", next_renewal_date: "2026-10-20" });
    const sameDayB = sub({ name: "Netflix", next_renewal_date: "2026-10-10" });
    const sameDayA = sub({ name: "Hbo", next_renewal_date: "2026-10-10" });

    const names = upcomingRenewals([later, sameDayB, sameDayA], today).map((r) => r.subscription.name);

    expect(names).toEqual(["Hbo", "Netflix", "Alpha"]);
  });

  it("honours a custom window length", () => {
    const inSevenDays = sub({ next_renewal_date: "2026-10-09" });
    const inEightDays = sub({ next_renewal_date: "2026-10-10" });

    expect(upcomingRenewals([inSevenDays, inEightDays], today, 7)).toEqual([
      { subscription: inSevenDays, renewalDate: "2026-10-09" },
    ]);
  });
});

describe("monthlyCostByCurrency", () => {
  it("normalises monthly, quarterly and yearly cycles to one monthly cost", () => {
    const subs = [
      sub({ price: 30, billing_cycle: "monthly" }),
      sub({ price: 90, billing_cycle: "quarterly" }),
      sub({ price: 120, billing_cycle: "yearly" }),
    ];

    expect(monthlyCostByCurrency(subs)).toEqual([{ currency: "PLN", monthlyCents: 7000 }]);
  });

  it("rounds once per currency, not per subscription (167, not 83 + 83)", () => {
    const subs = [sub({ price: 10, billing_cycle: "yearly" }), sub({ price: 10, billing_cycle: "yearly" })];

    expect(monthlyCostByCurrency(subs)).toEqual([{ currency: "PLN", monthlyCents: 167 }]);
  });

  it("converts prices to minor units without float drift", () => {
    const subs = [sub({ price: 19.99, billing_cycle: "monthly" }), sub({ price: 0.1, billing_cycle: "monthly" })];

    expect(monthlyCostByCurrency(subs)).toEqual([{ currency: "PLN", monthlyCents: 2009 }]);
  });

  it("keeps separate totals per currency, sorted by currency code", () => {
    const subs = [
      sub({ price: 30, currency: "PLN", billing_cycle: "monthly" }),
      sub({ price: 12, currency: "EUR", billing_cycle: "yearly" }),
    ];

    expect(monthlyCostByCurrency(subs)).toEqual([
      { currency: "EUR", monthlyCents: 100 },
      { currency: "PLN", monthlyCents: 3000 },
    ]);
  });

  it("skips cancelled subscriptions", () => {
    const subs = [
      sub({ price: 30, billing_cycle: "monthly" }),
      sub({ price: 50, billing_cycle: "monthly", status: "cancelled" }),
    ];

    expect(monthlyCostByCurrency(subs)).toEqual([{ currency: "PLN", monthlyCents: 3000 }]);
  });

  it("returns an empty list when there are no active subscriptions", () => {
    expect(monthlyCostByCurrency([])).toEqual([]);
    expect(monthlyCostByCurrency([sub({ status: "cancelled" })])).toEqual([]);
  });
});
