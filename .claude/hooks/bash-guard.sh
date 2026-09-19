#!/usr/bin/env bash
# PreToolUse hook for Bash — blocks unambiguously destructive commands.
# Exit 2 blocks the command; any other exit lets it through.

CMD=$(cat)

DENY_PATTERNS=(
  'rm[[:space:]]+-rf[[:space:]]+/[[:space:]]*$'
  'rm[[:space:]]+-rf[[:space:]]+/\*'
  'mkfs\.'
  ':\(\)\{[[:space:]]*:\|:&[[:space:]]*\};:'
  'dd[[:space:]]+if=.*of=/dev/(sda|nvme)'
  # CLAUDE.md §9.3: "Never push directly to main" — this repo's whole
  # gate/merge model depends on main only ever being updated via the
  # auto-PR workflow's own gated squash-merge, never a direct push.
  # Catches both a bare `main` target (`git push origin main`) and a
  # colon-delimited refspec (`git push origin HEAD:main`, `... feat:main`)
  # — the refspec form was a confirmed bypass of an earlier whitespace-only
  # pattern (FEAT-5 gate: security-auditor + code-reviewer finding).
  'git[[:space:]]+push[^|;&]*[[:space:]:]main([[:space:]]|$)'
  # Force-push (any form) rewrites history other people/CI may already
  # depend on — always requires a human decision, never auto-approved.
  # Matches --force/--force-with-lease, a bare trailing `-f` (not just one
  # followed by a space — an earlier pattern missed `-f` at end of string),
  # and combined short flags ending in f (e.g. `-uf`).
  'git[[:space:]]+push[^|;&]*(--force(-with-lease)?([[:space:]]|$)|[[:space:]]-[a-zA-Z]*f([[:space:]]|$))'
)

for pattern in "${DENY_PATTERNS[@]}"; do
  if echo "$CMD" | grep -qE "$pattern"; then
    echo "Blocked: command matches destructive pattern '$pattern'" >&2
    exit 2
  fi
done

exit 0
