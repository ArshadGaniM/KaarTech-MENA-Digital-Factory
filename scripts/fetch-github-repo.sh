#!/usr/bin/env bash
# One-shot external repo ingestion. See CLAUDE.md §13.2.
#   scripts/fetch-github-repo.sh <github-url> [slug]
#
# The optional [slug] overrides the auto-derived slug (the URL's basename,
# lowercased extension stripped). Pass it whenever the repo is already
# registered in .claude/github-repos.json under a curated slug that differs
# from its raw repo name (e.g. "ui-ux-pro-max" for a repo literally named
# "ui-ux-pro-max-skill") — otherwise this creates a second, mismatched entry
# instead of updating the one you already curated.
set -euo pipefail

REPO_URL="${1:?Usage: fetch-github-repo.sh <github-url> [slug]}"
SLUG="${2:-$(basename "$REPO_URL" .git)}"
REGISTRY=".claude/github-repos.json"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Cloning $REPO_URL into $TMP_DIR..."
git clone --depth 1 "$REPO_URL" "$TMP_DIR/$SLUG"

# Existence check that survives `set -o pipefail`: a plain `find ... | grep -q .`
# is unsafe here — grep -q exits after the first match, and if find is still
# writing when that happens it gets SIGPIPE, which pipefail then reports as the
# whole check failing even though a match WAS found. `-print -quit` makes find
# itself stop after the first hit, so there's no pipe left open to break.
has_match() {
  [[ -n "$(find "$1" \( "${@:2}" \) -print -quit 2>/dev/null)" ]]
}

COMPONENTS=()

# Skills — copy each skill's whole containing directory (not just SKILL.md) so
# per-skill reference files/scripts survive, and so multiple skills never
# collide by sharing the basename "SKILL.md".
if has_match "$TMP_DIR/$SLUG" -iname "SKILL.md" -o -ipath "*/skills/*"; then
  mkdir -p ".claude/skills/$SLUG"
  while IFS= read -r -d '' skill_md; do
    skill_dir=$(dirname "$skill_md")
    if [[ "$skill_dir" == "$TMP_DIR/$SLUG" ]]; then
      # SKILL.md sits at the repo root — this is a whole-project meta-skill,
      # not "the entire repo is skill content". Copying the containing dir
      # here would mean copying the whole clone (source, build artifacts,
      # .git, binaries — this bit us on ruflo: a 137MB copy for one skill).
      # Just take the SKILL.md itself.
      cp "$skill_md" ".claude/skills/$SLUG/SKILL.md"
    else
      dest_name=$(basename "$skill_dir")
      mkdir -p ".claude/skills/$SLUG/$dest_name"
      cp -r "$skill_dir/." ".claude/skills/$SLUG/$dest_name/"
      # A skill's own subdirectory should never itself be a git repo (that
      # happens if a maintainer vendored something in-place) — strip it so
      # git doesn't record a broken embedded-repo gitlink.
      rm -rf ".claude/skills/$SLUG/$dest_name/.git"
    fi
  done < <(find "$TMP_DIR/$SLUG" -iname "SKILL.md" -print0 2>/dev/null)
  COMPONENTS+=("skills")
fi

# Agents — same collision risk as skills if two source subdirectories have a
# same-named file, so preserve the path relative to the matched "agents/" dir.
if has_match "$TMP_DIR/$SLUG" -ipath "*/agents/*.md"; then
  mkdir -p ".claude/agents/$SLUG"
  while IFS= read -r -d '' agent_md; do
    rel=${agent_md#"$TMP_DIR/$SLUG/"}
    dest=".claude/agents/$SLUG/${rel#*agents/}"
    mkdir -p "$(dirname "$dest")"
    cp "$agent_md" "$dest"
  done < <(find "$TMP_DIR/$SLUG" -ipath "*/agents/*.md" -print0 2>/dev/null)
  COMPONENTS+=("agents")
fi

# Commands
if has_match "$TMP_DIR/$SLUG" -ipath "*/commands/*.md"; then
  find "$TMP_DIR/$SLUG" -ipath "*/commands/*.md" -exec sh -c 'cp "$1" ".claude/commands/'"$SLUG"'_$(basename "$1")"' _ {} \; 2>/dev/null || true
  COMPONENTS+=("commands")
fi

# Hooks
if has_match "$TMP_DIR/$SLUG" -ipath "*/hooks/*.sh"; then
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

# Merge rather than replace: keep any pre-existing "components" description
# (the human-curated summary) and only update url/type/last_fetched.
existing = data.get(slug, {})
existing["url"] = url
existing["type"] = type_
existing["last_fetched"] = now
data[slug] = existing

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
