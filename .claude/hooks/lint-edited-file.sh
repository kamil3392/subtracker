#!/usr/bin/env bash
# PostToolUse (Write|Edit): lint the file the agent just edited, plus the UI literal check
# (scripts/check-ui-literals.mjs) filtered to that file. Exit 2 + stderr is the only combination Claude sees.
export NO_COLOR=1 FORCE_COLOR=0
command -v jq >/dev/null || { echo "Hook lint-edited-file.sh needs jq: install it or port the hook to Node." >&2; exit 2; }

HOOK_DIR=$(cd "$(dirname "$0")" && pwd)
INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' 2>/dev/null)
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
[ -n "$FILE" ] || exit 0
case "$FILE" in /*) ;; *) FILE="${CWD:-$PWD}/$FILE" ;; esac

# Extensions ESLint covers in eslint.config.js (JS/TS defaults + react + eslint-plugin-astro).
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.astro) ;;
  *) exit 0 ;;
esac
[ -f "$FILE" ] || exit 0

# Checkout of the edited file, not $CLAUDE_PROJECT_DIR (after EnterWorktree, or for a
# sibling worktree, that variable names another checkout). Files of other repositories
# (~/.claude, other projects) are skipped; any worktree of this repository is checked.
ROOT=$(git -C "$(dirname "$FILE")" rev-parse --show-toplevel 2>/dev/null) || exit 0
REPO=$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)
SESSION_REPO=$(git -C "${CWD:-$PWD}" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)
[ -n "$REPO" ] && [ "$REPO" = "$SESSION_REPO" ] || exit 0
cd "$ROOT" || exit 0
REL=${FILE#"$ROOT"/}

# Register the checkout so the Stop hook sweeps it too, even when it is not the session cwd.
SID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' 2>/dev/null | tr -cd 'A-Za-z0-9_-')
if [ -n "$SID" ] && mkdir -p "${TMPDIR:-/tmp}/claude-hooks"; then
  printf '%s\n' "$ROOT" >>"${TMPDIR:-/tmp}/claude-hooks/$SID.roots"
fi

. "$HOOK_DIR/_node.sh"

FAIL=0
# --no-install: a linter that is not installed fails here (exit 2) instead of passing.
if ! OUTPUT=$(npx --no-install eslint --quiet "$FILE" 2>&1 </dev/null); then
  echo "ESLint reported errors in $REL:" >&2
  echo "$OUTPUT" >&2
  FAIL=1
fi

# The UI literal check scans the whole tree in milliseconds; keep only this file's hits.
if [ -f scripts/check-ui-literals.mjs ]; then
  OUTPUT=$(node scripts/check-ui-literals.mjs 2>&1 </dev/null)
  RC=$?
  MINE=$(printf '%s\n' "$OUTPUT" | grep --color=never -F "$REL:")
  if [ -n "$MINE" ]; then
    echo "UI literals in $REL (use token roles from src/styles/global.css, see CLAUDE.md \"UI\"):" >&2
    echo "$MINE" >&2
    FAIL=1
  elif [ "$RC" -ne 0 ] && ! printf '%s\n' "$OUTPUT" | grep -q 'check-ui-literals:'; then
    echo "check-ui-literals.mjs could not run:" >&2
    printf '%s\n' "$OUTPUT" | head -n 20 >&2
    FAIL=1
  fi
fi

[ "$FAIL" -eq 0 ] || exit 2
exit 0
