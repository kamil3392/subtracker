import type { APIRoute } from "astro";
import { NOT_FOUND, redirectToDashboardWithError } from "@/lib/api-redirects";
import { todayInWarsaw } from "@/lib/services/dates";
import { cancellationEndDate } from "@/lib/services/subscriptions";
import { createClient } from "@/lib/supabase";
import { parseSubscriptionId } from "@/lib/validation/subscription";

const CANCEL_FAILED = "Could not cancel the subscription";

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const id = parseSubscriptionId(context.params.id);
  if (!id) {
    return redirectToDashboardWithError(context, NOT_FOUND);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return redirectToDashboardWithError(context, "Supabase is not configured");
  }

  // RLS restricts the select to the owner's rows: another account's id reads as "not found".
  const { data: existing, error: selectError } = await supabase
    .from("subscriptions")
    .select("status, next_renewal_date, billing_cycle")
    .eq("id", id)
    .maybeSingle();
  if (selectError) {
    return redirectToDashboardWithError(context, CANCEL_FAILED);
  }
  if (!existing) {
    return redirectToDashboardWithError(context, NOT_FOUND);
  }
  // Cancelling twice is a no-op: the end date was frozen by the first cancel and must not move.
  if (existing.status === "cancelled") {
    return context.redirect("/dashboard");
  }

  // FR-007: freeze the end date at the renewal date due on the day of cancelling (rollover applied).
  const { data: updated, error: updateError } = await supabase
    .from("subscriptions")
    .update({
      status: "cancelled",
      next_renewal_date: cancellationEndDate(existing, todayInWarsaw(new Date())),
    })
    .eq("id", id)
    .eq("status", "active")
    .select("id");
  if (updateError) {
    return redirectToDashboardWithError(context, CANCEL_FAILED);
  }
  // The row can disappear (or change status) between the select and the update; 0 rows is not a success.
  if (updated.length === 0) {
    return redirectToDashboardWithError(context, NOT_FOUND);
  }

  return context.redirect("/dashboard");
};
