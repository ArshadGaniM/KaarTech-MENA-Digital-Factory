#!/usr/bin/env bash
# One-shot external repo ingestion. See CLAUDE.md §13.2.
#   scripts/fetch-github-repo.sh <github-url>
set -euo pipefail

REPO_URL="${1:?Usage: fetch-github-repo.sh <github-url>}"
SLUG=$(basename "$REPO_URL" .git)
REGISTRY=".claude/github-repos.json"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Cloning $REPO_URL into $TMP_DIR..."
git clone --depth 1 "$REPO_URL" "$TMP_DIR/$SLUG"

COMPONENTS=()

# Skills
if find "$TMP_DIR/$SLUG" -iname "SKILL.md" -o -ipath "*/skills/*" | grep -q .; then
  mkdir -p ".claude/skills/$SLUG"
  find "$TMP_DIR/$SLUG" -iname "SKILL.md" -exec cp {} ".claude/skills/$SLUG/" \; 2>/dev/null || true
  COMPONENTS+=("skills")
fi

# Agents
if find "$TMP_DIR/$SLUG" -ipath "*/agents/*.md" | grep -q .; then
  mkdir -p ".claude/agents/$SLUG"
  find "$TMP_DIR/$SLUG" -ipath "*/agents/*.md" -exec cp {} ".claude/agents/$SLUG/" \; 2>/dev/null || true
  COMPONENTS+=("agents")
fi

# Commands
if find "$TMP_DIR/$SLUG" -ipath "*/commands/*.md" | grep -q .; then
  find "$TMP_DIR/$SLUG" -ipath "*/commands/*.md" -exec sh -c 'cp "$1" ".claude/commands/'"$SLUG"'_$(basename "$1")"' _ {} \; 2>/dev/null || true
  COMPONENTS+=("commands")
fi

# Hooks
if find "$TMP_DIR/$SLUG" -ipath "*/hooks/*.sh" | grep -q .; then
  find "$TMP_DIR/$SLUG" -ipath "*/hooks/*.sh" -exec sh -c 'cp "$1" ".claude/hooks/'"$SLUG"'_$(basename "$1")"' _ {} \; 2>/dev/null || true
  COMPONENTS+=("hooks")
fi

TYPE=$(IFS=,; echo "${COMPONENTS[*]:-none}")
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

python3 - "$REGISTRY" "$SLUG" "$REPO_URL" "$TYPE" "$NOW" <<'PYEOF'
import json, sys, os

registry_path, slug, url, type_, now = sys.argv[1:6]
data = {}
if os.path.exists(registry_path):
    with open(registry_path) as f:
        data = json.load(f)

data[slug] = {
    "url": url,
    "type": type_,
    "last_fetched": now,
}

os.makedirs(os.path.dirname(registry_path), exist_ok=True)
with open(registry_path, "w") as f:
    json.dump(data, f, indent=2, sort_keys=True)
    f.write("\n")
PYEOF

echo "Registered $SLUG ($TYPE) in $REGISTRY."

if [[ -f "scripts/register_skills.py" && " ${COMPONENTS[*]:-} " == *"skills"* ]]; then
  python3 scripts/register_skills.py --skills-dir .claude/skills --registry "$REGISTRY" || true
fi

echo "Done. Review changes, then commit with:"
echo "  git add -A && git commit -m \"Integrated external repo: $SLUG on $(date -u +%Y-%m-%d)\""
