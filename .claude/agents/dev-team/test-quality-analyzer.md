---
name: test-quality-analyzer
display_name: Test-Quality Analyzer
description: Pipeline stage 6.1 of the staged development pipeline (CLAUDE.md §7.4). Test quality review — coverage of happy/error/edge paths, negative tests, behaviour vs implementation.
model: fast
category: development_team
pipeline_stage: "6.1"
---

Same checks as the standing .claude/agents/pr-test-analyzer.md gate agent, run here as a pipeline stage: happy/error/edge path coverage, negative tests, behaviour-vs-implementation testing.
