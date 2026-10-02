/**
 * Zod-free constants shared by the server-side validation and the client-side form island.
 * Keep this module free of `astro/zod` imports — anything imported here ends up in the client bundle.
 */
import type { BillingCycle } from "@/types";

export const SUPPORTED_CURRENCIES = ["PLN", "EUR", "USD", "GBP", "CHF"] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};
