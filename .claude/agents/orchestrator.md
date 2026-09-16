---
name: orchestrator
description: Historical reference only — DO NOT INVOKE AS A SUBAGENT.
model: fast
category: other
---

<!--
DO NOT INVOKE THIS FILE VIA THE AGENT/TASK TOOL.

Per CLAUDE.md §7.1: if this sandbox forbids a subagent from spawning further
subagents, a "run the whole pipeline" orchestrator-as-subagent design is
structurally impossible — it will either error (`Error: No such tool
available: Task. Task is disabled for this session, in subagents as well as
here.`) or silently have zero effect.

The real mechanism is the Workflow tool, running `.claude/workflows/dev-team.js`
as a script from the top level, not from inside another agent. This file is
kept only so the intended stage sequence and role list is documented
somewhere agent-shaped; it is inert.
-->

Historical/reference description of the pipeline this agent would have run —
see `CLAUDE.md` §7.4 for the authoritative, current stage table.
