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
# we wrote or maintain — it doesn't owe this project's lint bar. Excludes:
# - .claude/skills/** entirely
# - .claude/agents/<source-slug>/** (our own dev-team/ pipeline agents and
#   top-level .claude/agents/*.md are first-party, so left in)
# - .claude/commands/<slug>_*.md and .claude/hooks/<slug>_*.sh — the naming
#   convention scripts/fetch-github-repo.sh always uses for vendored
#   commands/hooks; our own first-party commands/hooks never use a
#   "slug_" prefix (they're plain names like gate.md, bash-guard.sh).
IS_VENDORED='^\.claude/skills/|^\.claude/agents/[^/]+/[^/]|^\.claude/(commands|hooks)/[A-Za-z0-9.-]+_'

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

# Both the unambiguous patterns (AWS keys, PEM blocks) and the heuristic ones
# (api_key=/secret=/password=) only run against our own first-party diff, not
# vendored content ingested via /fetch-github-repo. In practice even the
# "unambiguous" patterns false-positive constantly on vendored content,
# because several ingested repos are themselves security-scanning skills that
# document these exact patterns in their own source/tests/docs (AWS's own
# canonical placeholder key "AKIA...EXAMPLE", or a PEM header inside a
# regex-pattern string literal, not an actual key body). Approved by the
# project owner after confirming multiple such false positives by hand; the
# tradeoff is a real leaked credential buried in vendored content wouldn't be
# caught here — that risk was already accepted when choosing to ingest
# 40 unvetted sources without a content review pass.
FIRST_PARTY_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -Ev "$IS_VENDORED" || true)
if [[ -n "$FIRST_PARTY_FILES" ]]; then
  HIGH_CONFIDENCE_PATTERNS='(AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)'
  if git diff --cached -- $FIRST_PARTY_FILES | grep -E "$HIGH_CONFIDENCE_PATTERNS" >/dev/null 2>&1; then
    echo "ERROR: possible credential (AWS key / private key block) detected in staged diff. Aborting commit." >&2
    FAIL=1
  fi

  HEURISTIC_PATTERNS='(api[_-]?key["\x27]?\s*[:=]\s*["\x27][A-Za-z0-9_\-]{16,}|secret["\x27]?\s*[:=]\s*["\x27][A-Za-z0-9_\-]{16,}|password["\x27]?\s*[:=]\s*["\x27][^"\x27]{8,})'
  if git diff --cached -- $FIRST_PARTY_FILES | grep -E -i "$HEURISTIC_PATTERNS" >/dev/null 2>&1; then
    echo "ERROR: possible secret detected in staged diff. Aborting commit." >&2
    FAIL=1
  fi
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo "Pre-commit checks failed." >&2
  exit 1
fi

echo "Pre-commit checks passed."
exit 0
