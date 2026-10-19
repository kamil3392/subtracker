import type { APIRoute } from "astro";
import { formErrorLocation } from "@/lib/subscription-form";
import { createClient } from "@/lib/supabase";
import { parseNewSubscription } from "@/lib/validation/subscription";

function redirectWithError(context: Parameters<APIRoute>[0], message: string) {
  return context.redirect(`/dashboard?error=${encodeURIComponent(message)}`);
}

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return redirectWithError(context, "Supabase is not configured");
  }

  const form = await context.request.formData();
  const parsed = parseNewSubscription(form);
  if (!parsed.success) {
    // F6: carry the typed values back so the form keeps them after the redirect.
    return context.redirect(formErrorLocation("/dashboard", parsed.error, form));
  }

  // `user_id` defaults to auth.uid(); the RLS insert policy rejects any other owner.
  const { error } = await supabase.from("subscriptions").insert(parsed.data);
  if (error) {
    return context.redirect(formErrorLocation("/dashboard", "Could not save the subscription", form));
  }

  return context.redirect("/dashboard");
};
