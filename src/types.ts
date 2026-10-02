import type { Enums, Tables } from "@/db/database.types";

/** A row of `public.subscriptions`. `next_renewal_date` is the stored base date; FR-009 rollover is computed at read time. */
export type Subscription = Tables<"subscriptions">;

export type BillingCycle = Enums<"billing_cycle">;

export type SubscriptionStatus = Enums<"subscription_status">;
