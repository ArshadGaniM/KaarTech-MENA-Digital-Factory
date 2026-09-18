# Pipeline Run History

> Append-only. One row per completed feature, written by the pipeline's own
> final "Ship" stage (CLAUDE.md §7.7).

| Feature ID | Completed | Branch | Summary |
|---|---|---|---|
| FEAT-1 | 2026-09-18 | claude/trusting-curie-hlx1r6 | Redesigned the frontend as a multi-user app shell (AppShell/Sidebar/TopBar/UserBadge, mock signed-in-user context, MasterDataTable re-parented as a child view) instead of the old public-portal landing page; marketing site kept as an untouched sibling view. One architecture-critic halt (round 1: AppShell rendered inside marketing Header/Footer) fixed and reconfirmed in round 2. Final verdict PASS — clean lint/build, 25/25 tests. |
