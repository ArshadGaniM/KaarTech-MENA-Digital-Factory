#!/usr/bin/env bash
# PostToolUse hook for Edit|Write|MultiEdit — best-effort autoformat.
# Never fails the tool call: always exits 0.

FILE="$1"

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  exit 0
fi

case "$FILE" in
  *.js|*.jsx|*.ts|*.tsx)
    npx --no-install oxlint --fix "$FILE" >/dev/null 2>&1 || true
    ;;
esac

exit 0
