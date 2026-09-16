#!/usr/bin/env bash
# SessionStart hook — weekly skill/agent/command sync trigger.
# Runs async/background; must never delay the first prompt.

set -u

LAST_UPDATED_FILE=".claude/skills/.last-updated"
NOW=$(date +%s)
SEVEN_DAYS=$((7 * 24 * 60 * 60))

if [[ -f "$LAST_UPDATED_FILE" ]]; then
  LAST=$(cat "$LAST_UPDATED_FILE" 2>/dev/null || echo 0)
else
  LAST=0
fi

AGE=$((NOW - LAST))

if [[ "$AGE" -lt "$SEVEN_DAYS" ]]; then
  exit 0
fi

if [[ -x "scripts/update-skills.sh" ]]; then
  nohup bash scripts/update-skills.sh >> .claude/skills/.update-log 2>&1 &
fi

exit 0
