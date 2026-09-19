# KaarTech MENA Digital Factory — Master Data MCP Server

An MCP server (stdio transport) exposing 27 tools — `add_`/`update_`/`delete_` for
each of the 9 master data tables (`practice`, `delivery_center`, `competency`,
`module`, `resource`, `department`, `resource_cost`, `team`,
`resource_deployment`). Each tool is a thin client over the backend's
REST API (see `backend/README.md` for the routes it calls).

"delete" is a soft delete: it sets `deleted_at` on the row rather than
removing it. Records added/modified/deleted here are visible in the
frontend's dashboard, where each master-data table is its own sidebar
section (e.g. `#resources`, `#delivery-centers`) — the sidebar also has
one non-table section, `#dashboard`, with no backend content yet. The
dashboard reads directly from the backend and does not go through this
MCP server.

## Setup

```bash
cd mcp-server
npm install
cp .env.example .env
# Fill in BACKEND_URL (defaults to http://localhost:3001) and
# INTERNAL_API_KEY — must exactly match the backend's INTERNAL_API_KEY,
# see backend/.env.example. The backend rejects every write without it.
```

The backend must be running (`cd backend && npm run dev`) before any tool
call will succeed — this server has no database access of its own.

## Running

```bash
npm start
```

This starts the stdio server and blocks, waiting for an MCP client to
connect over stdin/stdout. It is not meant to be run standalone in a
terminal for interactive use — it's a subprocess a client spawns.

## Registering with a Claude Code / Claude Desktop MCP client

Add an entry to the client's MCP server config pointing at this package,
e.g. in `claude_desktop_config.json` (Claude Desktop) or a project's
`.mcp.json` (Claude Code):

```json
{
  "mcpServers": {
    "kaartech-master-data": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/src/index.js"],
      "env": {
        "BACKEND_URL": "http://localhost:3001",
        "INTERNAL_API_KEY": "<same value as backend's INTERNAL_API_KEY>"
      }
    }
  }
}
```

## Tools

For each of `practice`, `delivery_center`, `competency`, `module`,
`resource`, `department`, `resource_cost`, `team`, `resource_deployment`,
there's an `add_<table>`, `update_<table>`, and `delete_<table>` tool.
Each table's own fields differ — see
`src/masterDataTables.js` for the authoritative list — but every
`add_`/`update_` tool additionally accepts an optional `updatedBy: string`
(who is performing the write; defaults to `"Arshad Gani"` if omitted, no
user/auth system exists yet). On create this sets both `createdBy` and
`updatedBy`; on update, only `updatedBy` changes.

| Table | `add_<table>` requires | `update_<table>` accepts (all optional) |
|---|---|---|
| `competency`, `resource_deployment` | `name` | `name` |
| `practice`, `department` | `name` | `name` |
| `resource_cost` | `employeeId` (number — must reference an existing `resource`'s `employeeId`, enforced) | `employeeId`, `offshoreCost`, `onsiteCost` (both numbers, independently settable) |
| `team` | `name`, `departmentCode` (string — must reference an existing `department`'s own auto-generated code, enforced) | `name`, `departmentCode` |
| `module` | `moduleCode`, `name` | `moduleCode`, `name`, `practiceId` |
| `delivery_center` | `name`, `locationType` (`onshore` \| `offshore`), `city`, `country` | `name`, `locationType`, `city`, `country` |
| `resource` | `employeeId`, `name`, `employmentStatus`, `employmentType`, `subDivision`, `position`, `locationType` (`Onsite` \| `Offshore`), `designation`, `geBatch`, `kaarExperience`, `totalExperience` | all of the above, plus `orgChart`, `region`, `onsiteLocation`, `offshoreLocation`, `skill`, `sapExperience` |

`add_<table>` creates a record — `created_at`/`updated_at` are set by the
database, and `delivery_center`/`department`/`practice`/`module`
additionally get an auto-generated, immutable business code
(`DC-001`.../`DEPT-001`.../`PRAC-001`.../`MOD-001`...) they never need to
be told. `module`'s `moduleCode` is a separate, human-assigned code —
distinct from the auto-generated one.

**`module`'s `practiceId`** links to a `practice`'s `id` (not its `code`).
It's optional on `add_module` and unvalidated — a module can be created
without a Practice, or with one that doesn't exist yet, and mapped later
via `update_module`.

**`resource`'s `employeeId`** is unlike every other table's identifier —
it's a required number **you supply**, not auto-generated, and must be
unique. `add_resource` with a duplicate `employeeId` fails with a 422
naming the field, not an auto-generated code collision. `resource`'s
`skill` field accepts up to 20000 characters (other string fields cap at
255) and numeric fields (`kaarExperience`, `sapExperience`,
`totalExperience`) take a JS number, not a string.

**`resource_cost`'s `employeeId`** is validated, unlike `module`'s
`practiceId`: `add_resource_cost`/`update_resource_cost` reject an
`employeeId` that doesn't match an existing (non-deleted) `resource`, with
a 422 naming the field. `resource_cost` also exposes `employeeName` and
`employeeDesignation` in every read, but these are **not** tool
parameters on either `add_resource_cost` or `update_resource_cost` — they
are resolved live from the referenced resource by the backend on every
read, so they always reflect that resource's current name/designation
rather than a value this server could set or go stale.

**`team`'s `departmentCode`** is validated the same way, against
`department`'s own auto-generated `code` (not the department's `id`):
`add_team`/`update_team` reject a `departmentCode` that doesn't match an
existing (non-deleted) `department`, with a 422 naming the field. `team`
also exposes `departmentName` in every read and an auto-generated,
immutable `code` (`TEAM-001`, ...) — neither is a tool parameter on
`add_team`/`update_team`; `departmentName` is resolved live the same way
`resource_cost`'s `employeeName` is, and `code` is set by a database
trigger.

`update_<table>` (`{ id, ...fields }`) changes only the fields you pass;
`updated_at` is bumped automatically by a database trigger.
`delete_<table>` (`{ id }`) soft-deletes a record (sets `deleted_at`, not
physically removed). The row still shows up in reads afterward, flagged
`markedDeleted: "Yes"` — see `backend/README.md` for why.
