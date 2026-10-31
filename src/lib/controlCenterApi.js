import { BACKEND_URL } from './masterDataApi';

async function getJson(path) {
  const res = await fetch(`${BACKEND_URL}${path}`);
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(payload?.error?.message || `Request to ${path} failed (${res.status}).`);
  if (payload === null || payload.data === undefined) throw new Error(`${path} returned a malformed response.`);
  return payload.data;
}

export async function fetchControlCenter(month) {
  const data = await getJson(`/v1/control-center?month=${encodeURIComponent(month)}`);
  if (!Array.isArray(data.departments)) throw new Error('The control center returned a malformed response.');
  return data;
}

export async function fetchTeamDetail(code, month) {
  const data = await getJson(`/v1/control-center/teams/${encodeURIComponent(code)}?month=${encodeURIComponent(month)}`);
  if (!Array.isArray(data.seats)) throw new Error('The team returned a malformed response.');
  return data;
}

export const CONTROL_CENTER_STREAM_URL = `${BACKEND_URL}/v1/control-center/stream`;
