---
starter_id: 10x-astro-starter
package_manager: npm
project_name: 10x-cards
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

A solo developer shipping the Subtracker MVP in 3 after-hours weeks needs a
web-app starter in TypeScript that ships auth and a database out of the box,
because FR-001/FR-002 require email + password accounts and the privacy NFR
demands strict per-account data isolation. 10x Astro Starter is the recommended
default for `(web, js)` and clears all four agent-friendly gates: typed
(TypeScript + Zod at boundaries), convention-based, popular in JS training data,
and well documented. Supabase provides PostgreSQL, email/password auth, and Row
Level Security, which directly enforces the "no user sees another account's
subscriptions" requirement. Cloudflare Pages is the starter's default deployment
target and needs no extra adapter work. Payments, realtime, and AI are out of
scope per the PRD; the renewal-date rollover in FR-009 is computed at read time,
so no background job infrastructure is needed. Standard path taken, so no
self-check was run. CI runs on GitHub Actions with auto-deploy on merge to
main. Bootstrapper confidence is first-class: scaffolding should be mostly
smooth with occasional manual steps.
