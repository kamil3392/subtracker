---
project: Subtracker
researched_at: 2026-09-21
recommended_platform: Cloudflare Workers (static assets + SSR Worker)
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 7 SSR (output "server") + React 19 islands, adapter @astrojs/cloudflare 14.3.1
  runtime: Cloudflare workerd (nodejs_compat), wrangler 4.131.1, Node 22.14.0 for tooling
  database: Supabase (Postgres + Auth via @supabase/ssr) — external, over HTTPS
---

## Recommendation

**Deploy on Cloudflare Workers** (Worker with static assets, `wrangler deploy`). **Not** Cloudflare Pages.

Cloudflare Workers is the only candidate that runs the current scaffold unchanged: `@astrojs/cloudflare` 14 targets Workers with static assets, `wrangler.jsonc` already declares `main`, `assets` and `nodejs_compat`, and the README deploy step is `npx wrangler deploy`. It passed all five agent-friendly criteria (CLI-first, managed, `llms.txt` + MDX docs on GitHub, versioned deploy/rollback API, official MCP servers without beta labels). The interview reinforced it: no persistent connections needed, cost and DX weighted equally (Free plan covers 10k–100k requests/month with >30x headroom at $0), existing Cloudflare familiarity breaks ties, single-region reach and external Supabase remove any premium for edge or co-located databases. Every other platform requires an adapter swap and, at the same traffic, costs $0 with real UX penalties (Render cold start, Vercel Hobby non-commercial clause, Netlify deploy-credit cap) or $2–7/month.

**Correction to `tech-stack.md`:** its `deployment_target: cloudflare-pages` is stale. `@astrojs/cloudflare` 14.0.0 dropped Pages support (Astro docs: "The Astro Cloudflare adapter no longer supports deployment on Cloudflare Pages"), and Cloudflare's Pages landing page (2026-08-25) says to start new projects with Workers. Update the hint to `cloudflare-workers`; nothing else in the stack decision changes.

## Platform Comparison

Hard filters applied first. Interview Q1 = "No persistent connections", so no serverless platform was removed. Stack compatibility: all six run Astro 7 SSR, but only Cloudflare Workers runs it with the installed adapter; Cloudflare Pages fails the stack filter and is excluded. Soft weights: cost and DX equal (Q2), Cloudflare familiarity as tie-breaker (Q3), single region so edge earns no bonus (Q4), external Supabase so integrated databases earn no bonus (Q5).

| Platform | CLI-first | Managed / Serverless | Agent-readable docs | Stable deploy API | MCP / integration | Total | Est. cost at 10k–100k req/mo |
|---|---|---|---|---|---|---|---|
| Cloudflare Workers | Pass | Pass | Pass | Pass | Pass | 5 Pass | $0 (Free: 100k req/day, 10 ms CPU); $5 Paid optional |
| Vercel | Pass | Pass | Pass | Pass (Hobby: rollback only to previous) | Partial (MCP beta) | 4 Pass, 1 Partial | $0 Hobby (non-commercial only) / $20 Pro |
| Render | Partial (rollback API/dashboard only) | Pass | Pass | Pass | Pass (MCP GA) | 4 Pass, 1 Partial | $0 Free (~60 s cold start) / $7 Starter |
| Railway | Partial (rollback dashboard only) | Pass | Pass | Partial (72 h image retention on Hobby) | Pass (remote MCP GA; old repo archived) | 3 Pass, 2 Partial | ~$5 Hobby |
| Fly.io | Pass | Partial (VMs, Dockerfile, 2 machines for zero-downtime) | Pass | Pass | Partial (MCP experimental) | 3 Pass, 2 Partial | $2–5, no free tier |
| Netlify | Partial (no rollback command) | Pass | Pass | Partial (draft-by-default deploy; rollback via `netlify api`) | Pass (MCP GA) | 3 Pass, 2 Partial | Free 300 credits; 15 credits/deploy ≈ 20 deploys/mo; functions in Ohio unless Pro |

**Cloudflare Workers.** Every operation has a wrangler command (`deploy`, `versions upload/deploy`, `rollback`, `tail`, `secret put`, `deployments status`). Docs: `developers.cloudflare.com/llms.txt`, `/workers/llms-full.txt`, CC-BY MDX in `cloudflare/cloudflare-docs`. Official remote MCP servers for docs, bindings, builds and observability. Static asset requests are free and unlimited; only SSR invocations count. Preview URLs and Workers Builds are GA. Automatic resource provisioning is **open beta** (checked 2026-09-21); Secrets Store is **beta**.

**Vercel.** `@astrojs/vercel` 11.0.10 supports Astro 7 (Node functions, Fluid compute GA; Edge Functions **deprecated** 2025-06-25). Full CLI incl. `vercel rollback`, docs as Markdown/`llms.txt`, MCP at mcp.vercel.com **beta**. Hobby is free but non-commercial, single region defaulting to `iad1` (must pin `fra1`), 1 h log retention, rollback only to the immediately previous deployment. Pro is $20/seat.

**Render.** Native Node runtime, Frankfurt region GA, Blueprint IaC, official CLI v2.28 with `deploys create --wait`, `logs --tail`, env vars via CLI; rollback only via REST API or dashboard. MCP server GA since 2025-08-21. Free instances spin down after 15 min idle with ~60 s cold start; Starter instance $7/mo.

**Railway.** Railpack builds Node from `.nvmrc`; `railway up --ci`, `railway logs --json`, `railway variable set`. Rollback to an arbitrary deployment is dashboard-only; Hobby keeps images 72 h. Remote MCP GA (April 2026), the GitHub MCP repo is **archived/deprecated**. Amsterdam Metal region GA. Trial $5 one-time, then Hobby $5/mo.

**Fly.io.** Full VMs, `fly launch` generates an Astro Dockerfile, `fly deploy --image` rollback, `fly.io/llms.txt`. No free tier since 2024-10; Warsaw region **deprecated** (use `ams`/`fra`); `fly launch` defaults to two machines (~$4/mo) unless `--ha=false`. `fly mcp server` is **experimental**.

**Netlify.** `@astrojs/netlify` 8.2.6 (Astro core team) on Lambda; docs as `.md` + `llms.txt`, MCP GA. `netlify deploy` publishes a draft unless `--prod`; no rollback command. Credit pricing: Free 300 credits/month with a hard cap that pauses all sites, 15 credits per production deploy; function region selection requires Pro ($20), otherwise Ohio → transatlantic round-trip to an EU Supabase.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Zero migration: the scaffold, README, CI smoke job and `wrangler.jsonc` already target it. Only platform with five Pass scores. Free plan covers the PRD scale (medium users, low QPS) by more than an order of magnitude, and the developer already knows the platform. Versioned deploys with `wrangler rollback` and `wrangler tail` give the agent a complete deploy → verify → revert loop from the terminal.

#### 2. Vercel

Closest serverless alternative with the most mature CLI among the rest, including a real rollback command, Markdown docs and an adapter maintained by the Astro core team. Gap: adapter swap, Hobby plan is non-commercial and single-region (must pin `fra1`), MCP still beta, log retention 1 h on Hobby. Pick it if workerd compatibility becomes a recurring problem.

#### 3. Render

A plain Node 22 process in Frankfurt with GA MCP, deploy hooks and `render.yaml` IaC; the simplest mental model for Supabase over HTTPS. Gap: adapter swap, rollback only via API/dashboard, and the Free instance's ~60 s cold start makes the "open app on payday" moment painful unless paying $7/mo.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **workerd is not Node.** `@supabase/ssr` and `realtime-js` already depend on `nodejs_compat` (open Supabase issue "Dynamic require of 'stream' is not supported"). Any new dependency touching `child_process`, `worker_threads`, native addons or non-listed Node modules fails only at runtime; `astro check` and ESLint cannot detect it.
2. **10 ms CPU per invocation on Free.** React SSR of the dashboard plus JSON parsing fits comfortably, but there is no soft degradation: exceeding the limit is error 1102. Heavier pages (large lists, server-side formatting libraries) erode the margin silently.
3. **Auto-injected `SESSION` KV binding without an id.** With no `session` key in `astro.config.mjs` the adapter enables Astro sessions on KV. Deploy then relies on automatic provisioning (open beta) and an API token with KV write scope; the provisioned id is written to `dist/`, not the repo. The app uses Supabase cookie auth and never needs Astro sessions.
4. **Preview URLs are public by default.** A branch preview carrying production Supabase secrets is an open sign-up form against the production `auth.users` table.
5. **Rollback and secrets have edges.** `wrangler rollback` is refused when bindings changed between versions and never reverts Supabase migrations. Secrets are per Worker, not per version, so a rotation applies instantly to every version including the one you might roll back to.

### Pre-Mortem — How This Could Fail

The team deployed on day one with the README command and everything worked, so nobody read the generated `dist/wrangler.json`. In week three, while building the subscription form, the developer added a currency-formatting library that internally required a Node module outside the `nodejs_compat` list. It ran locally because the dev build resolved a different `exports` entry, and it failed only after the production deploy as a 500 on the home screen. Rollback was refused because the same PR had changed a KV binding, so the fix became a late-night hotfix. A month later someone shared a branch preview link with friends "for testing"; the preview was public and pointed at production Supabase, and within a week `auth.users` held dozens of throwaway accounts that the RLS policies dutifully isolated but nobody could clean up safely. Finally a load-test script run "just to see" burned the 100,000 requests/day Free quota. Because every route is SSR, the whole application returned 429 until midnight UTC, including the sign-in page. Every one of these was documented; none was checked before the first deploy.

### Unknown Unknowns

- **Pages vs Workers is a hard split, not a naming detail.** `tech-stack.md` says `cloudflare-pages`, but adapter 14 supports only Workers. `wrangler pages deploy` and `wrangler deploy` are different products; Pages has no rollback command and cannot use this adapter's output.
- **`astro dev` already runs in real workerd** through `@cloudflare/vite-plugin` 1.54.8, and `astro preview` serves the built Worker the same way. `wrangler dev` is redundant, and the `platformProxy` option referenced by pre-v13 tutorials no longer exists.
- **`wrangler deploy` follows a build-time redirect.** `astro build` writes `.wrangler/deploy/config.json` pointing to `dist/wrangler.json`; plain `npx wrangler deploy` from the repo root uses it. Deploying without a fresh build ships whatever `dist/` last contained.
- **`compatibility_date` 2026-05-08 predates the 2026-08-04 change** that made `nodejs_compat` default. Keep the explicit flag; bumping the date is a runtime behavior change, not a housekeeping edit.
- **`wrangler deploy --temporary`** (wrangler ≥ 4.102) deploys without any login to a temporary account and prints a claim URL valid 60 minutes. It is aimed at agents; the claim URL is a bearer credential and must never land in CI logs or chat.
- **Free-plan exhaustion is binary.** After 100k requests in a UTC day every SSR request returns 429. `wrangler tail` does not work on preview aliases, so preview debugging is dashboard-only.
- **Astro `session: false` requires Astro ≥ 7.2.0** (installed: 7.3.2). On older Astro the only way to drop the KV binding is a custom session driver.

## Operational Story

- **Preview deploys**: connect the GitHub repo to Workers Builds (GA, Free: 3,000 build-min/month) so every non-production branch gets `<branch>-subtracker.<subdomain>.workers.dev`; or from CI run `npx wrangler versions upload --preview-alias <branch>`. Preview URLs are public by default. Either set `"preview_urls": false` in `wrangler.jsonc` until Cloudflare Access is configured, or put the `*.workers.dev` previews behind an Access policy limited to the developer's email. Previews must use a separate Supabase project (or the local Supabase from the CI smoke job), never production `SUPABASE_KEY`.
- **Secrets**: production `SUPABASE_URL` / `SUPABASE_KEY` live as Workers Secrets, set with `npx wrangler secret put <NAME>` (readable only by the Worker at runtime, never listed back). CI holds `CLOUDFLARE_API_TOKEN` (scoped: Workers Scripts:Edit, Account Settings:Read; add Workers KV Storage:Edit only if the `SESSION` binding stays) and `CLOUDFLARE_ACCOUNT_ID` in GitHub Secrets; `SUPABASE_URL`/`SUPABASE_KEY` are already GitHub Secrets for the build job. Local: `.dev.vars` (gitignored, kept in sync with `.env`). Rotation: `wrangler secret put` overwrites in place and takes effect on the next request, no redeploy.
- **Rollback**: `npx wrangler versions list --json` to find the previous version id, then `npx wrangler rollback <VERSION_ID> --message "<why>"`. Takes seconds and is fully in the CLI. Caveats: refused if bindings differ between versions (redeploy the old commit instead), and Supabase migrations in `supabase/migrations/` do not roll back with the Worker; write migrations backward-compatible or ship a down migration.
- **Approval**: human-only: `wrangler login`, creating or rotating the API token, first production deploy, custom domain / DNS, `wrangler delete`, `wrangler secret delete`, deleting or resetting the Supabase project, enabling Workers Paid. Agent unattended: `npm run build`, `astro preview` + `npm run smoke`, `wrangler versions upload` (preview), `wrangler deployments status`, `wrangler tail`, `wrangler versions list`. Production `wrangler deploy` runs only from CI on merge to `master` (the PR merge is the human gate) or by a human in the terminal.
- **Logs**: runtime, live: `npx wrangler tail subtracker --format json --status error` (read-only, production only). Runtime, historical: Workers Logs in the dashboard (observability is enabled in `wrangler.jsonc`) or the read-only Cloudflare observability MCP server at `observability.mcp.cloudflare.com/mcp`. Build/CI logs: `gh run view <id> --log` for GitHub Actions; `builds.mcp.cloudflare.com/mcp` or the dashboard for Workers Builds.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| New dependency requires Node API missing from `nodejs_compat`; fails only in production | Devil's advocate | M | H | Rely on `astro dev`/`astro preview` running in real workerd; run `npm run smoke` against `astro preview` in CI (already in place) and against the preview alias before merge; check the `nodejs_compat` list before adding server-side deps |
| SSR exceeds 10 ms CPU on Free plan → error 1102 | Devil's advocate | L | M | Keep domain math in `src/lib/services/` lean, watch CPU time in Workers Logs; upgrade to Workers Paid ($5/mo, 30 s CPU) if p99 approaches 5 ms |
| Auto-provisioned `SESSION` KV binding: deploy fails on token scope or beta provisioning quirks | Devil's advocate / Research finding (open beta 2026-09-21) | M | M | Add `session: false` to `astro.config.mjs` (Astro ≥ 7.2, installed 7.3.2); the binding disappears and no KV scope is needed |
| Public preview URL exposes sign-up against production Supabase | Devil's advocate / Pre-mortem | M | H | `preview_urls: false` or Cloudflare Access on previews; previews use a separate Supabase project; never set production `SUPABASE_KEY` on preview versions |
| Rollback refused because bindings changed | Devil's advocate | L | M | Change bindings in their own PR; fallback is redeploying the previous commit from CI |
| Supabase migration not reverted by Worker rollback | Devil's advocate | M | H | Backward-compatible migrations (add, never rename/drop in the same release); RLS policies per operation as required by CLAUDE.md |
| Daily Free quota exhausted → all SSR routes return 429 until midnight UTC | Pre-mortem / Research finding | L | H | No load tests against production; enable Cloudflare notifications on Worker error rate; Workers Paid removes the daily cap |
| Deploying to Cloudflare Pages by habit (`wrangler pages deploy`) | Unknown unknowns | M | M | Fix `deployment_target` in `tech-stack.md`; document `npx wrangler deploy` as the only deploy command; adapter 14 rejects Pages anyway |
| Stale `dist/` deployed because `wrangler deploy` ran without `astro build` | Unknown unknowns | M | M | Always `npm run build && npx wrangler deploy` as one step in CI and in README |
| Bumping `compatibility_date` silently changes runtime defaults | Unknown unknowns | L | M | Treat date bumps as a reviewed change; run the smoke test after each bump |
| `wrangler deploy --temporary` claim URL leaks in logs or chat | Unknown unknowns | L | H | Do not use `--temporary`; deploy only with a logged-in account or scoped CI token |
| Automatic resource provisioning / Secrets Store are beta | Research finding (checked 2026-09-21) | L | L | Avoid both for MVP: `session: false` removes the only auto-provisioned resource; plain Workers Secrets are GA |
| Overly broad CI API token (DNS, billing, other projects) | Research finding | L | H | Create the token from the "Edit Cloudflare Workers" template scoped to this account; no DNS or billing permissions |

## Getting Started

Verified against the installed versions: Astro 7.3.2, `@astrojs/cloudflare` 14.3.1 (built on `@cloudflare/vite-plugin` 1.54.8), wrangler 4.131.1. Run everything with Node 22.14.0 (`nvm use`); the system Node is too old for wrangler.

1. **Drop the unused session binding.** In `astro.config.mjs` add `session: false` next to `output: "server"`. This removes the auto-injected `SESSION` KV namespace and the provisioning step. Optionally rename `name` in `wrangler.jsonc` from `10x-astro-starter` to `subtracker` (this becomes the Worker name and `workers.dev` subdomain).
2. **Authenticate (human step).** `npx wrangler login` opens the browser; confirm with `npx wrangler whoami`. For CI, create an API token from the "Edit Cloudflare Workers" template and store it as `CLOUDFLARE_API_TOKEN` plus `CLOUDFLARE_ACCOUNT_ID` in GitHub Secrets.
3. **Build and deploy the Worker.** `npm run build && npx wrangler deploy` from the repo root, no `--config` flag; wrangler follows `.wrangler/deploy/config.json` to the generated `dist/wrangler.json`. Do **not** use `wrangler pages deploy`. The command prints the `https://<name>.<subdomain>.workers.dev` URL and a version id.
4. **Set production secrets.** `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY` (values from the hosted Supabase project, `anon` key). They are live on the next request; no redeploy needed. Keep `.dev.vars` for local `npm run dev` / `npm run preview`.
5. **Verify.** `npx wrangler deployments status`, then `BASE_URL=https://<name>.<subdomain>.workers.dev npm run smoke`, and watch `npx wrangler tail --format json --status error` while clicking through sign-up → sign-in → protected page → sign-out. Roll back with `npx wrangler rollback <VERSION_ID>` if the smoke test fails.
6. **Wire CI (next lesson, Plan Mode).** Add a `deploy` job to `.github/workflows/ci.yml` gated on `push` to `master` and on the `ci` + `smoke` jobs passing: `npm ci && npx astro sync && npm run build && npx wrangler deploy` with the two Cloudflare secrets. Decide on preview strategy (Workers Builds vs `wrangler versions upload --preview-alias`) and protect previews before enabling them.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (the deploy job above is a pointer for Plan Mode, not a design)
- Production-scale architecture (multi-region, HA, DR)
- Custom domain and DNS setup
