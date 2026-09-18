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
