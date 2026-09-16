---
description: /deploy [staging|production] — pre-deploy checklist + trigger
argument-hint: [staging|production]
---

Target environment: `$1` (default: staging).

> No deployment platform is wired up yet for this project — see `CLAUDE.md` §21.
> Fill in the actual trigger mechanism once one is chosen (e.g. Vercel, Render).

Checklist before triggering:
1. `main` is green (CI passing, no open Critical gate findings).
2. `tasks/last-gate-report.md` reflects the commit being deployed and is not BLOCKED.
3. Environment variables for the target environment are present and non-placeholder
   (see `CLAUDE.md` §20).
4. Trigger the deploy via the platform's tooling.
5. Run the Deployment Verification Protocol (`CLAUDE.md` §21) once the deploy completes.
