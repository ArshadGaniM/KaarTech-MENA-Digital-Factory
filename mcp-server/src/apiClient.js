const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

export class ApiClientError extends Error {
  constructor(status, body) {
    const message = body?.error?.message
      || (body === null
        ? `Backend returned a malformed response (status ${status}).`
        : `Backend request failed with status ${status}.`);
    super(message);
    this.status = status;
    this.body = body;
  }
}

// Every call this client makes is a write (create/update/soft-delete) —
// the backend only requires x-internal-api-key on those routes, never on
// reads, so it's safe to attach it to every request here unconditionally.
async function request(path, { method = "GET", body } = {}) {
  const headers = { "x-internal-api-key": INTERNAL_API_KEY ?? "" };
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new ApiClientError(res.status, payload);
  if (payload === null) throw new ApiClientError(res.status, null);
  return payload.data;
}

export function createRecord(route, fields) {
  return request(`/v1/${route}`, { method: "POST", body: fields });
}

export function updateRecord(route, id, fields) {
  return request(`/v1/${route}/${id}`, { method: "PATCH", body: fields });
}

export function markDeleted(route, id) {
  return request(`/v1/${route}/${id}`, { method: "DELETE" });
}
