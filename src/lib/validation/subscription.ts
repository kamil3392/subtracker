import { z } from "astro/zod";

import { Constants, type TablesInsert } from "@/db/database.types";
import { RENEWAL_DATE_MAX, RENEWAL_DATE_MIN } from "@/lib/services/dates";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";

export { SUPPORTED_CURRENCIES };

/** Up to 8 integer digits and 2 decimal places keeps the value inside `numeric(10,2)` without rounding. */
const PRICE_PATTERN = /^\d{1,8}([.,]\d{1,2})?$/;

const newSubscriptionSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .trim()
    .min(1, { error: "Name is required" })
    .max(100, { error: "Name must be at most 100 characters" }),
  price: z
    .string({ error: "Price is required" })
    .trim()
    .regex(PRICE_PATTERN, { error: "Price must be a number with at most 8 digits and 2 decimal places" })
    .transform((value) => Number(value.replace(",", ".")))
    .refine((value) => value > 0, { error: "Price must be greater than 0" }),
  currency: z.enum(SUPPORTED_CURRENCIES, { error: "Unsupported currency" }),
  billing_cycle: z.enum(Constants.public.Enums.billing_cycle, { error: "Unsupported billing cycle" }),
  next_renewal_date: z.iso
    .date({ error: "Next renewal date must be a valid date (YYYY-MM-DD)" })
    .refine((value) => value >= RENEWAL_DATE_MIN && value <= RENEWAL_DATE_MAX, {
      error: `Next renewal date must be between ${RENEWAL_DATE_MIN} and ${RENEWAL_DATE_MAX}`,
    }),
});

export type NewSubscription = Omit<TablesInsert<"subscriptions">, "user_id" | "status">;

export type ParseNewSubscriptionResult = { success: true; data: NewSubscription } | { success: false; error: string };

/** Validates the "add subscription" form on the server; returns the insert payload or the first error message. */
export function parseNewSubscription(form: FormData): ParseNewSubscriptionResult {
  const result = newSubscriptionSchema.safeParse({
    name: form.get("name") ?? undefined,
    price: form.get("price") ?? undefined,
    currency: form.get("currency") ?? undefined,
    billing_cycle: form.get("billing_cycle") ?? undefined,
    next_renewal_date: form.get("next_renewal_date") ?? undefined,
  });

  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Invalid subscription data" };
  }

  return { success: true, data: result.data };
}
