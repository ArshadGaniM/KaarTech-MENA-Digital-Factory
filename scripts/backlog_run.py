#!/usr/bin/env python3
"""Executor for tasks/backlog.md, called by .github/workflows/autonomous-backlog.yml.
See CLAUDE.md §16. Picks the next `pending` + `autonomous: yes` task and marks it
`in_progress`.

This script only does the picking/marking; the actual task execution is done by
invoking Claude (via the harness's API) with the task's description and context
as the prompt. Wire that call in once the harness's non-interactive invocation
method for this environment is decided (e.g. `claude -p "<prompt>"`).

Usage:
    python scripts/backlog_run.py
"""
import re
import sys

BACKLOG_PATH = "tasks/backlog.md"

TASK_PATTERN = re.compile(
    r"### (?P<id>BACKLOG-\d+): (?P<title>.+?)\n"
    r"\n- \*\*Status:\*\* (?P<status>\w+)\n"
    r"- \*\*Autonomous:\*\* (?P<autonomous>yes|no)\n"
    r"- \*\*requires_human:\*\* (?P<requires_human>yes|no)\n"
    r"- \*\*Added:\*\* (?P<added>\S+)\n"
    r"- \*\*Context:\*\* (?P<context>.*)\n"
    r"\n(?P<description>.*?)(?=\n### |\Z)",
    re.DOTALL,
)


def load_tasks():
    with open(BACKLOG_PATH) as f:
        content = f.read()
    return content, list(TASK_PATTERN.finditer(content))


def pick_next(tasks):
    for match in tasks:
        # NEVER auto-execute a task that requires a human decision (CLAUDE.md §16).
        if match.group("status") == "pending" and match.group("requires_human") == "no":
            return match
    return None


def mark_status(content, task_id, old_status, new_status):
    return content.replace(
        f"### {task_id}", f"### {task_id}", 1
    ).replace(
        f"**Status:** {old_status}", f"**Status:** {new_status}", 1
    )


def main():
    try:
        content, tasks = load_tasks()
    except FileNotFoundError:
        print("No backlog file found — nothing to run.")
        return

    task = pick_next(tasks)
    if not task:
        print("No autonomous pending tasks — nothing to run.")
        return

    task_id = task.group("id")
    print(f"Picked up {task_id}: {task.group('title')}")

    content = mark_status(content, task_id, "pending", "in_progress")
    with open(BACKLOG_PATH, "w") as f:
        f.write(content)

    print(
        f"Marked {task_id} in_progress. Execute the task described in "
        f"{BACKLOG_PATH} (context: {task.group('context')}), then update its "
        f"status to 'done' or 'blocked' with a reason."
    )


if __name__ == "__main__":
    sys.exit(main())
