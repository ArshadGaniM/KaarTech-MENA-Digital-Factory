#!/usr/bin/env bash
# Prints "true" when a push is a genuine gate run, otherwise "false".
#
# A push counts only when its OWN commits change both tasks/last-gate-report.md
# and at least one other file. "Own" means commits that are not already on
# main and are not merge commits. That is what keeps a merge of main into a
# feature branch from passing as a gate run: such a merge brings in other
# sessions' gate reports and files, but those commits are on main, and the
# merge commit itself is skipped.
#
# Usage: scripts/gate-fresh.sh <commit before the push> <commit after the push>
# Used by .github/workflows/auto-pr.yml and tested by scripts/gate-fresh.test.sh.
set -euo pipefail

before="${1:-}"
sha="${2:?usage: gate-fresh.sh <before> <sha>}"
report="tasks/last-gate-report.md"
base_ref="${GATE_BASE_REF:-origin/main}"
zero="0000000000000000000000000000000000000000"

# A new branch, a missing commit or a force-push that dropped history cannot
# be diffed safely, so it is never fresh.
if [ -z "$before" ] || [ "$before" = "$zero" ] || ! git cat-file -e "${before}^{commit}" 2>/dev/null; then
  echo false
  exit 0
fi

git fetch --quiet origin main || { echo false; exit 0; }
if ! git rev-parse --verify --quiet "$base_ref" >/dev/null; then
  echo false
  exit 0
fi

changed=$(git log --no-merges --name-only --format= "${before}..${sha}" --not "$base_ref" | sed '/^$/d' | sort -u)
report_touched=$(printf '%s\n' "$changed" | grep -Fx "$report" || true)
other_touched=$(printf '%s\n' "$changed" | grep -Fxv "$report" | sed '/^$/d' || true)

if [ -n "$report_touched" ] && [ -n "$other_touched" ]; then
  echo true
else
  echo false
fi
