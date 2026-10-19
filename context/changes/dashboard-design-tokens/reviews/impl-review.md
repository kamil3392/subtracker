<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Dashboard design tokens

- **Plan**: context/changes/dashboard-design-tokens/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5, 6
- **Date**: 2026-10-19
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 6 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Evidence: every planned change verified MATCH (known adaptations as reported during implementation: `buttonVariants` on plain `<a>` in `.astro`, `ring-3`, dev 404 guard in middleware, Topbar as token-styled div, Banner text on `--foreground`, user-requested Edit=outline / Cancel=secondary). "What We're NOT Doing" respected (`.dark`/`--primary` untouched, native selects, copy unchanged, no Playwright). Automated criteria of all 6 phases re-run 2026-10-19: lint (+ `check-ui-literals: 0 hits in 19 files`), `astro check` 0 errors, vitest 82/82, build OK, `/dev/dashboard-states` 404 in preview (also `/dev`, `/DEV/…`, trailing slash, `%64ev`), 200 in dev.

## Findings

### F1 — Focus ring on an invalid field drops to ≈1.44:1

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/ui/input.tsx:12 (also src/components/ui/button.tsx:8)
- **Detail**: In the built CSS `aria-invalid:ring-destructive/20[aria-invalid=true]` (byte 29319) comes after `focus-visible:ring-ring:focus-visible` (byte 28021) with equal specificity, so when a field with an error (FormField now sets `aria-invalid`) gets keyboard focus, the ring becomes destructive at 20% ≈1.44:1 on white. Contradicts the C3 goal and the new CLAUDE.md rule on full-opacity rings.
- **Fix**: Add `aria-invalid:focus-visible:ring-destructive` to the input/button base classes (keeps the pale ring when not focused) and add a focused-invalid Input example to the kitchen sink.
- **Decision**: FIXED — `aria-invalid:focus-visible:ring-destructive` added to ui/input.tsx and ui/button.tsx (selector specificity 0,3,0 beats the 0,2,0 `/20` ring); kitchen-sink focused-invalid example not added (focus cannot be shown in a static render)

### F2 — Muted text on muted surface is 4.34:1 (below AA 4.5:1)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/dashboard/DashboardView.astro:71, :93; src/pages/subscriptions/[id]/edit.astro (cancelled-entry note)
- **Detail**: `text-sm text-muted-foreground` (L 0.556) on `bg-muted` (L 0.97) computes to 4.34:1; the same text on white is 4.73:1. Affects the "No subscriptions count toward…", "No renewals…" and cancelled-entry notes.
- **Fix**: Render these notes on `bg-card` (border + white) instead of `bg-muted`.
- **Decision**: FIXED — notes moved from `bg-muted` to `bg-card` (DashboardView.astro:71, :93; edit.astro:80); muted-foreground on white = 4.73:1

### F3 — Kitchen sink renders duplicate DOM ids

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/dev/dashboard-states.astro
- **Detail**: `DashboardView` is rendered 3×, so `SubscriptionForm` ids (`name`, `price`, `currency`, …, `*-error`) and labels collide; labels in copies 2–3 focus copy 1 and a11y tooling flags the page. Dev-only.
- **Fix**: Note the limitation in the page's header comment (screen-reader checks: use the Default section or `/dashboard`).
- **Decision**: PENDING

### F4 — Literal check misses some files and class prefixes

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/check-ui-literals.mjs:9-16
- **Detail**: Scans only `.astro`/`.tsx` in `src/pages` and `src/components`; skips `src/layouts/` and `.ts` files, and the regex lacks `placeholder|caret|accent|decoration|ring-offset` prefixes. Hex part may false-positive on `#fade`-like anchors.
- **Fix**: Add `src/layouts` to targets and the missing prefixes to the regex (keep plan's "Skan" regex as the base).
- **Decision**: PENDING

### F5 — Path to tokens.md breaks after archiving

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: CLAUDE.md:49, src/styles/global.css:8
- **Detail**: Both point to `context/changes/dashboard-design-tokens/tokens.md`; `/10x-archive` moves the folder to `context/archive/`, leaving the next agent a dead reference.
- **Fix**: Move the ring rationale into the `global.css` comment itself (2 lines) and drop the path from CLAUDE.md, or repoint both at archive time.
- **Decision**: PENDING

### F6 — Kitchen-sink page is bundled into the production worker

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/middleware.ts:9-12; dist/server/chunks/dashboard-states_*.mjs
- **Detail**: In the build `import.meta.env.DEV` folds to false and the guard becomes an unconditional 404 before Supabase (verified, incl. encoded/duplicate-slash paths), so the page is unreachable; its code and fixtures still ship in the worker bundle.
- **Fix**: Accept as is (unreachable, fixtures contain no secrets).
- **Decision**: PENDING

### F7 — Manual 2.7 (banner) marked done without a reproducible path on prod

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress 2.7
- **Detail**: The banner renders only when Supabase config is missing, which production has, so "checked on prod" cannot have exercised it. Code evidence (token-based colours, contrast in tokens.md) supports it, but no visual check is recorded.
- **Fix**: Quick local check: rename `.dev.vars`, `npm run dev`, screenshot `/auth/signin`.
- **Decision**: PENDING

### F8 — Pre-existing UI leftovers surfaced by the restyle

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/Welcome.astro; src/components/auth/PasswordToggle.tsx; src/components/form/FormField.tsx
- **Detail**: Welcome still says "10x Astro Starter" / "cosmic developer experience" while Layout says Subtracker (copy out of scope by plan); password input has no right padding under the 36px toggle; FormField `hint` is not linked via `aria-describedby`. All predate this change.
- **Fix**: Record as follow-ups for a separate change (landing copy, password field padding + hint wiring).
- **Decision**: PENDING
