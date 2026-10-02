---
bootstrapped_at: 2026-09-21T08:13:08Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: 10x-cards
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

Source: `context/foundation/tech-stack.md` (read in full).

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: 10x-cards
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
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
```

### Why this stack

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

Note: the hand-off body describes the "Subtracker" MVP while `project_name` is `10x-cards`. Recorded as-is; `project_name` is metadata only in v1 and did not affect the scaffold directory.

## Pre-scaffold verification

| Signal             | Value                                                                     | Severity | Notes                                                                                             |
| ------------------ | ------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| npm package        | not run                                                                   | n/a      | `cmd_template` starts with `git clone`; no `create-*` package name to derive                     |
| GitHub repo        | `przeprogramowani/10x-astro-starter` last pushed 2026-09-12T21:16:08Z     | fresh    | from card `docs_url`; `gh` CLI not installed, fetched via `curl https://api.github.com/repos/...` |

Checked at 2026-09-21T08:12:27Z. Most recent signal is 9 days old (fresh, < 3 months). Proceeded without warning.

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Runtime**: Node v22.22.3 / npm 10.9.8 (sourced via nvm; system default `/usr/local/bin/node` is v10 and would not satisfy the starter's `node 22` requirement)
**Duration**: 2026-09-21T08:12:55Z → 2026-09-21T08:13:08Z (`npm install`: added 664 packages, audited 665 packages in 11s, found 0 vulnerabilities)
**Upstream history**: `.bootstrap-scaffold/.git/` deleted before move-up
**Files moved**: 22 top-level entries (49 source/config files plus `node_modules/` with 490 packages)
**Conflicts (.scaffold siblings)**: `CLAUDE.md` → `CLAUDE.md.scaffold` (existing 10xDevs lesson `CLAUDE.md` kept)
**.gitignore handling**: absent in cwd — moved silently (starter's `.gitignore` is now the project's)
**context/ handling**: scaffold contained no `context/`; cwd `context/` preserved untouched
**.bootstrap-scaffold cleanup**: deleted (directory was empty after move-up)

File-by-file move log:

| Scaffold path         | Resolution                                  |
| --------------------- | ------------------------------------------- |
| `.env.example`        | moved                                       |
| `.github/`            | moved (contains `workflows/ci.yml`)         |
| `.gitignore`          | moved (no cwd `.gitignore` to merge with)   |
| `.husky/`             | moved                                       |
| `.nvmrc`              | moved (pins `22.14.0`)                      |
| `.prettierrc.json`    | moved                                       |
| `.vscode/`            | moved                                       |
| `AGENTS.md`           | moved (symlink → `CLAUDE.md`; see note)     |
| `astro.config.mjs`    | moved                                       |
| `CLAUDE.md`           | existing wins → `CLAUDE.md.scaffold`        |
| `components.json`     | moved                                       |
| `eslint.config.js`    | moved                                       |
| `node_modules/`       | moved                                       |
| `package.json`        | moved                                       |
| `package-lock.json`   | moved                                       |
| `public/`             | moved                                       |
| `README.md`           | moved                                       |
| `scripts/`            | moved (`smoke.mjs`)                         |
| `src/`                | moved (Astro pages, auth components, lib)   |
| `supabase/`           | moved (`config.toml`, `.gitignore`)         |
| `tsconfig.json`       | moved                                       |
| `wrangler.jsonc`      | moved                                       |

Note on `AGENTS.md`: the starter ships it as a symlink to `CLAUDE.md`. After the move it resolves to the existing 10xDevs lesson `CLAUDE.md`, not to the starter's agent instructions (those live in `CLAUDE.md.scaffold`). Resolve when the agent-context skill (Lesson 4) runs, or by hand.

Pre-existing cwd entries untouched: `.10x-cli.json`, `.agents/`, `.claude/`, `.idea/`, `10xdevs.iml`, `CLAUDE.md`, `context/`, `skills-lock.json`.

## Post-scaffold audit

**Tool**: `npm audit --json` (run from project root, Node v22.22.3 / npm 10.9.8, exit code 0)
**Summary**: 0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW (0 INFO)
**Direct vs transitive**: 0/0/0/0 direct of total 0/0/0/0
**Dependency tree**: 804 total (377 prod, 269 dev, 167 optional, 0 peer); 20 direct dependencies + 18 direct devDependencies per `package.json`

#### CRITICAL findings

None.

#### HIGH findings

None.

#### MODERATE findings

None.

#### LOW / INFO findings

None.

Raw output:

```json
{
  "auditReportVersion": 2,
  "vulnerabilities": {},
  "metadata": {
    "vulnerabilities": {
      "info": 0,
      "low": 0,
      "moderate": 0,
      "high": 0,
      "critical": 0,
      "total": 0
    },
    "dependencies": {
      "prod": 377,
      "dev": 269,
      "optional": 167,
      "peer": 0,
      "peerOptional": 0,
      "total": 804
    }
  }
}
```

## Hints recorded but not acted on

| Hint                       | Value                  |
| -------------------------- | ---------------------- |
| bootstrapper_confidence    | first-class            |
| quality_override           | false                  |
| path_taken                 | standard               |
| self_check_answers         | null                   |
| team_size                  | solo                   |
| deployment_target          | cloudflare-pages       |
| ci_provider                | github-actions         |
| ci_default_flow            | auto-deploy-on-merge   |
| has_auth                   | true                   |
| has_payments               | false                  |
| has_realtime               | false                  |
| has_ai                     | false                  |
| has_background_jobs        | false                  |

Card fields surfaced for context only: `deployment_defaults: [cloudflare-pages, vercel, fly]`, `toolchain.runtime_version: node 22`.

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep (`diff CLAUDE.md CLAUDE.md.scaffold`).
- Address audit findings per your project's risk tolerance — the full breakdown is in this log (none this run).
- Copy `.env.example` to `.env` and fill in Supabase credentials; `.nvmrc` pins Node 22, so run `nvm use` before `npm run dev`.
