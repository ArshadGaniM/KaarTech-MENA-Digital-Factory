import { BACKEND_URL } from './masterDataApi';

async function getRows(path) {
  const res = await fetch(`${BACKEND_URL}${path}`);
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(payload?.error?.message || `Request to ${path} failed (${res.status}).`);
  if (payload === null || !Array.isArray(payload.data)) throw new Error(`${path} returned a malformed response.`);
  return payload.data;
}

// One row per live resource.
export const fetchPeople = () => getRows('/v1/analytics/people');

// One row per counted seat per month, from `from` to `to` (YYYY-MM, both included).
export const fetchSeats = (from, to) =>
  getRows(`/v1/analytics/seats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
