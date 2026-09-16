# Subagent Verification Rule (sandbox reliability safety net)

## Why this rule exists

Some sandboxed environments' subagents (launched via a Task/Agent-style tool)
exhibit a very high hallucination rate specifically on file-existence claims —
measured around 95% in past campaigns, confirmed across multiple large
multi-agent runs.

## The rule

> Before accepting a subagent claim that any file is missing, empty, deleted, or
> unchanged, the orchestrator MUST verify with a direct `Read` (or `Bash ls`/`wc -l`)
> in the main context.

Applies to:
- Code review subagents claiming "fix not applied"
- Security auditors claiming "files don't exist"
- Doc writers claiming "no comments present"
- Testers claiming "test scripts not in repo"
- Any subagent verdict whose pivot is a *negative existence claim*

## How to apply

When a subagent returns a verdict like:
> "Cannot be confirmed: `path/to/file.py` does not exist"
> "FAIL — no error handler found in `x.py`"
> "Coverage 0% — no tests found"

Do NOT propagate the verdict to the user. Instead:

1. Run `ls -la <path>` and `wc -l <path>` to confirm whether the file actually exists.
2. If it does, `Read` the relevant section to confirm what's actually there.
3. Report the manual finding alongside the subagent's hallucinated finding, marked `(manual cross-check)`.
4. In the master gate report, label the subagent verdict explicitly:
   - `HALLUCINATED → manual: PASS` (verified false, code is fine)
   - `HALLUCINATED → manual: FAIL` (verified false, but code has a different real issue)
   - `CONFIRMED` (finding holds up under direct inspection)

## What this rule does NOT cover

- **Positive claims** ("I found a bug at line 42") — normal scepticism, no automatic cross-check needed.
- **Findings within files the subagent read successfully.**
- **Subagent calls in non-sandbox environments.**

## Operational flow

```
                       ┌──────────────────┐
   Subagent verdict ──▶│ Negative claim?  │──▶ no  ──▶ accept normally
                       └────────┬─────────┘
                                │ yes
                                ▼
                       ┌──────────────────┐
                       │ ls/wc/Read the   │
                       │ file directly    │
                       └────────┬─────────┘
                                │
                  ┌─────────────┴─────────────┐
                  ▼                           ▼
             file exists                  truly missing
                  │                           │
                  ▼                           ▼
        manual: cross-check             accept verdict;
        the actual content;             record as CONFIRMED
        relabel HALLUCINATED →
        manual: PASS|FAIL
```

## Removal criteria

Delete this rule when two consecutive multi-agent runs show zero
file-existence hallucinations. At that point the sandbox limitation has been
fixed and the rule is overhead rather than safety.
