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
)

for pattern in "${DENY_PATTERNS[@]}"; do
  if echo "$CMD" | grep -qE "$pattern"; then
    echo "Blocked: command matches destructive pattern '$pattern'" >&2
    exit 2
  fi
done

exit 0
