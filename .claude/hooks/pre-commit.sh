#!/usr/bin/env bash
# Git pre-commit chain. Install with:
#   cp .claude/hooks/pre-commit.sh .git/hooks/pre-commit
set -uo pipefail

FAIL=0

# 1. Type check (no-op until TypeScript is adopted)
if [[ -f "tsconfig.json" ]]; then
  echo "Running type check..."
  npx --no-install tsc --noEmit || FAIL=1
fi

# Vendored content ingested via /fetch-github-repo (CLAUDE.md §13) isn't code
# we wrote or maintain — it doesn't owe this project's lint bar. Exclude
# .claude/skills/** entirely, and .claude/agents/** except our own
# dev-team/ pipeline agents (agent files copied straight into
# .claude/agents/<source-slug>/ are vendored; .claude/agents/dev-team/ and
# top-level .claude/agents/*.md are first-party).
IS_VENDORED='^\.claude/skills/|^\.claude/agents/[^/]+/[^/]'

# 2. Lint staged frontend files
STAGED_FRONTEND=$(git diff --cached --name-only --diff-filter=ACM \
  | grep -E '\.(js|jsx|ts|tsx)$' \
  | grep -Ev "$IS_VENDORED" \
  || true)
if [[ -n "$STAGED_FRONTEND" ]]; then
  echo "Linting staged frontend files..."
  # If the linter runs from inside a subdirectory, strip the prefix before
  # passing paths — otherwise repo-relative paths silently match nothing.
  npx --no-install oxlint $STAGED_FRONTEND || FAIL=1
else
  echo "No staged frontend files to lint — skipping."
fi

# 3. Lint staged backend files (no-op until a backend exists)
STAGED_BACKEND=$(git diff --cached --name-only --diff-filter=ACM \
  | grep -E '\.py$' \
  | grep -Ev "$IS_VENDORED" \
  || true)
if [[ -n "$STAGED_BACKEND" ]]; then
  if command -v ruff >/dev/null 2>&1; then
    echo "Linting staged backend files..."
    ruff check $STAGED_BACKEND || FAIL=1
  fi
fi

# 4. Secret scan on staged diff
echo "Scanning staged diff for secrets..."
SECRET_PATTERNS='(AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|api[_-]?key["\x27]?\s*[:=]\s*["\x27][A-Za-z0-9_\-]{16,}|secret["\x27]?\s*[:=]\s*["\x27][A-Za-z0-9_\-]{16,}|password["\x27]?\s*[:=]\s*["\x27][^"\x27]{8,})'
if git diff --cached | grep -E -i "$SECRET_PATTERNS" >/dev/null 2>&1; then
  echo "ERROR: possible secret detected in staged diff. Aborting commit." >&2
  FAIL=1
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo "Pre-commit checks failed." >&2
  exit 1
fi

echo "Pre-commit checks passed."
exit 0
