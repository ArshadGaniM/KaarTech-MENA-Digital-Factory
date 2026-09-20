#!/usr/bin/env python3
"""Upsert an agent's metadata into this project's own agent inventory.

No backend exists yet in this project (CLAUDE.md §0), so this currently
writes to a local JSON inventory file (.claude/agents/registry.json) instead
of calling a live API. Swap the `upsert` function for a real API/DB call
once a backend exists (see CLAUDE.md §14, Method A/B).

Usage:
    python scripts/register_agent.py --file .claude/agents/dev-team/tester.md --category development_team
    python scripts/register_agent.py --name my-agent --display "My Agent" \
        --purpose "One-sentence purpose" --model claude-sonnet-5 --category other
"""
import argparse
import json
import os
import re

REGISTRY_PATH = ".claude/agents/registry.json"

# Model ceiling (owner's standing instruction, applies project-wide, not just
# the dev-team pipeline): no agent gets assigned a model above Sonnet by
# default. "deep" used to map to Opus; it's capped at Sonnet like every other
# tier now. Haiku stays available for "cheapest". Opus (or anything above
# Sonnet) is never auto-assigned — it may only be used one-off, outside this
# mapping, with the owner's explicit approval each time.
MODEL_KEYWORDS = {
    "deep": "claude-sonnet-5",
    "cheapest": "claude-haiku-4-5-20251001",
}
DEFAULT_MODEL = "claude-sonnet-5"


def extract_from_file(path):
    with open(path) as f:
        content = f.read()

    name = os.path.splitext(os.path.basename(path))[0]

    heading_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    display_name = heading_match.group(1).strip() if heading_match else name.replace("-", " ").title()

    frontmatter_match = re.search(r"^---\n(.*?)\n---\n", content, re.DOTALL)
    frontmatter = frontmatter_match.group(1) if frontmatter_match else ""

    purpose_match = re.search(r"description:\s*(.+)", frontmatter)
    purpose = purpose_match.group(1).strip() if purpose_match else ""
    purpose = purpose[:250]

    model = DEFAULT_MODEL
    for keyword, model_id in MODEL_KEYWORDS.items():
        if keyword in frontmatter.lower():
            model = model_id
            break

    category = "development_team" if "/dev-team/" in path else "other"
    pipeline_stage = None
    stage_match = re.search(r'pipeline_stage:\s*"?([\w.]+)"?', frontmatter)
    if stage_match and category == "development_team":
        pipeline_stage = stage_match.group(1)

    return {
        "agent_name": name,
        "display_name": display_name,
        "purpose": purpose,
        "model": model,
        "category": category,
        "pipeline_stage": pipeline_stage,
    }


def upsert(entry):
    data = {}
    if os.path.exists(REGISTRY_PATH):
        with open(REGISTRY_PATH) as f:
            data = json.load(f)
    data[entry["agent_name"]] = entry
    os.makedirs(os.path.dirname(REGISTRY_PATH), exist_ok=True)
    with open(REGISTRY_PATH, "w") as f:
        json.dump(data, f, indent=2, sort_keys=True)
        f.write("\n")
    print(f"Registered: {entry['agent_name']} ({entry['category']})")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", help="Path to the agent .md file to extract fields from")
    parser.add_argument("--name")
    parser.add_argument("--display")
    parser.add_argument("--purpose")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--category", default="other")
    args = parser.parse_args()

    if args.file:
        entry = extract_from_file(args.file)
        if args.category:
            entry["category"] = args.category
    else:
        entry = {
            "agent_name": args.name,
            "display_name": args.display or args.name,
            "purpose": args.purpose or "",
            "model": args.model,
            "category": args.category,
            "pipeline_stage": None,
        }

    upsert(entry)


if __name__ == "__main__":
    main()
