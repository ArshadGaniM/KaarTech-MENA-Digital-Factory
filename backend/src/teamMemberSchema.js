import { validationError } from "./errors.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function toResponse(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    department: row.department,
    email: row.email,
    avatarUrl: row.avatar_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function validateBody(body, { partial = false } = {}) {
  const details = {};
  if (!partial || body.fullName !== undefined) {
    if (typeof body.fullName !== "string" || body.fullName.trim().length === 0) {
      details.fullName = "fullName is required and must be a non-empty string.";
    }
  }
  if (body.email !== undefined && body.email !== null && !EMAIL_PATTERN.test(body.email)) {
    details.email = "email must be a valid email address.";
  }
  if (body.status !== undefined && !["active", "inactive"].includes(body.status)) {
    details.status = "status must be 'active' or 'inactive'.";
  }
  if (Object.keys(details).length > 0) {
    throw validationError(details);
  }
}
