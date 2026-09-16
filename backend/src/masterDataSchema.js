import { validationError } from "./errors.js";

export function toResponse(row) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function validateBody(body, { partial = false } = {}) {
  // express.json() leaves req.body undefined for a request sent without a
  // JSON content-type — treat that the same as an empty object rather than
  // throwing a raw TypeError that would surface as a misleading 500.
  const safeBody = body && typeof body === "object" ? body : {};
  const details = {};
  if (!partial || safeBody.name !== undefined) {
    if (typeof safeBody.name !== "string" || safeBody.name.trim().length === 0) {
      details.name = "name is required and must be a non-empty string.";
    }
  }
  if (Object.keys(details).length > 0) {
    throw validationError(details);
  }
}
