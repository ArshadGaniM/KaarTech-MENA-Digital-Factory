import { ApiError } from "./errors.js";

// Minimal write-path guard for the master data routes (security-auditor
// gate finding: 6 new fully-CRUD tables + an MCP server with write tools
// sat behind zero authentication). Full bearer-token auth per api.md is a
// separate, larger decision (no user/session model exists in this app
// yet) — this closes the specific gap by requiring a shared secret on
// every write, while leaving reads open so the frontend view (a public
// browser bundle, which can never safely hold a real secret) keeps working
// unauthenticated.
export function requireInternalApiKey(req, res, next) {
  const expected = process.env.INTERNAL_API_KEY;
  const provided = req.header("x-internal-api-key");

  if (!expected || provided !== expected) {
    next(new ApiError(401, "unauthorized", "A valid x-internal-api-key header is required for this operation."));
    return;
  }
  next();
}
