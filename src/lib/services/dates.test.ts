import { describe, expect, it } from "vitest";

import { addDays, addMonthsClamped, todayInWarsaw } from "./dates";

describe("todayInWarsaw", () => {
  it("returns the Warsaw date when it is already past midnight in Poland but not in UTC", () => {
    expect(todayInWarsaw(new Date("2026-10-01T22:30:00Z"))).toBe("2026-10-02");
  });

  it("returns the same date when UTC and Warsaw agree", () => {
    expect(todayInWarsaw(new Date("2026-10-02T12:00:00Z"))).toBe("2026-10-02");
  });

  it("follows the switch to summer time (CEST, UTC+2) at the end of March", () => {
    // Before the switch (CET, UTC+1): 23:30 UTC on 28.03 is 00:30 on 29.03.
    expect(todayInWarsaw(new Date("2026-03-28T23:30:00Z"))).toBe("2026-03-29");
    // After the switch (CEST, UTC+2): 22:30 UTC on 29.03 is already 00:30 on 30.03.
    expect(todayInWarsaw(new Date("2026-03-29T22:30:00Z"))).toBe("2026-03-30");
  });

  it("follows the switch back to winter time (CET, UTC+1) at the end of October", () => {
    // Before the switch (CEST): 22:30 UTC on 24.10 is 00:30 on 25.10.
    expect(todayInWarsaw(new Date("2026-10-24T22:30:00Z"))).toBe("2026-10-25");
    // After the switch (CET): 22:30 UTC on 25.10 is still 23:30 on 25.10.
    expect(todayInWarsaw(new Date("2026-10-25T22:30:00Z"))).toBe("2026-10-25");
  });
});

describe("addMonthsClamped", () => {
  it("clamps to the last day of a shorter month", () => {
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("clamps to 29 February in a leap year", () => {
    expect(addMonthsClamped("2028-01-31", 1)).toBe("2028-02-29");
  });

  it("keeps the anchor day when adding several months at once (no drift)", () => {
    expect(addMonthsClamped("2026-01-31", 2)).toBe("2026-03-31");
  });

  it("crosses the year boundary", () => {
    expect(addMonthsClamped("2026-11-15", 12)).toBe("2027-11-15");
    expect(addMonthsClamped("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonthsClamped("2026-12-31", 1)).toBe("2027-01-31");
  });

  it("returns the same date for zero months", () => {
    expect(addMonthsClamped("2026-10-02", 0)).toBe("2026-10-02");
  });
});

describe("addDays", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-10-02", 30)).toBe("2026-11-01");
    expect(addDays("2026-12-20", 15)).toBe("2027-01-04");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("is unaffected by the DST switch", () => {
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
  });
});
