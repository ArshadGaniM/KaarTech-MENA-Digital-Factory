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
