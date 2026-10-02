import { describe, expect, it } from "vitest";

import { parseNewSubscription } from "./subscription";

const VALID = {
  name: "Netflix",
  price: "49.99",
  currency: "PLN",
  billing_cycle: "monthly",
  next_renewal_date: "2026-10-15",
};

function form(overrides: Partial<Record<keyof typeof VALID, string>> = {}, omit: (keyof typeof VALID)[] = []) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...VALID, ...overrides })) {
    if (!omit.includes(key as keyof typeof VALID)) {
      data.set(key, value);
    }
  }
  return data;
}

function expectError(data: FormData) {
  const result = parseNewSubscription(data);
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBeTruthy();
  }
}

describe("parseNewSubscription", () => {
  it("accepts a valid form and returns the insert payload", () => {
    expect(parseNewSubscription(form())).toEqual({
      success: true,
      data: {
        name: "Netflix",
        price: 49.99,
        currency: "PLN",
        billing_cycle: "monthly",
        next_renewal_date: "2026-10-15",
      },
    });
  });

  describe("name", () => {
    it("trims surrounding whitespace", () => {
      const result = parseNewSubscription(form({ name: "  Spotify  " }));
      expect(result.success && result.data.name).toBe("Spotify");
    });

    it("rejects a whitespace-only name", () => {
      expectError(form({ name: "   " }));
    });

    it("rejects a missing name", () => {
      expectError(form({}, ["name"]));
    });

    it("accepts 100 characters and rejects 101", () => {
      expect(parseNewSubscription(form({ name: "a".repeat(100) })).success).toBe(true);
      expectError(form({ name: "a".repeat(101) }));
    });
  });

  describe("price", () => {
    it("normalizes a decimal comma to a dot", () => {
      const result = parseNewSubscription(form({ price: "12,50" }));
      expect(result.success && result.data.price).toBe(12.5);
    });

    it("accepts the largest value that fits numeric(10,2)", () => {
      const result = parseNewSubscription(form({ price: "99999999.99" }));
      expect(result.success && result.data.price).toBe(99999999.99);
    });

    it("accepts the smallest positive amount", () => {
      const result = parseNewSubscription(form({ price: "0.01" }));
      expect(result.success && result.data.price).toBe(0.01);
    });

    it("rejects zero", () => {
      expectError(form({ price: "0" }));
      expectError(form({ price: "0,00" }));
    });

    it("rejects more than two decimal places instead of silently rounding", () => {
      expectError(form({ price: "9.999" }));
    });

    it("rejects more than eight integer digits", () => {
      expectError(form({ price: "100000000" }));
    });

    it("rejects negative, non-numeric and empty values", () => {
      expectError(form({ price: "-5" }));
      expectError(form({ price: "abc" }));
      expectError(form({ price: "1e3" }));
      expectError(form({ price: "" }));
      expectError(form({}, ["price"]));
    });
  });

  describe("currency", () => {
    it("accepts every supported currency", () => {
      for (const currency of ["PLN", "EUR", "USD", "GBP", "CHF"]) {
        expect(parseNewSubscription(form({ currency })).success).toBe(true);
      }
    });

    it("rejects an unsupported currency", () => {
      expectError(form({ currency: "XYZ" }));
      expectError(form({ currency: "pln" }));
      expectError(form({}, ["currency"]));
    });
  });

  describe("billing_cycle", () => {
    it("accepts every billing cycle", () => {
      for (const billing_cycle of ["monthly", "quarterly", "yearly"]) {
        expect(parseNewSubscription(form({ billing_cycle })).success).toBe(true);
      }
    });

    it("rejects an unknown billing cycle", () => {
      expectError(form({ billing_cycle: "weekly" }));
      expectError(form({}, ["billing_cycle"]));
    });
  });

  describe("next_renewal_date", () => {
    it("accepts a leap day in a leap year", () => {
      expect(parseNewSubscription(form({ next_renewal_date: "2028-02-29" })).success).toBe(true);
    });

    it("rejects dates outside the 2000-01-01 … 2099-12-31 range", () => {
      expect(parseNewSubscription(form({ next_renewal_date: "2000-01-01" })).success).toBe(true);
      expect(parseNewSubscription(form({ next_renewal_date: "2099-12-31" })).success).toBe(true);
      expectError(form({ next_renewal_date: "1999-12-31" }));
      expectError(form({ next_renewal_date: "0100-01-01" }));
      expectError(form({ next_renewal_date: "2100-01-01" }));
    });

    it("rejects dates that do not exist in the calendar", () => {
      expectError(form({ next_renewal_date: "2026-02-30" }));
      expectError(form({ next_renewal_date: "2026-02-29" }));
      expectError(form({ next_renewal_date: "2026-13-01" }));
    });

    it("rejects other formats", () => {
      expectError(form({ next_renewal_date: "15.10.2026" }));
      expectError(form({ next_renewal_date: "2026-10-15T00:00:00Z" }));
      expectError(form({ next_renewal_date: "" }));
      expectError(form({}, ["next_renewal_date"]));
    });
  });
});
