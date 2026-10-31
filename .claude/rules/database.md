# Database Rules

> Applies to the Postgres database (Supabase) and `backend/migrations/`.
> The backend talks to it with `pg` and plain SQL. There is no ORM.

## Tables
- Table names are **snake_case plural**: `project_assignments`, `delivery_centers`.
- Column names are **snake_case**. The API turns them into camelCase.
- Primary keys are `uuid` with `default gen_random_uuid()` — not auto-increment integers.
- Every master-data table has `created_at`, `updated_at`, `created_by`, `updated_by`
  and `deleted_at`.
  - `created_at` and `updated_at` default to `now()`. A `set_updated_at()` trigger keeps
    `updated_at` current. Reuse that function, do not redefine it.
  - `created_by` and `updated_by` are `text not null`.
  - `deleted_at` is null for live rows. Deleting sets it. Master data is never
    hard-deleted. The one exception is `/v1/team-members`, an older hand-written route.
- A new master-data table also needs a descriptor in `backend/src/masterDataTables.js`.
  The routes, validation and docs come from that descriptor.

## Queries
- **Never build SQL with string interpolation of request data.** Use bound parameters.
  ```js
  // Bad — SQL injection risk
  await pool.query(`select * from users where email = '${email}'`);
  // Good
  await pool.query("select * from users where email = $1", [email]);
  ```
- Table and column names in a query come only from the descriptors, never from a
  request. That is the one place interpolation is allowed.
- Reads filter live rows with `deleted_at is null` unless the route says otherwise.
  `GET /v1/<table>` and `GET /v1/<table>/:id` return soft-deleted rows too (flagged
  `markedDeleted: "Yes"`), and `activeTotal` counts live rows only.
- Paginate any query that can return a large result set — never fetch unbounded rows.
  List routes use `limit` and `offset`. Grouped counts are capped at 100 groups.
- Reuse the helpers in `backend/src/masterDataSchema.js` before writing new SQL by hand.

## Migrations
- Files live in `backend/migrations/`, numbered `NNNN_short_name.sql`, in order.
- **Never edit an existing migration.** Once committed, it is immutable. Add a new one.
- Write the SQL by hand and keep it small. Say in the header comment why it exists.
- Apply a migration to the live database before the backend deploy that reads it, and
  only with the owner's yes (CLAUDE.md §21). A migration that adds a required column
  needs a backfill in the same file.
- Check the migration against a copy of the data when it changes existing rows.
- Destructive changes (column removal, table drop) are two-phase:
  1. Phase 1: deprecate (stop writing to the column, deploy)
  2. Phase 2: remove (second migration, deploy after confirming no reads remain)
- Never put a password or key in a migration. Use a placeholder and set the real value
  on the host.

## Indexes and constraints
- Add an index on any column used in a `WHERE` clause in a hot query.
- Add an index on foreign keys. Postgres does not do this for you.
- Lists are filtered to live rows, so index live rows only:
  `create index ix_<table>_<column> on <table> (<column>) where deleted_at is null`.
- Uniqueness applies to live rows only, so deleting a row frees its value:
  `create unique index ux_<table>_<column>_live on <table> (<column>) where deleted_at is null`.
  Put the column name in the index name. The API reads it to say which field clashed.
- Composite indexes: highest-cardinality column first.
- Range rules go in a `check` constraint, as well as in the API.
- Text search uses `pg_trgm` (migration 0024).

## Naming Conventions
| Object | Convention | Example |
|---|---|---|
| Table | snake_case plural | `project_assignments` |
| Column | snake_case | `created_at` |
| Index | `ix_<table>_<col>` | `ix_resources_name` |
| Unique index | `ux_<table>_<col>_live` for live rows. Older ones use `ix_` | `ux_departments_floor_number_live` |
| Foreign key | `fk_<table>_<ref_table>` | `fk_teams_departments` |
| Check constraint | `ck_<table>_<col>_<rule>`. Migrations up to 0006 use `<table>_<col>_length` | `ck_departments_floor_number_range` |
| Trigger | `trg_<table>_<what>` | `trg_practices_updated_at` |

## Transactions
- Keep transactions short. Never hold one open across a network call.
- Use one client from the pool for the whole transaction: `begin`, the statements,
  then `commit`. Roll back and release the client in a `finally` path.
- A write that must not race (for example a total that has to stay at or under 100)
  checks and writes in one transaction under `pg_advisory_xact_lock`. Add a partial
  unique index as a backstop.
- On failure, rethrow the original error after the rollback so it reaches the central
  error handler. Map known Postgres codes (23505 unique, 23503 foreign key, 22P02 bad
  text value) to a 422 with `mapWriteError` in `masterDataRouter.js`. Do not return raw
  database errors.

## Access
- The backend connects as the `backend_app` role, not the `postgres` superuser.
  Migration 0003 sets default privileges, so new tables in `public` are readable and
  writable by the role without a grant of their own.
- `DATABASE_SSL_CA` turns on certificate verification (CLAUDE.md §20).
