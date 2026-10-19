/**
 * Zod-free helpers that carry the subscription form's raw values through an error redirect (F6):
 * the endpoint appends them to `?error=…`, the page reads them back as the form's initial values.
 * Keep this module free of `astro/zod` imports — the form island imports from here.
 */
import type { SubscriptionFormValues } from "@/types";

export const SUBSCRIPTION_FORM_FIELDS = [
  "name",
  "price",
  "currency",
  "billing_cycle",
  "next_renewal_date",
] as const satisfies readonly (keyof SubscriptionFormValues)[];

/** Upper bound for a carried value; applied when writing and again when reading, since URLs are user-controlled. */
export const FORM_VALUE_MAX_LENGTH = 200;

function capped(value: string): string {
  return value.slice(0, FORM_VALUE_MAX_LENGTH);
}

/**
 * Builds `path?error=…&name=…&…` for an error redirect. Only the five known fields are carried;
 * missing and non-string (File) entries are skipped.
 */
export function formErrorLocation(path: string, message: string, form: FormData): string {
  const params = new URLSearchParams({ error: message });
  for (const field of SUBSCRIPTION_FORM_FIELDS) {
    const value = form.get(field);
    if (typeof value === "string") {
      params.set(field, capped(value));
    }
  }
  return `${path}?${params.toString()}`;
}

/** Reads the carried form values back from the query string; returns only the known fields that are present. */
export function formValuesFromSearchParams(params: URLSearchParams): Partial<SubscriptionFormValues> {
  const values: Partial<SubscriptionFormValues> = {};
  for (const field of SUBSCRIPTION_FORM_FIELDS) {
    const value = params.get(field);
    if (value !== null) {
      values[field] = capped(value);
    }
  }
  return values;
}
