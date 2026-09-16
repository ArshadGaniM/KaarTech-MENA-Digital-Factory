import { validationError } from "./errors.js";

const MAX_TEXT_LENGTH = 255;

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
  // Derived from deleted_at (the actual soft-delete flag) rather than its
  // own stored column, so there's one source of truth for delete state —
  // a separate persisted Yes/No column could drift out of sync with it.
  response.markedDeleted = row.deleted_at != null ? "Yes" : "No";
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
    // Required fields must be validated on create even if omitted (so the
    // "missing" case itself gets flagged); on update, and for non-required
    // fields, only validate when the caller actually sent a value.
    const mustValidate = field.required ? !partial || present : present;
    if (!mustValidate) continue;

    const value = safeBody[field.key];
    if (typeof value !== "string" || value.trim().length === 0) {
      details[field.key] = field.required
        ? `${field.key} is required and must be a non-empty string.`
        : `${field.key} must be a non-empty string.`;
    } else if (value.length > MAX_TEXT_LENGTH) {
      details[field.key] = `${field.key} must be ${MAX_TEXT_LENGTH} characters or fewer.`;
    } else if (field.type === "enum" && !field.values.includes(value)) {
      details[field.key] = `${field.key} must be one of: ${field.values.join(", ")}.`;
    }
  }

  if (Object.keys(details).length > 0) {
    throw validationError(details);
  }
}

// updatedBy is caller-supplied free text on every write (see
// masterDataRouter.js) but isn't part of any table's `fields` list, so it
// needs its own length guard rather than piggybacking on validateBody.
export function validateActor(actor) {
  if (actor.length > MAX_TEXT_LENGTH) {
    throw validationError({ updatedBy: `updatedBy must be ${MAX_TEXT_LENGTH} characters or fewer.` });
  }
}
