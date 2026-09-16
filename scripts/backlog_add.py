#!/usr/bin/env python3
"""Append a task to the autonomous backlog (tasks/backlog.md). See CLAUDE.md §16.

Usage:
    python scripts/backlog_add.py \\
        --title "Add error state to X page" \\
        --description "..." \\
        --context "path/to/relevant/file.jsx" \\
        --autonomous yes|no
"""
import argparse
import datetime
import os
import re

BACKLOG_PATH = "tasks/backlog.md"


def next_id():
    if not os.path.exists(BACKLOG_PATH):
        return 1
    with open(BACKLOG_PATH) as f:
        content = f.read()
    ids = [int(n) for n in re.findall(r"BACKLOG-(\d+)", content)]
    return max(ids, default=0) + 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--title", required=True)
    parser.add_argument("--description", required=True)
    parser.add_argument("--context", default="")
    parser.add_argument("--autonomous", choices=["yes", "no"], required=True)
    args = parser.parse_args()

    task_id = f"BACKLOG-{next_id()}"
    requires_human = "no" if args.autonomous == "yes" else "yes"
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")

    entry = f"""
### {task_id}: {args.title}

- **Status:** pending
- **Autonomous:** {args.autonomous}
- **requires_human:** {requires_human}
- **Added:** {now}
- **Context:** {args.context or "(none)"}

{args.description}
"""

    header = "# Autonomous Backlog\n\n> See CLAUDE.md §16. `requires_human: yes` tasks are never auto-executed.\n"
    if not os.path.exists(BACKLOG_PATH):
        os.makedirs(os.path.dirname(BACKLOG_PATH), exist_ok=True)
        with open(BACKLOG_PATH, "w") as f:
            f.write(header)

    with open(BACKLOG_PATH, "a") as f:
        f.write(entry)

    print(f"Added {task_id} to {BACKLOG_PATH} (autonomous={args.autonomous})")


if __name__ == "__main__":
    main()
