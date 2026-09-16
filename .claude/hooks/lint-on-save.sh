#!/usr/bin/env bash
# Dispatches lint-on-save by file extension to the right linter.

FILE="$1"

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  exit 0
fi

case "$FILE" in
  *.js|*.jsx|*.ts|*.tsx)
    npx --no-install oxlint "$FILE"
    ;;
  *)
    exit 0
    ;;
esac
