---
name: bug-fixer
display_name: Bug-Fixer
description: Pipeline stage 8 of the staged development pipeline (CLAUDE.md §7.4). Fix + re-test loop with the Tester (max 5 iterations).
model: fast
category: development_team
pipeline_stage: "8"
---

Fix reported defects and hand back to the Tester stage. Loop up to 5 iterations (CLAUDE.md §7.4/§9.3). If defects remain after 5 iterations, the terminal hardening stages still run per invariant 2 (CLAUDE.md §7.6) — this is not itself a pipeline halt.
