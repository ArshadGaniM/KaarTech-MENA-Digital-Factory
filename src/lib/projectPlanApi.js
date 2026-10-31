import { BACKEND_URL } from './masterDataApi';

// Actual progress against the locked project plan (backend /v1/project-plan).
// Reads are open; writes carry the same shared key as the other write routes.

const writeHeaders = () => ({
  'Content-Type': 'application/json',
  'x-internal-api-key': import.meta.env.VITE_INTERNAL_API_KEY || '',
});

async function failure(res, fallback) {
  const payload = await res.json().catch(() => null);
  const error = new Error(payload?.error?.message || `${fallback} (HTTP ${res.status}).`);
  error.details = payload?.error?.details ?? {};
  return error;
}

// { "1a": { activityKey, actualStartWeek, actualEndWeek, actualPoc, ... }, ... }
export async function fetchPlanActuals() {
  const res = await fetch(`${BACKEND_URL}/v1/project-plan/actuals`);
  if (!res.ok) throw await failure(res, 'Failed to load the actual progress');
  const payload = await res.json().catch(() => null);
  if (!Array.isArray(payload?.data)) throw new Error('The actual progress returned a malformed response.');
  return Object.fromEntries(payload.data.map((actual) => [actual.activityKey, actual]));
}

export async function savePlanActual(activityKey, { actualStartWeek, actualEndWeek, actualPoc }) {
  const res = await fetch(`${BACKEND_URL}/v1/project-plan/actuals/${encodeURIComponent(activityKey)}`, {
    method: 'PUT',
    headers: writeHeaders(),
    body: JSON.stringify({ actualStartWeek, actualEndWeek, actualPoc }),
  });
  if (!res.ok) throw await failure(res, 'Failed to save the actual progress');
  const payload = await res.json().catch(() => null);
  if (!payload?.data) throw new Error('The saved actual progress could not be read.');
  return payload.data;
}

export async function clearPlanActual(activityKey) {
  const res = await fetch(`${BACKEND_URL}/v1/project-plan/actuals/${encodeURIComponent(activityKey)}`, {
    method: 'DELETE',
    headers: writeHeaders(),
  });
  if (!res.ok) throw await failure(res, 'Failed to clear the actual progress');
}
