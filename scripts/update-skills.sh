#!/usr/bin/env bash
# Weekly external-source sync. Triggered by .claude/hooks/session-start.sh
# when .claude/skills/.last-updated is 7+ days old. See CLAUDE.md §13.3-13.4.
set -uo pipefail

# --- Registered sources: add a new one by adding exactly these two lines ---
declare -A SKILL_SOURCES=(
  # ["my-slug"]="https://github.com/author/repo.git"
)
declare -A SKILL_PATHS=(
  # ["my-slug"]="path/to/skills"
)
# ----------------------------------------------------------------------------

CHANGED=0
LOG_FILE=".claude/skills/.update-log"
mkdir -p .claude/skills

for slug in "${!SKILL_SOURCES[@]}"; do
  url="${SKILL_SOURCES[$slug]}"
  path="${SKILL_PATHS[$slug]:-}"
  tmp_dir=$(mktemp -d)

  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Syncing $slug from $url..." >> "$LOG_FILE"

  if git clone --depth 1 "$url" "$tmp_dir" >> "$LOG_FILE" 2>&1; then
    src_dir="$tmp_dir/${path:-.}"
    dest_dir=".claude/skills/$slug"
    if [[ -d "$src_dir" ]]; then
      mkdir -p "$dest_dir"
      if ! diff -rq "$src_dir" "$dest_dir" >/dev/null 2>&1; then
        cp -r "$src_dir"/* "$dest_dir"/ 2>/dev/null || true
        CHANGED=1
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Updated $slug." >> "$LOG_FILE"
      fi
    fi
  else
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Failed to clone $slug — skipping." >> "$LOG_FILE"
  fi

  rm -rf "$tmp_dir"
done

date +%s > .claude/skills/.last-updated

if [[ "$CHANGED" -eq 1 ]]; then
  if [[ -f "scripts/register_skills.py" ]]; then
    python3 scripts/register_skills.py --skills-dir .claude/skills --registry .claude/github-repos.json || true
  fi
  git add .claude/skills .claude/agents .claude/commands .claude/hooks 2>/dev/null || true
  git commit -m "chore: weekly skill update [$(date -u +%Y-%m-%d)]" >> "$LOG_FILE" 2>&1 || true
  git push origin "$(git branch --show-current)" >> "$LOG_FILE" 2>&1 || true
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Weekly sync complete. Changed: $CHANGED" >> "$LOG_FILE"
