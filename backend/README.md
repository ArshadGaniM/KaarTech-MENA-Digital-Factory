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

### Master data: `/v1/practices`, `/v1/delivery-centers`, `/v1/skill-sets`, `/v1/modules`, `/v1/resources`, `/v1/departments`

All six routes share one identical shape (`src/masterDataRouter.js`):

| Method | Path | Body | Auth | Notes |
|---|---|---|---|---|
| GET | `/v1/<table>` | — | none | Paginated (`?limit`, max 100; `?offset`). Excludes soft-deleted rows. |
| GET | `/v1/<table>/:id` | — | none | 404 if soft-deleted or missing. |
| POST | `/v1/<table>` | `{ name: string }` | `x-internal-api-key` | 201 with the created record. |
| PATCH | `/v1/<table>/:id` | `{ name: string }` | `x-internal-api-key` | 404 if soft-deleted or missing. |
| DELETE | `/v1/<table>/:id` | — | `x-internal-api-key` | Soft delete — sets `deleted_at`, does not remove the row. 204 on success. |

Every record has `id`, `name`, `createdAt`, `updatedAt` (camelCase in
responses, snake_case in the database). `updatedAt` is bumped automatically
by a Postgres trigger on every UPDATE, not by application code.

**Why GET is unauthenticated but writes require a key:** the frontend's
"Master Data" view is a public browser bundle — it can never safely hold a
real secret, so reads stay open. Writes go only through the
[master-data MCP server](../mcp-server/README.md), a trusted server-side
client that sends `INTERNAL_API_KEY` on every call.

Reused across all six routers is the shared factory
`createMasterDataRouter(tableName, resourceName)` in
`src/masterDataRouter.js`, since all 6 tables have the identical
`id`/`name`/`created_at`/`updated_at`/`deleted_at` shape — see
`src/masterDataTables.js` for the fixed table/route allow-list.

## Database schema

See `migrations/` — applied to Supabase via the Supabase MCP tool
(`apply_migration`), then committed here for reproducibility. Each of the
6 master data tables has the same shape:

```sql
create table public.<table> (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger trg_<table>_updated_at before update on public.<table>
  for each row execute function set_updated_at();

alter table public.<table> enable row level security;
-- RLS enabled, zero policies — same pattern as the existing team_members
-- table. Access control is entirely at the application layer (the
-- backend connects with a role that bypasses RLS); this is not
-- PostgREST-facing.
```

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
