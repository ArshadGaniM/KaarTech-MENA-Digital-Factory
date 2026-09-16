# KaarTech MENA Digital Factory — Master Data MCP Server

An MCP server (stdio transport) exposing 18 tools — `add_`/`update_`/`delete_` for
each of the 6 master data tables (`practice`, `delivery_center`, `competency`,
`module`, `resource`, `department`). Each tool is a thin client over the
backend's REST API (see `backend/README.md` for the routes it calls).

"delete" is a soft delete: it sets `deleted_at` on the row rather than
removing it. Records added/modified/deleted here are visible in the
frontend's "Master Data" view (`#master-data`), which reads directly from
the backend and does not go through this MCP server.

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
`resource`, `department`, there's an `add_<table>`, `update_<table>`, and
`delete_<table>` tool. Each table's own fields differ — see
`src/masterDataTables.js` for the authoritative list — but every
`add_`/`update_` tool additionally accepts an optional `updatedBy: string`
(who is performing the write; defaults to `"Arshad Gani"` if omitted, no
user/auth system exists yet). On create this sets both `createdBy` and
`updatedBy`; on update, only `updatedBy` changes.

| Table | `add_<table>` requires | `update_<table>` accepts (all optional) |
|---|---|---|
| `competency`, `resource` | `name` | `name` |
| `practice`, `department` | `name` | `name` |
| `module` | `moduleCode`, `name` | `moduleCode`, `name`, `practiceId` |
| `delivery_center` | `name`, `locationType` (`onshore` \| `offshore`), `city`, `country` | `name`, `locationType`, `city`, `country` |

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
`update_<table>` (`{ id, ...fields }`) changes only the fields you pass;
`updated_at` is bumped automatically by a database trigger.
`delete_<table>` (`{ id }`) soft-deletes a record (sets `deleted_at`; the
row is excluded from all reads afterward, not physically removed).
