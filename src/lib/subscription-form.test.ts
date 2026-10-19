import { describe, expect, it } from "vitest";

import { FORM_VALUE_MAX_LENGTH, formErrorLocation, formValuesFromSearchParams } from "./subscription-form";

function readBack(location: string) {
  const url = new URL(location, "http://localhost");
  return { pathname: url.pathname, params: url.searchParams };
}

describe("formErrorLocation / formValuesFromSearchParams", () => {
  it("round-trips the error and all five values, including Polish characters, & , = and spaces", () => {
    const values = {
      name: "Żółć & gęś = łódź",
      price: "12,50",
      currency: "PLN",
      billing_cycle: "monthly",
      next_renewal_date: "2026-10-15",
    };
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) {
      form.set(key, value);
    }

    const { pathname, params } = readBack(formErrorLocation("/dashboard", "Coś poszło nie tak & spróbuj", form));

    expect(pathname).toBe("/dashboard");
    expect(params.get("error")).toBe("Coś poszło nie tak & spróbuj");
    expect(formValuesFromSearchParams(params)).toEqual(values);
  });

  it("carries only the known fields and skips non-string entries", () => {
    const form = new FormData();
    form.set("name", "Netflix");
    form.set("user_id", "someone-else");
    form.set("price", new Blob(["49.99"]), "price.txt");

    const { params } = readBack(formErrorLocation("/dashboard", "Error", form));

    expect(params.has("user_id")).toBe(false);
    expect(params.has("price")).toBe(false);
    expect(formValuesFromSearchParams(params)).toEqual({ name: "Netflix" });
  });

  it("ignores unknown query parameters when reading back", () => {
    const params = new URLSearchParams({ error: "Error", currency: "EUR", status: "cancelled" });

    expect(formValuesFromSearchParams(params)).toEqual({ currency: "EUR" });
  });

  it("returns an empty object when no form fields are present", () => {
    expect(formValuesFromSearchParams(new URLSearchParams())).toEqual({});
    expect(formValuesFromSearchParams(new URLSearchParams({ error: "Error" }))).toEqual({});
  });

  it("keeps empty values so a cleared field stays cleared", () => {
    const form = new FormData();
    form.set("name", "");

    const { params } = readBack(formErrorLocation("/dashboard", "Error", form));

    expect(formValuesFromSearchParams(params)).toEqual({ name: "" });
  });

  it("caps values at the maximum length on write and on read", () => {
    const long = "a".repeat(FORM_VALUE_MAX_LENGTH + 50);
    const form = new FormData();
    form.set("name", long);

    const { params } = readBack(formErrorLocation("/dashboard", "Error", form));
    expect(params.get("name")).toHaveLength(FORM_VALUE_MAX_LENGTH);

    expect(formValuesFromSearchParams(new URLSearchParams({ name: long })).name).toHaveLength(FORM_VALUE_MAX_LENGTH);
  });
});
