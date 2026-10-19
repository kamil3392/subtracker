import type { APIRoute } from "astro";
import { NOT_FOUND, redirectToDashboardWithError } from "@/lib/api-redirects";
import { todayInWarsaw } from "@/lib/services/dates";
import { renewalDateToStore } from "@/lib/services/subscriptions";
import { formErrorLocation } from "@/lib/subscription-form";
import { createClient } from "@/lib/supabase";
import { parseNewSubscription, parseSubscriptionId } from "@/lib/validation/subscription";

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const id = parseSubscriptionId(context.params.id);
  if (!id) {
    return redirectToDashboardWithError(context, NOT_FOUND);
  }
  const editPath = `/subscriptions/${id}/edit`;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return redirectToDashboardWithError(context, "Supabase is not configured");
  }

  const form = await context.request.formData();
  const parsed = parseNewSubscription(form);
  if (!parsed.success) {
    // F6: carry the typed values back so the edit form keeps them after the redirect.
    return context.redirect(formErrorLocation(editPath, parsed.error, form));
  }

  // RLS restricts the select to the owner's rows: another account's id reads as "not found".
  const { data: existing, error: selectError } = await supabase
    .from("subscriptions")
    .select("next_renewal_date, billing_cycle")
    .eq("id", id)
    .maybeSingle();
  if (selectError) {
    return context.redirect(formErrorLocation(editPath, "Could not save the subscription", form));
  }
  if (!existing) {
    return redirectToDashboardWithError(context, NOT_FOUND);
  }

  const { name, price, currency, billing_cycle, next_renewal_date } = parsed.data;
  // Never `user_id` or `status`: the edit form changes only these five fields.
  const { data: updated, error: updateError } = await supabase
    .from("subscriptions")
    .update({
      name,
      price,
      currency,
      billing_cycle,
      next_renewal_date: renewalDateToStore(existing, { next_renewal_date, billing_cycle }, todayInWarsaw(new Date())),
    })
    .eq("id", id)
    .select("id");
  if (updateError) {
    return context.redirect(formErrorLocation(editPath, "Could not save the subscription", form));
  }
  // The row can disappear between the select and the update; an update touching 0 rows is not a success.
  if (updated.length === 0) {
    return redirectToDashboardWithError(context, NOT_FOUND);
  }

  return context.redirect("/dashboard");
};
