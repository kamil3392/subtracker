<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Usuwanie i anulowanie subskrypcji

- **Plan**: context/changes/subscription-delete-and-cancel/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-19
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Notes: drift review found every planned item MATCH (no DRIFT/MISSING); `src/lib/api-redirects.ts` was an allowed option in the plan. Automated criteria re-run on 2026-10-19: `npm test` 78/78, `npm run lint`, `npx astro check` (0 errors), `npm run build` — all pass. CSRF: Astro 7 default `security.checkOrigin: true` blocks cross-origin POST to the new body-less endpoints. Smoke rows 2.4/3.5 rely on the user's confirmation (CI not observable from this environment — no `gh`).

## Findings

### F1 — Edycja anulowanej może dowolnie przesunąć zamrożoną datę końca

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/subscriptions/[id].ts:54 (with src/pages/subscriptions/[id]/edit.astro:46)
- **Detail**: The edit form pre-fills a cancelled row's date field with its end date D and the endpoint stores whatever date is submitted. Setting D far in the future keeps a "cancelled" entry in the total and renewals indefinitely, contradicting "frozen end date" (FR-007). The plan listed this under Open Risks ("Edycja anulowanej pozostaje dozwolona") but never decided it was desirable — a plan-level gap.
- **Fix A ⭐ Recommended**: In the edit endpoint, for `existing.status === "cancelled"` keep the stored `next_renewal_date` and `billing_cycle` (ignore submitted values); optionally render those fields read-only on the edit page.
  - Strength: Restores the FR-007 invariant at the server boundary; name/price/currency typos remain fixable.
  - Tradeoff: A genuinely mistaken end date can only be fixed by delete + re-add; edit page needs a small status-aware tweak.
  - Confidence: HIGH — endpoint already selects the existing row; one extra field in the select.
  - Blind spot: Whether users ever need to correct an end date (no PRD signal).
- **Fix B**: Accept as a deliberate product decision and document it in plan/CLAUDE.md.
  - Strength: No code change; users can correct a wrong end date.
  - Tradeoff: The sum can be inflated indefinitely by a "cancelled" entry.
  - Confidence: MED — acceptable for a single-user private tracker.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A) — edit endpoint keeps stored end date and cycle for cancelled rows, update guarded with `.eq("status", existing.status)`; edit page shows a note for cancelled entries

### F2 — Dwa style importu Radix i odmienne przypinanie wersji

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: package.json:33, src/components/ui/alert-dialog.tsx:3 vs src/components/ui/button.tsx:2
- **Detail**: `alert-dialog.tsx` imports the `radix-ui` umbrella package (new shadcn output) while `button.tsx` imports `@radix-ui/react-slot`; `radix-ui` is pinned exactly (`"1.8.1"`) while every other dependency uses `^`.
- **Fix**: Change the pin to `"^1.8.1"`; unify the Radix import style (regenerate `button.tsx` on `radix-ui`) when the next shadcn component is added.
- **Decision**: FIXED — `radix-ui` pinned as `^1.8.1` (package.json + lockfile root); import-style unification deferred to the next shadcn component

### F3 — Stan „Cancelling…/Deleting…” nigdy się nie pokazuje; ConfirmButton duplikuje SubmitButton

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/components/subscriptions/SubscriptionActions.tsx:36-64 (and src/components/form/SubmitButton.tsx:12)
- **Detail**: `useFormStatus` reports `pending` only for React function actions; with a native string `action` it stays false, so the confirm button never disables and a double click sends two POSTs (harmless: second cancel is a no-op, second delete shows "Subscription not found"). `ConfirmButton` copies `SubmitButton`'s spinner/pending logic, so the pre-existing bug is now in two places.
- **Fix**: Give `SubmitButton` `variant`/`className` props and a local `pending` state set from the form's `submit` event (e.g. via `onSubmit` on the form or a ref), then reuse it in `SubscriptionActions`.
  - Strength: One shared component; fixes the dead spinner for all native forms (add, edit, sign-in, cancel, delete).
  - Tradeoff: Touches the shared form component used by auth and subscription forms — needs a manual check of all forms.
  - Confidence: MED — native submit + page navigation keeps the state until unload, but bfcache restores need a reset (`pageshow`).
  - Blind spot: Not verified how each existing island wires `SubmitButton`.
- **Decision**: FIXED — new `src/components/hooks/useNativeFormPending.ts` (native submit + bfcache reset); `SubmitButton` uses it and gains `variant`/`className`; `ConfirmButton` removed in favour of `SubmitButton`

### F4 — renewalDateToStore liczy „shown” z rolloverem także dla anulowanej

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/subscriptions.ts:56
- **Detail**: The edit form shows `effectiveRenewalDate` (D, no rollover) but `renewalDateToStore` compares against `nextRenewalDate` (rollover). For a past D they differ, and the unchanged D is stored via the "submitted" branch — correct result for the wrong reason, contrary to the "single helper distinguishes status" rule; no unit test for a cancelled row.
- **Fix**: Use `effectiveRenewalDate` for `shown` (widen the `Pick` with `status`) and add a cancelled-row test (moot if F1 Fix A is applied).
- **Decision**: RESOLVED BY F1 — `renewalDateToStore` is now reached only for active rows; no change needed

### F5 — Dowolny tekst z ?error= w banerze strony

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard.astro:15-26,70-74
- **Detail**: A crafted `/dashboard?error=<any text>` renders as a `role="alert"` page banner (escaped, so no XSS; uncapped length). Not new — it previously rendered in the add form — but a page-level alert is a slightly better social-engineering surface.
- **Fix**: Cap the message with `FORM_VALUE_MAX_LENGTH` (or allow-list known messages).
- **Decision**: FIXED — dashboard caps `?error=` at `FORM_VALUE_MAX_LENGTH`

### F6 — Niejawna reguła banera i pozostała duplikacja redirectu

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/dashboard.astro:21-26, src/pages/api/subscriptions.ts:6-8
- **Detail**: "Error without carried fields = page error" is implicit; as a side effect the add endpoint's "Supabase is not configured" now shows in the banner (arguably better). `subscriptions.ts` still has its own `redirectWithError`, duplicating `src/lib/api-redirects.ts`.
- **Fix**: Switch `subscriptions.ts` to `redirectToDashboardWithError` and note the banner rule in CLAUDE.md (step 3 of "Przepływ auth").
- **Decision**: FIXED — `src/pages/api/subscriptions.ts` uses `redirectToDashboardWithError`; banner rule documented in CLAUDE.md (Przepływ auth, step 3)
