import type { Enums, Tables } from "@/db/database.types";

/** A row of `public.subscriptions`. `next_renewal_date` is the stored base date; FR-009 rollover is computed at read time. */
export type Subscription = Tables<"subscriptions">;

export type BillingCycle = Enums<"billing_cycle">;

export type SubscriptionStatus = Enums<"subscription_status">;

/** Raw values of the subscription form fields, carried through an error redirect and back into the form. */
export interface SubscriptionFormValues {
  name: string;
  price: string;
  currency: string;
  billing_cycle: string;
  next_renewal_date: string;
}
