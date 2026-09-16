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
  const details = {};
  if (!partial || body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      details.name = "name is required and must be a non-empty string.";
    }
  }
  if (Object.keys(details).length > 0) {
    throw validationError(details);
  }
}
