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

// 409: the row exists but live rows of another table still depend on it
// (a practice that competencies still belong to), so deleting it would
// silently orphan them.
// A guard may carry its own `message` where the generic text would not tell the user
// what to do (a position with a person deployed to it).
export function inUse(resource, noun, message) {
  return new ApiError(
    409,
    `${resource}_in_use`,
    message ?? `This ${resource} cannot be deleted while live ${noun} still belong to it. Move or delete them first.`
  );
}

// 409, not 404: the row exists, it just isn't in the state the action needs
// (restore of a row that isn't deleted — e.g. two clients both hit Undo).
export function notDeleted(resource, id) {
  return new ApiError(409, `${resource}_not_deleted`, `The ${resource} with id '${id}' is not deleted, so there is nothing to restore.`);
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

// Postgres exclusion_violation (23P01): the backstop for the rule that a group (a
// resource, or a team) may not hold the same position, or the same project, twice
// on a shared day. The app check gives the friendly message first; this only
// fires if two writes race past it.
export function isExclusionViolation(err) {
  return err?.code === "23P01";
}

// The exclusion constraint refused a second row for the same position (a resource's
// deployments) or the same project (a team's assignments) on a shared day.
export function positionOverlapRaceError(rule) {
  return validationError({
    [rule.uniqueKey]: `This ${rule.groupKey} already holds this ${rule.uniqueNoun ?? "position"} on some of these dates.`,
  });
}

// The same race for the one-Module-Lead-seat-per-team rule: the partial unique index
// refused a second live Module Lead seat that two writes both let past the app check.
export function moduleLeadSeatRaceError(rule) {
  return validationError({ [rule.nameKey]: "This team already has a Module Lead seat. Only one is allowed per team." });
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
