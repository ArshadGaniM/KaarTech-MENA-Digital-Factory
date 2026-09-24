export class ApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(resource, id) {
  return new ApiError(404, `${resource}_not_found`, `No ${resource} with id '${id}' exists.`);
}

export function validationError(details) {
  return new ApiError(422, "validation_error", "Request failed validation.", details);
}

// Postgres unique_violation (23505) surfaces as a raw 500 by default —
// this turns it into the same 422 shape as an app-layer validation
// failure, naming whichever field's DB-level uniqueness was violated
// (e.g. resources.employee_id) instead of leaking the constraint name.
export function isUniqueViolation(err) {
  return err?.code === "23505";
}

export function duplicateFieldError(err, fields) {
  const field = fields.find((f) => err.constraint?.includes(f.column));
  const key = field?.key ?? "value";
  return validationError({ [key]: `${key} must be unique — this value is already in use.` });
}

// Postgres foreign_key_violation (23503) surfaces as a raw 500 by default.
// validateReferences() already checks FK existence before every write, so
// this only fires on the narrow race where the referenced row is deleted
// between that check and the INSERT/UPDATE — still a real, reachable path
// once any table's DELETE stops being a soft delete, so it needs the same
// 422 treatment as a unique-violation rather than leaking a raw 500.
export function isForeignKeyViolation(err) {
  return err?.code === "23503";
}

export function referenceNotFoundError(err, fields) {
  const field = fields.find((f) => f.references && err.constraint?.includes(f.references.table));
  const key = field?.key ?? "value";
  return validationError({ [key]: `${key} does not reference an existing row.` });
}

// Postgres invalid_text_representation (22P02) — a value that can't be
// cast to its column's real Postgres type (e.g. a column typed `uuid`
// fed a plain string) surfaces as a raw 500 by default, same class of
// gap as unique/FK violations above. modules.practiceId is the concrete
// case this exists for: the app layer treats it as an unvalidated free
// string (deliberately, no FK check — see masterDataTables.js), but its
// Postgres column is `uuid`, so any non-UUID input reached the DB
// uncaught until this existed. The offending literal is the only thing
// Postgres's error message reliably contains, so matching it back to
// the submitted field (rather than the DB column/constraint, which this
// error class doesn't expose) is the only generically correct way to
// name which field failed.
export function isInvalidTextRepresentation(err) {
  return err?.code === "22P02";
}

export function invalidValueError(err, fields, body) {
  const match = /: "(.*)"$/.exec(err.message ?? "");
  const literal = match?.[1];
  const field = literal != null && body ? fields.find((f) => String(body[f.key]) === literal) : undefined;
  const key = field?.key ?? "value";
  return validationError({ [key]: `${key} is not in a valid format for this field.` });
}
