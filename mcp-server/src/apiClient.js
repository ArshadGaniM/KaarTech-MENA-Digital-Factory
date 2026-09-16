const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

export class ApiClientError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `Backend request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new ApiClientError(res.status, payload);
  return payload.data;
}

export function createRecord(route, name) {
  return request(`/v1/${route}`, { method: "POST", body: { name } });
}

export function updateRecord(route, id, name) {
  return request(`/v1/${route}/${id}`, { method: "PATCH", body: { name } });
}

export function markDeleted(route, id) {
  return request(`/v1/${route}/${id}`, { method: "DELETE" });
}
