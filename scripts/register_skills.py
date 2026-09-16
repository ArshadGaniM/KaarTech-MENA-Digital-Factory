#!/usr/bin/env python3
"""Scan .claude/skills/*/SKILL.md, infer category, and upsert into a local
skill registry. See CLAUDE.md §14 for category inference rules and the
category-keyword table.

No backend exists yet in this project, so this writes to
.claude/skills/registry.json instead of a live DB. Swap `upsert` for a real
DB call once a backend exists.

Usage:
    python scripts/register_skills.py --skills-dir .claude/skills --registry .claude/github-repos.json
"""
import argparse
import json
import os

CATEGORY_KEYWORDS = {
    "security": ["security", "audit", "vuln"],
    "development": ["test", "tdd", "agent", "skill", "command", "hook", "mcp", "dev", "code", "review"],
    "data": ["data", "pipeline", "ingest", "etl", "db", "sql"],
}


def infer_category(slug):
    slug_lower = slug.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword in slug_lower for keyword in keywords):
            return category
    return "other"


def load_source_repo(slug, registry_path):
    if not registry_path or not os.path.exists(registry_path):
        return None
    with open(registry_path) as f:
        registry = json.load(f)
    entry = registry.get(slug)
    return entry.get("url") if entry else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--skills-dir", default=".claude/skills")
    parser.add_argument("--registry", default=".claude/github-repos.json")
    parser.add_argument("--out", default=".claude/skills/registry.json")
    args = parser.parse_args()

    if not os.path.isdir(args.skills_dir):
        print(f"No skills directory at {args.skills_dir} — nothing to register.")
        return

    entries = {}
    for source_slug in sorted(os.listdir(args.skills_dir)):
        source_dir = os.path.join(args.skills_dir, source_slug)
        if not os.path.isdir(source_dir):
            continue

        # A source can package one skill directly at <source_slug>/SKILL.md,
        # or many skills each in their own subdirectory
        # (<source_slug>/<skill_slug>/SKILL.md, from a multi-skill repo) —
        # walk the whole tree so a multi-skill source doesn't collapse to one entry.
        for root, _dirs, files in os.walk(source_dir):
            skill_md = None
            for candidate in ("SKILL.md", "skill.md"):
                if candidate in files:
                    skill_md = os.path.join(root, candidate)
                    break
            if not skill_md:
                continue

            if root == source_dir:
                key = source_slug
                skill_slug = source_slug
            else:
                skill_slug = os.path.basename(root)
                key = f"{source_slug}/{skill_slug}"

            entries[key] = {
                "slug": skill_slug,
                "source_slug": source_slug,
                "category": infer_category(skill_slug),
                "source_repo": load_source_repo(source_slug, args.registry),
                "path": skill_md,
            }

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(entries, f, indent=2, sort_keys=True)
        f.write("\n")

    print(f"Registered {len(entries)} skill(s) to {args.out}")


if __name__ == "__main__":
    main()
