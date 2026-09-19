# KaarTech MENA Digital Factory — Backend

Express + `pg` (Postgres/Supabase) API following the conventions in
`../.claude/rules/api.md` and `../.claude/rules/database.md`: response
bodies are always `{ data }` / `{ data, total } ` / `{ error }`, never raw
ORM/query rows.

## Setup

```bash
npm install
cp .env.example .env
# Fill in DATABASE_URL (a Postgres connection string) and INTERNAL_API_KEY
# (required for every master-data write route — generate a real random
# value, e.g. `openssl rand -hex 32`).
npm run dev
```

## Routes

### `/v1/team-members`

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/v1/team-members` | — | Paginated (`?limit`, `?offset`) |
| GET | `/v1/team-members/:id` | — | |
| POST | `/v1/team-members` | `{ fullName, role?, department?, email?, avatarUrl?, status? }` | |
| PATCH | `/v1/team-members/:id` | Any subset of the POST fields | |
| DELETE | `/v1/team-members/:id` | — | Hard delete |

### Master data: `/v1/practices`, `/v1/delivery-centers`, `/v1/competencies`, `/v1/modules`, `/v1/resources`, `/v1/departments`, `/v1/resource-cost`, `/v1/teams`, `/v1/resource-deployment`

All nine routes share the same shape (`src/masterDataRouter.js`), but each
table's own business fields differ — see `src/masterDataTables.js` for the
authoritative per-table field list (key, required, type).

| Method | Path | Body | Auth | Notes |
|---|---|---|---|---|
| GET | `/v1/<table>` | — | none | Paginated (`?limit`, max 100; `?offset`). **Includes** soft-deleted rows — see `markedDeleted` below. |
| GET | `/v1/<table>/:id` | — | none | 404 only if the id doesn't exist — returns a soft-deleted row too. |
| POST | `/v1/<table>` | table's required fields + optional `updatedBy` | `x-internal-api-key` | 201 with the created record. |
| PATCH | `/v1/<table>/:id` | any subset of the table's fields + optional `updatedBy` | `x-internal-api-key` | 404 if soft-deleted or missing (can't edit a soft-deleted row). |
| DELETE | `/v1/<table>/:id` | — | `x-internal-api-key` | Soft delete — sets `deleted_at`, does not remove the row. 204 on success. |

Per-table fields, as of this writing:

| Table | Fields |
|---|---|
| `competencies`, `resource-cost`, `teams`, `resource-deployment` | `name` (required) |
| `practices` | `name` (required) — plus an auto-generated `code` (`PRAC-001`, ...) |
| `departments` | `name` (required) — plus an auto-generated `code` (`DEPT-001`, ...) |
| `delivery-centers` | `name` (required), `locationType` (required, `onshore` \| `offshore`), `city` (required), `country` (required) — plus an auto-generated `code` (`DC-001`, ...) |
| `modules` | `moduleCode` (required, human-assigned — distinct from the auto-generated `code`), `name` (required), `practiceId` (optional, a `practices.id` — **not** validated against `practices`; can be set/changed later via PATCH) — plus an auto-generated `code` (`MOD-001`, ...) |
| `resources` | `employeeId` (required, **caller-supplied and unique — not auto-generated**, unlike every other table's identifier), `name` (required), `employmentStatus` (required), `employmentType` (required), `subDivision` (required), `position` (required), `locationType` (required, `Onsite` \| `Offshore`), `designation` (required), `geBatch` (required), `kaarExperience` (required, number), `totalExperience` (required, number), `orgChart`/`region`/`onsiteLocation`/`offshoreLocation`/`sapExperience` (optional), `skill` (optional, up to 20000 characters — see the field types note below) |

**Field types beyond `string`/`enum`:** a field's `type` can also be
`"number"` (a finite JS number — no length/enum checks apply), and any
`"string"` field can set `maxLength` to override the default 255-char cap
(`resources.skill` uses `maxLength: 20000`, since real skill lists run
past 12,000 characters).

**Duplicate unique values** (e.g. two `resources` with the same
`employeeId`) return a 422 `validation_error` naming the offending field,
not a raw 500 — see `isUniqueViolation`/`duplicateFieldError` in
`src/errors.js`.

Every record's response includes `id`, the table's own fields, `createdBy`,
`createdAt`, `updatedBy`, `updatedAt`, and `markedDeleted` (camelCase in
responses, snake_case in the database) — plus `code` for
`delivery-centers`, `departments`, `practices`, and `modules` (an
auto-generated, immutable business identifier, distinct from `id`).
`updatedAt` is bumped automatically by a Postgres trigger on every UPDATE,
not by application code.

**`markedDeleted`** (`"Yes"` \| `"No"`): derived from the row's
`deleted_at` column, not a separate stored flag — one source of truth for
delete state. GET routes return every row, soft-deleted included, so a
consumer doing its own aggregation/reporting sees `markedDeleted: "Yes"`
rows and can choose to skip them, rather than have them silently
disappear from every read. Only PATCH/DELETE still refuse to act on an
already soft-deleted row.

**`updatedBy`** (optional on every POST/PATCH): who is performing the
write. Defaults server-side to `"Arshad Gani"` if omitted — no user/auth
system exists yet. On create, this sets both `createdBy` and `updatedBy`;
on update, only `updatedBy` changes. Capped at 255 characters (both in
`validateActor()`/`validateBody()` and as a DB `CHECK` constraint,
`migrations/0006`).

**Why GET is unauthenticated but writes require a key:** the frontend's
dashboard is a public browser bundle — it can never safely hold a
real secret, so reads stay open. Writes go only through the
[master-data MCP server](../mcp-server/README.md), a trusted server-side
client that sends `INTERNAL_API_KEY` on every call.

Reused across all six routers is the shared factory
`createMasterDataRouter(table)` in `src/masterDataRouter.js`: it builds its
SQL column lists, `INSERT`/`UPDATE` statements, and validation from
`table.fields` rather than hardcoding a single `name` column, so a table
can carry its own real business columns (as `delivery-centers` now does)
without a bespoke router.

## Database schema

See `migrations/` — applied to Supabase via the Supabase MCP tool
(`apply_migration`), then committed here for reproducibility.

| Migration | What it does |
|---|---|
| `0001_create_master_data_tables.sql` | The 6 tables: `id`/`name`/`created_at`/`updated_at`/`deleted_at`, `set_updated_at` trigger, RLS enabled with zero policies. |
| `0002_improve_master_data_indexes.sql` | Replaces the `deleted_at`-only indexes with partial indexes on `name`. |
| `0003_create_backend_app_role.sql` | The least-privilege `backend_app` role the backend actually connects as. |
| `0004_add_created_by_updated_by.sql` | Adds `created_by`/`updated_by` (text, not null) to all 6 tables. |
| `0005_add_delivery_center_columns.sql` | `delivery_centers`-specific: `code` (auto-generated via trigger, immutable), `location_type` (`CHECK`-constrained enum), `city`, `country`. |
| `0006_add_actor_length_constraints.sql` | 255-char `CHECK` constraint on `created_by`/`updated_by`, matching the app-layer cap. |
| `0007_add_department_code.sql` | `departments`-specific: `code` (auto-generated via trigger, immutable — same pattern as `delivery_centers`). |
| `0008_rename_skill_sets_to_competencies.sql` | Renames `skill_sets` to `competencies` (and its index/constraint/trigger names) — no column changes. |
| `0009_add_practice_code.sql` | `practices`-specific: `code` (auto-generated via trigger, immutable — same pattern as `delivery_centers`/`departments`). |
| `0010_add_module_columns.sql` | `modules`-specific: `code` (auto-generated via trigger), `module_code` (human-assigned, required), `practice_id` (nullable `uuid`, indexed but **not** a foreign key — deliberately unenforced so a module can be inserted before its Practice is decided). |
| `0011_create_additional_master_data_tables.sql` | 3 new tables (`resource_cost`, `teams`, `resource_deployment`), created directly with the full shape the original 6 accumulated (name-only, same starting point `practices`/`competencies`/etc. had before their own follow-up migrations). |
| `0012_add_resource_columns.sql` | `resources`-specific: 16 real columns imported from an HR export, including `employee_id integer unique not null` — the first caller-supplied (not auto-generated) unique identifier in this schema — and a `location_type` `CHECK` constraint (`Onsite`/`Offshore`, matching the source data's casing). |

Base shape shared by all 6 tables (real per-table columns come from later
migrations — see `src/masterDataTables.js` for the current field list):

```sql
create table public.<table> (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by text not null,
  updated_by text not null
);

create trigger trg_<table>_updated_at before update on public.<table>
  for each row execute function set_updated_at();

alter table public.<table> enable row level security;
-- RLS enabled, zero policies — same pattern as the existing team_members
-- table. Access control is entirely at the application layer (the
-- backend connects with a role that bypasses RLS); this is not
-- PostgREST-facing.
```

`delivery_centers` additionally has `code text` (auto-generated by a
`BEFORE INSERT` trigger + sequence, e.g. `DC-001`; never included in any
`UPDATE`, so it's immutable), `location_type text` (`CHECK`-constrained to
`onshore`/`offshore`), `city text`, `country text`.

Per database.md, never edit a committed migration — add a new one instead
(see `migrations/0002_improve_master_data_indexes.sql` for an example: it
replaces `0001`'s `deleted_at` indexes rather than rewriting that file).

## Production database connection

Deployed on Render (`kaartech-mena-digital-factory-api`) as
`DATABASE_URL`, pointed at Supabase's **session pooler**, not the direct
connection — the direct host (`db.<ref>.supabase.co:5432`) only resolves
to an IPv6 address on Supabase's free tier, and Render's outbound network
is IPv4-only, so the direct connection is unreachable from there. The
pooler host (`aws-0-<region>.pooler.supabase.com:5432`) resolves to IPv4
and proxies straight through to Postgres (Supavisor), so `pg`'s
prepared-statement usage still works — the transaction-mode pooler
(`:6543`) does not support that and would break the app's queries.

The connection uses a dedicated `backend_app` role (see
`migrations/0003_create_backend_app_role.sql`), not the `postgres`
superuser — Supabase's managed Postgres blocks `ALTER ROLE postgres`
outright ("only superusers can alter privileged roles"), and handing the
backend superuser credentials would be worse practice anyway. `backend_app`
has `BYPASSRLS` (required — with RLS enabled and zero policies on every
table, a non-bypassing role gets zero rows on every read and a
`42501 insufficient_privilege` on every write) plus explicit
`SELECT`/`INSERT`/`UPDATE`/`DELETE` on the 7 application tables.

Connection string shape: `postgres://backend_app.<project_ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`
