// Smoke test: proves the built app, the Cloudflare adapter, the Supabase auth flow and adding a subscription still work together.
// Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 node scripts/smoke.mjs

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const email = `smoke-${Date.now()}@example.com`;
const password = "Smoke-Test-Passw0rd!";
const subscriptionName = `Smoke Sub ${Date.now()}`;
const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
    if (expired) jar.delete(name.trim());
    else jar.set(name.trim(), rest.join("="));
  }
}

async function request(path, { method = "GET", form } = {}) {
  const response = await fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers: {
      Cookie: cookieHeader(),
      Origin: BASE_URL,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  storeCookies(response);
  return { status: response.status, location: response.headers.get("location") ?? "", body: await response.text() };
}

const steps = [
  ["home renders", () => request("/"), { status: 200 }],
  ["dashboard redirects anonymous user", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  [
    "signup creates account",
    () => request("/api/auth/signup", { method: "POST", form: { email, password } }),
    { status: 302, location: "/auth/confirm-email" },
  ],
  [
    "signin rejects wrong password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password: "wrong" } }),
    { status: 302, location: "/auth/signin?error=" },
  ],
  [
    "signin accepts correct password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password } }),
    { status: 302, location: "/dashboard" },
  ],
  ["dashboard renders for signed-in user", () => request("/dashboard"), { status: 200 }],
  [
    "add subscription redirects to dashboard",
    () =>
      request("/api/subscriptions", {
        method: "POST",
        form: {
          name: subscriptionName,
          price: "49.99",
          currency: "PLN",
          billing_cycle: "monthly",
          // Today's UTC date. Usually that is also today in Europe/Warsaw (the app's "today"), so the
          // subscription renews today. Around 22:00–24:00 UTC it is already "yesterday" in Warsaw; the
          // monthly rollover then moves it to base + 1 month, which is still ≤ Warsaw today + 30 days.
          // Either way it lands in the 30-day renewals list, which is where the dashboard shows names.
          next_renewal_date: new Date().toISOString().slice(0, 10),
        },
      }),
    { status: 302, location: "/dashboard", exactLocation: true },
  ],
  [
    "dashboard lists the added subscription",
    () => request("/dashboard"),
    { status: 200, bodyIncludes: subscriptionName },
  ],
  ["home redirects signed-in user to dashboard", () => request("/"), { status: 302, location: "/dashboard" }],
  ["signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
  ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
];

let failed = 0;
for (const [name, run, expected] of steps) {
  const actual = await run();
  const locationOk =
    expected.location === undefined ||
    (expected.exactLocation ? actual.location === expected.location : actual.location.startsWith(expected.location));
  const bodyOk = expected.bodyIncludes === undefined || actual.body.includes(expected.bodyIncludes);
  const ok = actual.status === expected.status && locationOk && bodyOk;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location}`);
  if (!ok) {
    failed++;
    console.log(
      `      expected ${expected.status} ${expected.location ?? ""}` +
        (expected.bodyIncludes === undefined ? "" : ` (body includes "${expected.bodyIncludes}")`),
    );
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
