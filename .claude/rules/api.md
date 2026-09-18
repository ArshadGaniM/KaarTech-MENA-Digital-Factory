# API Rules — REST Design

> Forward-looking: no backend exists in this project yet. Apply these the moment
> one is introduced.

## URL Structure
- **Plural nouns for resources**: `/messages`, `/sessions`, `/users`
- **Kebab-case** for multi-word segments: `/conversation-sessions`
- **Nest resources** to express ownership: `/sessions/{session_id}/messages`
- **Verbs only for non-CRUD actions**: `/sessions/{id}/summarise`, `/messages/{id}/retry`
- No trailing slashes.

```
GET    /sessions                     → list sessions
POST   /sessions                     → create session
GET    /sessions/{id}                → get session
PATCH  /sessions/{id}                → partial update
DELETE /sessions/{id}                → delete session
GET    /sessions/{id}/messages       → list messages in session
POST   /sessions/{id}/messages       → send a message
```

## Request & Response Schemas
- All request/response bodies are typed models.
- Request models: `<Action><Resource>Request`, e.g. `CreateSessionRequest`.
- Response models: `<Resource>Response`, e.g. `SessionResponse`.
- Never return ORM model objects directly — always convert to a response schema.
- Response bodies always have a consistent shape:
  ```json
  { "data": { ... } }                  // single resource
  { "data": [ ... ], "total": 42 }     // collection
  ```

## HTTP Status Codes
| Situation | Code |
|---|---|
| Successful read | 200 |
| Resource created | 201 |
| No content (delete) | 204 |
| Validation error | 422 |
| Not found | 404 |
| Unauthorised (not logged in) | 401 |
| Forbidden (logged in, wrong permissions) | 403 |
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
since those refuse to act on one.

## Error Responses
```json
{
  "error": {
    "code": "session_not_found",
    "message": "No session with id 'abc-123' exists.",
    "details": {}
  }
}
```
- `code` — machine-readable snake_case string.
- `message` — human-readable English.
- `details` — optional extra context.
- Never expose stack traces, internal paths, or SQL errors to the client.

## Validation
- Validate at the boundary via the framework's model layer.
- Use field-level constraints for lengths, ranges, and patterns.
- Validate foreign keys exist at the service layer, not the route handler.

## Pagination
Offset-based:
```
GET /sessions/messages?limit=20&offset=0
```
Response includes `total`. Default `limit` is 20, max is 100 — enforced in the route handler.

## Authentication
- All routes except `/health` and `/auth/*` require a valid bearer token.
- Use dependency-injection style auth checks — never inline in each route.
- `401` for missing/invalid token, `403` for valid token lacking permissions.

## Streaming Responses
- Server-sent-events style. Each event: `data: {"delta": "..."}\n\n`.
- Final event: `data: [DONE]\n\n`.
- Set `Cache-Control: no-cache` on streaming responses.

## Versioning
- Prefix with `/v1/` once the API stabilises; never break existing endpoints —
  add new fields, don't remove or rename.
