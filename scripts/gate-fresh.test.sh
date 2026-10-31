#!/usr/bin/env bash
# Tests for scripts/gate-fresh.sh against throwaway git repositories.
# Run: bash scripts/gate-fresh.test.sh
set -euo pipefail

script="$(cd "$(dirname "$0")" && pwd)/gate-fresh.sh"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0

git_quiet() { git -c user.email=t@t -c user.name=t "$@" >/dev/null 2>&1; }

commit_file() { # <file> <content> <message>
  mkdir -p "$(dirname "$1")"
  printf '%s\n' "$2" > "$1"
  git add "$1"
  git_quiet commit -m "$3"
}

new_repo() { # builds origin (with main) and a clone on a feature branch
  rm -rf "$work/origin.git" "$work/clone"
  git init -q --bare -b main "$work/origin.git"
  git clone -q "$work/origin.git" "$work/clone" 2>/dev/null
  cd "$work/clone"
  commit_file README.md one "init"
  git_quiet push origin HEAD:main
  git_quiet checkout -b feature
}

expect() { # <name> <expected> <before> <after>
  local got
  got=$(cd "$work/clone" && bash "$script" "$3" "$4")
  if [ "$got" = "$2" ]; then echo "ok   - $1"; else echo "FAIL - $1 (expected $2, got $got)"; failures=$((failures + 1)); fi
}

# 1. Own commit changes the report and a code file: fresh.
new_repo
before=$(git rev-parse HEAD)
commit_file src/a.js code "feat: a"
commit_file tasks/last-gate-report.md "# Gate" "docs: gate report"
expect "report plus code in the push's own commits is fresh" true "$before" "$(git rev-parse HEAD)"

# 2. Only the report changed: not fresh.
new_repo
before=$(git rev-parse HEAD)
commit_file tasks/last-gate-report.md "# Gate" "docs: gate report"
expect "report only is not fresh" false "$before" "$(git rev-parse HEAD)"

# 3. Only code changed: not fresh.
new_repo
before=$(git rev-parse HEAD)
commit_file src/a.js code "feat: a"
expect "code only is not fresh" false "$before" "$(git rev-parse HEAD)"

# 4. Merging main (which carries another session's report and code) must not count.
new_repo
cd "$work/clone"
git_quiet checkout main
commit_file tasks/last-gate-report.md "# Someone else's gate" "docs: other session report"
commit_file src/other.js other "feat: other session"
git_quiet push origin main
git_quiet checkout feature
before=$(git rev-parse HEAD)
git_quiet merge main -m "merge: bring in main"
expect "merging main with its report and code is not fresh" false "$before" "$(git rev-parse HEAD)"

# 5. Merge of main plus a genuine report and code commit of the branch's own: fresh.
new_repo
cd "$work/clone"
git_quiet checkout main
commit_file tasks/last-gate-report.md "# Someone else's gate" "docs: other session report"
git_quiet push origin main
git_quiet checkout feature
before=$(git rev-parse HEAD)
git_quiet merge main -m "merge: bring in main"
commit_file src/a.js code "feat: a"
commit_file tasks/last-gate-report.md "# My gate" "docs: my gate report"
expect "own report and code after a merge of main is fresh" true "$before" "$(git rev-parse HEAD)"

# 6. A new branch (all-zero before) is never fresh.
new_repo
commit_file src/a.js code "feat: a"
commit_file tasks/last-gate-report.md "# Gate" "docs: gate report"
expect "an all-zero before is not fresh" false "0000000000000000000000000000000000000000" "$(git rev-parse HEAD)"

# 7. A before commit that does not exist is never fresh.
new_repo
commit_file src/a.js code "feat: a"
expect "an unknown before commit is not fresh" false "1111111111111111111111111111111111111111" "$(git rev-parse HEAD)"

# 8. Report and code touched in separate pushes: each push judged on its own.
new_repo
commit_file src/a.js code "feat: a"
mid=$(git rev-parse HEAD)
commit_file tasks/last-gate-report.md "# Gate" "docs: gate report"
expect "a later report-only push is not fresh even if code came earlier" false "$mid" "$(git rev-parse HEAD)"

# 9. An empty before is never fresh.
new_repo
commit_file src/a.js code "feat: a"
commit_file tasks/last-gate-report.md "# Gate" "docs: gate report"
expect "an empty before is not fresh" false "" "$(git rev-parse HEAD)"

# 10. An empty range (before equals sha) is never fresh.
new_repo
commit_file src/a.js code "feat: a"
commit_file tasks/last-gate-report.md "# Gate" "docs: gate report"
head=$(git rev-parse HEAD)
expect "an empty range is not fresh" false "$head" "$head"

# 11. An unresolvable base ref fails closed.
new_repo
before=$(git rev-parse HEAD)
commit_file src/a.js code "feat: a"
commit_file tasks/last-gate-report.md "# Gate" "docs: gate report"
got=$(cd "$work/clone" && GATE_BASE_REF=origin/nope bash "$script" "$before" "$(git rev-parse HEAD)")
if [ "$got" = false ]; then echo "ok   - a missing base ref is not fresh"; else echo "FAIL - a missing base ref (got $got)"; failures=$((failures + 1)); fi

# 12. Report and code in a single commit is fresh.
new_repo
before=$(git rev-parse HEAD)
mkdir -p src tasks
echo code > src/a.js
echo "# Gate" > tasks/last-gate-report.md
git add src tasks
git_quiet commit -m "feat: a with report"
expect "report and code in one commit is fresh" true "$before" "$(git rev-parse HEAD)"

# 13. A fetch failure fails closed.
new_repo
before=$(git rev-parse HEAD)
commit_file src/a.js code "feat: a"
commit_file tasks/last-gate-report.md "# Gate" "docs: gate report"
git remote set-url origin "$work/missing.git"
expect "a failed fetch is not fresh" false "$before" "$(git rev-parse HEAD)"

if [ "$failures" -ne 0 ]; then echo "$failures failed"; exit 1; fi
echo "all passed"
