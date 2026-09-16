import { validationError } from "./errors.js";

export function toResponse(table, row) {
  const response = { id: row.id };
  if (table.hasCode) response.code = row.code;
  for (const field of table.fields) {
    response[field.key] = row[field.column];
  }
  response.createdBy = row.created_by;
  response.createdAt = row.created_at;
  response.updatedBy = row.updated_by;
  response.updatedAt = row.updated_at;
  return response;
}

export function validateBody(table, body, { partial = false } = {}) {
  // express.json() leaves req.body undefined for a request sent without a
  // JSON content-type — treat that the same as an empty object rather than
  // throwing a raw TypeError that would surface as a misleading 500.
  const safeBody = body && typeof body === "object" ? body : {};
  const details = {};

  for (const field of table.fields) {
    const present = safeBody[field.key] !== undefined;
    if (partial && !present) continue;

    const value = safeBody[field.key];
    if (typeof value !== "string" || value.trim().length === 0) {
      details[field.key] = `${field.key} is required and must be a non-empty string.`;
    } else if (field.type === "enum" && !field.values.includes(value)) {
      details[field.key] = `${field.key} must be one of: ${field.values.join(", ")}.`;
    }
  }

  if (Object.keys(details).length > 0) {
    throw validationError(details);
  }
}
