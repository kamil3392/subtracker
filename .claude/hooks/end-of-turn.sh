#!/usr/bin/env bash
# Stop: sweep everything this turn changed before the agent finishes, one retry.
# ESLint + UI literal check on changed files, the whole vitest suite (runs in ~1 s), astro check.
export NO_COLOR=1 FORCE_COLOR=0
command -v jq >/dev/null || { echo "Hook end-of-turn.sh needs jq: install it or port the hook to Node." >&2; exit 2; }

HOOK_DIR=$(cd "$(dirname "$0")" && pwd)
INPUT=$(cat)

# Already sent back once by this hook: let it finish. The commit gate and CI catch the rest.
# (loop_count covers Cursor, which imports this hook from .claude/settings.json.)
ACTIVE=$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)
LOOPS=$(printf '%s' "$INPUT" | jq -r '.loop_count // 0' 2>/dev/null)
if [ "$ACTIVE" = "true" ] || [ "${LOOPS:-0}" != "0" ]; then
  exit 0
fi

# Checkouts to sweep: the session's (payload cwd follows EnterWorktree, $CLAUDE_PROJECT_DIR
# does not) plus every checkout lint-edited-file.sh registered for this session.
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
SID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' 2>/dev/null | tr -cd 'A-Za-z0-9_-')
REGISTRY="${TMPDIR:-/tmp}/claude-hooks/${SID:-none}.roots"
ROOTS=()
while IFS= read -r r; do
  [ -n "$r" ] && [ -d "$r" ] && ROOTS+=("$r")
done <<EOF
$({ git -C "${CWD:-$PWD}" rev-parse --show-toplevel 2>/dev/null; [ -n "$SID" ] && cat "$REGISTRY" 2>/dev/null; } | sort -u)
EOF
if [ "${#ROOTS[@]}" -eq 0 ]; then
  # Not silent: the user sees why nothing was checked.
  jq -cn --arg m "end-of-turn.sh: no git checkout at ${CWD:-$PWD}, nothing checked." '{systemMessage: $m}'
  exit 0
fi

REPORT=""
NODE_READY=0
for ROOT in "${ROOTS[@]}"; do
  cd "$ROOT" || continue

  # Changed and new files. Nothing changed (a Q&A turn): nothing to check here.
  CHANGED=$({ git diff --name-only HEAD; git ls-files -o --exclude-standard; } 2>/dev/null | sort -u)
  [ -n "$CHANGED" ] || continue

  if [ "$NODE_READY" -eq 0 ]; then
    . "$HOOK_DIR/_node.sh"
    NODE_READY=1
  fi

  # Changed files ESLint covers that still exist. This also catches files rewritten
  # through a shell command, which never reach a per-edit hook.
  FILES=()
  while IFS= read -r f; do
    case "$f" in *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.astro) [ -f "$f" ] && FILES+=("$f") ;; esac
  done <<EOF
$CHANGED
EOF

  if [ "${#FILES[@]}" -gt 0 ]; then
    OUT=$(npx --no-install eslint --quiet "${FILES[@]}" 2>&1 </dev/null) || REPORT="$REPORT
ESLint errors in changed files ($ROOT):
$OUT
"
    # Part of `npm run lint`; scans the whole tree in milliseconds and the baseline is 0 hits.
    if [ -f scripts/check-ui-literals.mjs ]; then
      OUT=$(node scripts/check-ui-literals.mjs 2>&1 </dev/null) || REPORT="$REPORT
UI literals (use token roles from src/styles/global.css, see CLAUDE.md \"UI\") ($ROOT):
$OUT
"
    fi
  fi

  # The whole unit suite runs in about a second: it also catches a red test in a module
  # this turn only imported.
  OUT=$(npx --no-install vitest run 2>&1 </dev/null) || REPORT="$REPORT
Unit tests fail (npm test) ($ROOT):
$OUT
"

  # astro check runs astro sync itself (.astro/ is gitignored) and covers .astro and .ts.
  OUT=$(npx --no-install astro check 2>&1 </dev/null) || REPORT="$REPORT
Typecheck fails (npx astro check) ($ROOT):
$OUT
"
done

if [ -n "$REPORT" ]; then
  echo "Fix these before you finish:$REPORT" >&2
  exit 2
fi
# Green: the registered checkouts are clean, start the next turn with an empty registry.
[ -n "$SID" ] && : >"$REGISTRY" 2>/dev/null
exit 0
