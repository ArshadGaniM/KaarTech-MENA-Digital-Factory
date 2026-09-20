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

### Master data: `/v1/practices`, `/v1/delivery-centers`, `/v1/competencies`, `/v1/modules`, `/v1/resources`, `/v1/departments`, `/v1/resource-cost`, `/v1/teams`, `/v1/resource-deployment`, `/v1/positions`, `/v1/projects`, `/v1/project-assignments`

All twelve routes share the same shape (`src/masterDataRouter.js`), but each
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
| `competencies` | `name` (required) |
| `resource-cost` | `employeeId` (required, number — must reference an existing `resources.employee_id`, enforced), `employeeName`/`employeeDesignation` (**read-only**, live-looked-up from the referenced resource — not stored columns, never accepted on POST/PATCH), `offshoreCost`/`onsiteCost` (both optional, number, independently settable) |
| `resource-deployment` | `employeeId` (required, number — must reference an existing `resources.employee_id`, enforced), `employeeName` (**read-only**, live-looked-up from the referenced resource), `positionId` (required, string — must reference an existing `positions.code`, enforced), `positionName` (**read-only**, live-looked-up from the referenced position) — the first table with two independent FK/lookup pairs at once |
| `teams` | `name` (required, editable anytime), `departmentCode` (required, string — must reference an existing `departments.code`, enforced), `departmentName` (**read-only**, live-looked-up from the referenced department) — plus an auto-generated `code` (`TEAM-001`, ...) |
| `positions` | `name` (required, editable anytime), `teamCode` (required, string — must reference an existing `teams.code`, enforced), `teamName` (**read-only**, live-looked-up from the referenced team) — plus an auto-generated `code` (`POS-001`, ...) |
| `practices` | `name` (required) — plus an auto-generated `code` (`PRAC-001`, ...) |
| `departments` | `name` (required) — plus an auto-generated `code` (`DEPT-001`, ...) |
| `delivery-centers` | `name` (required), `locationType` (required, `onshore` \| `offshore`), `city` (required), `country` (required) — plus an auto-generated `code` (`DC-001`, ...) |
| `modules` | `moduleCode` (required, human-assigned — distinct from the auto-generated `code`), `name` (required), `practiceId` (optional, a `practices.id` — **not** validated against `practices`; can be set/changed later via PATCH) — plus an auto-generated `code` (`MOD-001`, ...) |
| `resources` | `employeeId` (required, **caller-supplied and unique — not auto-generated**, unlike every other table's identifier), `name` (required), `employmentStatus` (required), `employmentType` (required), `subDivision` (required), `position` (required), `locationType` (required, `Onsite` \| `Offshore`), `designation` (required), `geBatch` (required), `kaarExperience` (required, number), `totalExperience` (required, number), `orgChart`/`region`/`onsiteLocation`/`offshoreLocation`/`sapExperience` (optional), `skill` (optional, up to 20000 characters — see the field types note below) |
| `projects` | `projectId` (required, **caller-supplied and unique — not auto-generated**, same pattern as `resources.employeeId`), `projectName` (required), `projectProfitCenterCode` (required, plain string — no FK/lookup, no reference table named) — the first table with zero enforced FK relationships since FEAT-5 |
| `project-assignments` | `projectId` (required, string — pick-list only, must reference an existing `projects.project_id`, enforced), `projectName`/`projectProfitCenterCode` (**read-only**, live-looked-up from the referenced project), `teamId` (required, string — pick-list only, must reference an existing `teams.code`, enforced), `teamName` (**read-only**, live-looked-up from the referenced team), `departmentId`/`departmentName` (**read-only**, live-looked-up **transitively** through the referenced team's own `departmentCode` — Project Assignments → Teams → Departments, not a direct column/single-hop join on this table), `projectAssignmentStartDate`/`projectAssignmentEndDate` (both required, `date` type — `projectAssignmentEndDate` must not be earlier than `projectAssignmentStartDate`, enforced) — the first table with a chained lookup and cross-field validation |

**Field types beyond `string`/`enum`:** a field's `type` can also be
`"number"` (a finite JS number — no length/enum checks apply), `"date"`
(a string that must parse via `Date.parse` — any ISO 8601 date or
datetime string, e.g. `project-assignments.projectAssignmentStartDate`),
and any `"string"` field can set `maxLength` to override the default
255-char cap (`resources.skill` uses `maxLength: 20000`, since real skill
lists run past 12,000 characters).

**FK validation (`field.references`):** a field can carry a
`references: { table, column }` descriptor to enforce that its value
matches an existing, non-soft-deleted row in that table/column before the
write is allowed (`validateReferences()` in `src/masterDataSchema.js`) —
e.g. `resource-cost.employeeId` must exist in `resources.employee_id`.
This is opt-in per field; a field without `references` behaves exactly
like `modules.practiceId` (accepted, never validated). A bad reference
returns a 422 `validation_error` naming the field.

**Live-lookup fields (`table.lookups`):** a table can carry a `lookups`
array (`[{ table, localColumn, foreignColumn, projections }]`) to expose
read-only fields resolved via a LEFT JOIN at read time rather than stored
columns — e.g. `resource-cost.employeeName`/`employeeDesignation` are
joined live from `resources` on every GET, so they always reflect the
referenced row's *current* name/designation rather than a stale copy.
These fields are never accepted on POST/PATCH; a soft-deleted or missing
referenced row resolves them to `null`, not stale data (the join's
`ON` clause filters `deleted_at is null`, not a `WHERE`, so the base row
itself is still returned).

**Chained/transitive lookups (`lookup.via`):** a lookup entry can set
`via: "<other lookup's table>"` to join off that earlier lookup's own
result instead of off the base table — e.g.
`project-assignments.departmentId`/`departmentName` aren't a column on
`project_assignments` at all; they come from the *linked Team's own*
`departmentCode`, so the `departments` lookup joins off the `teams`
lookup's alias (`via: "teams"`) rather than off `project_assignments`
directly. The `via` target must be an earlier entry in the same
`lookups` array. See `buildLookupPlan` in `src/masterDataSchema.js`.

**Cross-field validation (`table.crossFieldValidations`):** a table can
carry a `crossFieldValidations` array for rules spanning two fields at
once — currently one rule type, `{ type: "dateRange", startKey, endKey,
message }`, enforcing `endKey >= startKey` (e.g.
`project-assignments.projectAssignmentEndDate` must not be earlier than
`projectAssignmentStartDate`). Runs on both POST and PATCH; a PATCH that
only sends one of the two fields is still checked against the *other's
current, stored* value, not skipped. See `validateCrossFields` in
`src/masterDataSchema.js`. A DB-layer `CHECK` constraint mirrors this as
defense-in-depth, same reasoning as every FK's app-layer + DB-layer pair.

**Duplicate unique values** (e.g. two `resources` with the same
`employeeId`) return a 422 `validation_error` naming the offending field,
not a raw 500 — see `isUniqueViolation`/`duplicateFieldError` in
`src/errors.js`.

### `/v1/schema/entity-relationships`

`GET /v1/schema/entity-relationships` (no auth, no params) returns
`{ data: [...] }`, one entry per master-data table, derived directly from
`MASTER_DATA_TABLES` (`src/entityRelationships.js`'s `buildEntityRelationships`)
rather than hand-written — every table's own `hasCode`/`identityField`/
`fields`/`lookups` descriptor is the only source of truth, so this
endpoint (and the frontend's "Entity Relationship" page built on it,
FEAT-12) can never drift out of sync with the real schema. Each entry:

```json
{
  "route": "project-assignments",
  "tableName": "project_assignments",
  "resourceName": "project_assignment",
  "identity": { "type": "none" },
  "relationships": [
    { "field": "projectId", "referencesTable": "projects", "referencesColumn": "project_id" },
    { "field": "teamId", "referencesTable": "teams", "referencesColumn": "code" }
  ],
  "lookups": [
    { "key": "departmentId", "sourceTable": "departments", "via": "teams" },
    { "key": "departmentName", "sourceTable": "departments", "via": "teams" }
  ]
}
```

`identity.type` is one of `"auto-generated"` (a `hasCode` table — `field`
names the business-code column), `"caller-supplied-unique"` (a table with
an explicit `identityField` in its descriptor, e.g. `resources.employeeId`/
`projects.projectId`), or `"none"` (no single identifying field, e.g.
`project_assignments`). `relationships` lists every field with a
`references` descriptor; `lookups` lists every projected lookup key, with
`via` naming the earlier lookup it chains through (`null` for a direct,
single-hop lookup).

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
| `0013_add_resource_cost_columns.sql` | `resource_cost`-specific: drops the placeholder `name` column, adds `employee_id integer not null` (with `fk_resource_cost_resources` foreign key to `resources.employee_id` and `ix_resource_cost_employee_id` index), `offshore_cost numeric`, `onsite_cost numeric` — the first real foreign-key constraint in this schema (every prior cross-table reference, e.g. `modules.practice_id`, is deliberately app-layer-only). |
| `0014_add_team_code_and_department.sql` | `teams`-specific: `code` (auto-generated via trigger, immutable — same pattern as `delivery_centers`/`departments`/`practices`), `department_code text not null` (with `fk_teams_departments` foreign key to `departments.code` and `ix_teams_department_code` index) — `name` stays as-is, no longer a placeholder. |
| `0015_create_positions.sql` | New table `positions`, created directly with its full real shape in one migration (unlike `resource_cost`/`teams`, which started as name-only placeholders): base shape (`id`/`name`/timestamps/`deleted_at`/`created_by`/`updated_by`), `code` (auto-generated via trigger, immutable — `POS-001`, ...), `team_code text not null` (with `fk_positions_teams` foreign key to `teams.code` and `ix_positions_team_code` index). |
| `0016_add_resource_deployment_columns.sql` | `resource_deployment`-specific: drops the placeholder `name` column, adds `employee_id integer not null` (with `fk_resource_deployment_resources` foreign key to `resources.employee_id` and `ix_resource_deployment_employee_id` index) and `position_code text not null` (with `fk_resource_deployment_positions` foreign key to `positions.code` and `ix_resource_deployment_position_code` index) — the first table with two foreign-key constraints and two indexes added in a single migration. |
| `0017_create_projects.sql` | New table `projects`, created directly with its full real shape in one migration (same reasoning as `positions`, 0015 — the table starts empty). No `name` column and no `hasCode` trigger — all three business columns (`project_id`, `project_name`, `project_profit_center_code`) are manually entered, none auto-generated. `project_id` is caller-supplied and DB-enforced-unique (`projects_project_id_unique`), same mechanism as `resources.employee_id` (0012), not the `code`-sequence-and-trigger pattern every other table uses. No foreign keys — the first table since FEAT-5 with zero FK relationships. |
| `0018_create_project_assignments.sql` | New table `project_assignments`, created directly with its full real shape in one migration (table starts empty). No `name`/`hasCode` — `project_id` (FK to `projects.project_id`, `fk_project_assignments_projects`, `ix_project_assignments_project_id` index) and `team_code` (FK to `teams.code`, `fk_project_assignments_teams`, `ix_project_assignments_team_code` index) are both pick-list-only references, the second table (after `resource_deployment`/0016) with two FK constraints at once. `project_assignment_start_date`/`project_assignment_end_date` are plain `date` columns with a DB-layer `CHECK (project_assignment_end_date >= project_assignment_start_date)` mirroring the app-layer cross-field validation as defense-in-depth. No `department_code` column — department fields are resolved entirely through the chained lookup via `teams.department_code`, so there's nothing to store for them here. |

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
