import type { APIContext } from "astro";

/** Shared error message for an id that is malformed or names no row the signed-in user can see (RLS). */
export const NOT_FOUND = "Subscription not found";

/** Redirects to `/dashboard?error=…`; the dashboard shows it as a page-level banner. */
export function redirectToDashboardWithError(context: APIContext, message: string) {
  return context.redirect(`/dashboard?error=${encodeURIComponent(message)}`);
}
