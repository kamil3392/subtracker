import type { APIRoute } from "astro";
import { NOT_FOUND, redirectToDashboardWithError } from "@/lib/api-redirects";
import { createClient } from "@/lib/supabase";
import { parseSubscriptionId } from "@/lib/validation/subscription";

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

  // Any status may be deleted. RLS limits the delete to the owner's rows, so another account's id
  // (or an already deleted one) deletes 0 rows and reads as "not found".
  const { data: deleted, error: deleteError } = await supabase.from("subscriptions").delete().eq("id", id).select("id");
  if (deleteError) {
    return redirectToDashboardWithError(context, "Could not delete the subscription");
  }
  if (deleted.length === 0) {
    return redirectToDashboardWithError(context, NOT_FOUND);
  }

  return context.redirect("/dashboard");
};
