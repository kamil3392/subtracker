import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

const PROTECTED_ROUTES = ["/dashboard", "/api/subscriptions", "/subscriptions"];
// Dev tooling (e.g. the /dev/dashboard-states kitchen sink): public under `astro dev`, 404 in any build.
const DEV_ONLY_ROUTES = ["/dev/"];

export const onRequest = defineMiddleware(async (context, next) => {
  // Answered here, before the page renders (a frontmatter `return` crashes typescript-eslint's no-misused-promises).
  if (!import.meta.env.DEV && DEV_ONLY_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    return new Response(null, { status: 404 });
  }

  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  // The home screen of a signed-in user is the dashboard; anonymous visitors see the landing page.
  // (Done here rather than in index.astro: a frontmatter `return` crashes typescript-eslint's no-misused-promises.)
  if (context.url.pathname === "/" && context.locals.user) {
    return context.redirect("/dashboard");
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
