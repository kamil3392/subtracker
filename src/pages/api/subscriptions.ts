import type { APIRoute } from "astro";
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

  const parsed = parseNewSubscription(await context.request.formData());
  if (!parsed.success) {
    return redirectWithError(context, parsed.error);
  }

  // `user_id` defaults to auth.uid(); the RLS insert policy rejects any other owner.
  const { error } = await supabase.from("subscriptions").insert(parsed.data);
  if (error) {
    return redirectWithError(context, "Could not save the subscription");
  }

  return context.redirect("/dashboard");
};
