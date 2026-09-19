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
  'git[[:space:]]+push[^|;&]*[[:space:]](origin[[:space:]]+)?main([[:space:]]|$)'
  # Force-push (any form) rewrites history other people/CI may already
  # depend on — always requires a human decision, never auto-approved.
  'git[[:space:]]+push[^|;&]*(--force|--force-with-lease|-f[[:space:]])'
)

for pattern in "${DENY_PATTERNS[@]}"; do
  if echo "$CMD" | grep -qE "$pattern"; then
    echo "Blocked: command matches destructive pattern '$pattern'" >&2
    exit 2
  fi
done

exit 0
