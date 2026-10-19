import { describe, expect, it } from "vitest";
import { formatDate, formatMoney } from "./format";

describe("formatMoney", () => {
  it("formats with the pl-PL decimal comma", () => {
    expect(formatMoney(59.99, "PLN")).toContain("59,99");
  });

  it("keeps the currency of the amount", () => {
    expect(formatMoney(10, "EUR")).toContain("€");
  });
});

describe("formatDate", () => {
  it("formats a calendar date as a long Polish date", () => {
    expect(formatDate("2026-10-19")).toBe("19 października 2026");
  });

  it("does not shift the day at the start of the year", () => {
    expect(formatDate("2027-01-01")).toBe("1 stycznia 2027");
  });
});
