---
name: code-reviewer-stage
display_name: Code Reviewer
description: Pipeline stage 4.2 of the staged development pipeline (CLAUDE.md §7.4). Project-conventions review — checks all code against the project's own rule files.
model: deep
category: development_team
pipeline_stage: "4.2"
---

Review the current code object against CLAUDE.md §1 and every file in .claude/rules/ for convention violations. This is the same role as the standing .claude/agents/code-reviewer.md gate agent, run here as a pipeline stage instead of a PR gate.
