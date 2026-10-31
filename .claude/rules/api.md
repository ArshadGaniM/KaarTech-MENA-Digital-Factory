# API Rules — REST Design

> Applies to the Express backend in `backend/`. The route tables, field lists and
> examples live in `backend/README.md`. This file holds the rules they follow.

## URL Structure
- Everything except `/health` lives under `/v1/`.
- **Plural nouns for resources**: `/v1/resources`, `/v1/project-assignments`.
- **Kebab-case** for multi-word segments. The table `project_assignments` is the route
  `project-assignments`.
- **Nest resources** to express ownership: `/v1/control-center/teams/:code`.
- **Verbs only for non-CRUD actions**: `/v1/<table>/:id/restore`.
- No trailing slashes.
- A new master-data table gets its routes from its descriptor in
  `backend/src/masterDataTables.js`. Do not hand-write the seven routes the factory builds (the ones listed above).
  `/v1/team-members` is the one older hand-written router, with its own schema in
  `teamMemberSchema.js`.

```
GET    /v1/<table>                      → list (limit, offset, q, equality filters)
GET    /v1/<table>/summary?groupBy=f    → grouped counts for charts
GET    /v1/<table>/:id                  → get one
POST   /v1/<table>                      → create
PATCH  /v1/<table>/:id                  → partial update
DELETE /v1/<table>/:id                  → soft delete
POST   /v1/<table>/:id/restore          → undo a soft delete
```

## Request & Response Schemas
- Bodies are JSON with **camelCase** keys. Columns are snake_case and are converted at
  the edge.
- The field list for a table is its descriptor. The descriptor is the schema, so
  validation, the response shape and `/v1/schema/entity-relationships` all come from it.
- Never return a raw database row. Convert it with `toResponse`.
- Response bodies always have a consistent shape:
  ```json
  { "data": { ... } }                  // single resource
  { "data": [ ... ], "total": 42 }     // collection (master-data lists also add "activeTotal": live rows only)
  ```
- Writes accept an optional `updatedBy` string. It is stored as `createdBy` on create and
  `updatedBy` on every write. Without it the server uses a default actor, because there
  is no login to say who wrote.

## HTTP Status Codes
| Situation | Code |
|---|---|
| Successful read | 200 |
| Resource created | 201 |
| No content (delete) | 204 |
| Validation error | 422 |
| Not found | 404 |
| Missing or wrong internal API key, or no key set on the server | 401 |
| State conflict (restore of a live row) | 409 |
| Too many open streams | 503 |
| Server error | 500 |

Never return 200 with `{ "error": "..." }` in the body.

**Deliberate deviation pattern:** if a client-side hook globally treats 401 as
"session expired," a third-party integration's token expiring must NOT reuse
401. Use a different code (e.g. 409) with a machine-readable error code, or an
always-200 shape with a `needs_reauth` boolean. Document every such deviation
here so it doesn't get "fixed" back into a bug.

**Documented deviation:** the master-data routes' `GET /v1/<table>/:id`
returns 200 (not 404) for a soft-deleted resource — the response includes
`markedDeleted: "Yes"` instead. 404 is reserved for an id that doesn't exist
at all. Only PATCH/DELETE on those routes still 404 a soft-deleted resource,
since those refuse to act on one; the inverse verb route `POST /v1/<table>/:id/restore` answers 409 (`<resource>_not_deleted`) for a row that exists but is *not* soft-deleted, and 404 only when the id doesn't exist.

## Error Responses
Built with `ApiError` in `backend/src/errors.js`.
```json
{
  "error": {
    "code": "resource_not_found",
    "message": "No resource with id 'abc-123' exists.",
    "details": {}
  }
}
```
- `code` — machine-readable snake_case string.
- `message` — human-readable English.
- `details` — optional extra context. For a 422 it maps field names to messages.
- Never expose stack traces, internal paths, SQL errors or constraint names.
- The central handler in `index.js` returns an `ApiError` as is, logs every 500 and hides
  its cause. It does not translate Postgres errors.
- `mapWriteError` in `masterDataRouter.js` turns 23505 (unique), 23503 (foreign key) and
  22P02 (bad text value) into a 422 that names the field. A router outside the
  master-data router must call the same mapping itself, or the client gets a generic 500.
- Other constraint errors, such as a `check` violation (23514), still surface as a logged
  500. Validate those in the API first.

## Validation
- Ids are UUIDs and the routes do not check the format. A malformed id on `GET /:id` or
  `DELETE /:id` reaches Postgres and returns a logged 500. PATCH and restore map it to a
  422 under the key `value`. Validate the id yourself in any new route.
- Validate at the boundary with `validateBody` from the table descriptor, before any
  query runs.
- Use the descriptor's field constraints for lengths, ranges, patterns and enums.
- Check that referenced rows exist and are live in `validateReferences`, not in the
  route handler. Restore repeats the check.
- Check again in the database with a `check` or unique constraint. The API check gives
  the friendly message and the constraint is the backstop.

## Pagination
Offset-based:
```
GET /v1/resources?limit=20&offset=0
```
Response includes `total`; master-data list routes also include `activeTotal`, which leaves out soft-deleted rows. Default `limit` is 20, max is 100 — enforced in the route handler.

**Aggregate routes are not paginated.** `GET /v1/<table>/summary?groupBy=<field>` returns grouped counts, largest first, capped at 100 groups with no `limit` or `offset`. Its `total` still counts every matching row, including groups past the cap.

## Authentication
- Reads are open. Every write (POST, PATCH, DELETE, restore), including
  `/v1/team-members`, needs the shared key in the `x-internal-api-key` header. The check is `requireInternalApiKey` in
  `backend/src/auth.js`, applied per route, never inline in a handler.
- `401` for a missing or wrong key.

**Documented deviation:** the backend has no login system, so there are no bearer
tokens and no `403`. Replace the shared key with bearer-token auth when real auth
exists (CLAUDE.md §20). Until then the key is visible in the frontend bundle, so treat
the write routes as open to anyone who can load the site.

## Streaming Responses
- Server-sent-events style. Each event: `data: {"delta": "..."}\n\n`.
- Final event: `data: [DONE]\n\n`.
- Set `Cache-Control: no-cache` on streaming responses.
- Cap the number of open streams and answer 503 `too_many_streams` above it.

**Documented deviation:** `GET /v1/control-center/stream` carries no delta
payload and never sends `[DONE]`. It is a change signal, not a response body:
it sends named `event: changed` messages with `data: {}`, and the client
refetches the data. It stays open until the client leaves, with a
`: keep-alive` comment every 25 seconds. Do not "fix" it back to the
delta format.

## CORS
- `FRONTEND_URL` is a comma-separated list of allowed origins. Unset in production
  allows none.

## Testing
- Backend and `mcp-server/` tests use `node:test`. Run `npm test` inside `backend/` or
  `mcp-server/`.
- Tests sit next to the code as `src/<name>.test.js`.
- Route tests mock the database with the helpers in `masterDataRouter.testHelpers.js`.
  They prove wiring and SQL shape, not Postgres execution, so check a new query
  against the real database too.
- Every new route or rule needs a test for the success path, a 422, and a 404 or 401
  where they apply.
- Frontend tests follow `.claude/rules/frontend.md`.

## Versioning
- Everything is under `/v1/`. Never break existing endpoints —
  add new fields, don't remove or rename.
- Keep `backend/README.md` in step with every route or field change.
