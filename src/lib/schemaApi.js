const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// FEAT-12: fetches the Entity Relationship page's data from the backend's
// self-updating /v1/schema/entity-relationships endpoint (derived directly
// from MASTER_DATA_TABLES — see backend/src/entityRelationships.js) rather
// than hand-maintaining a duplicate description here that could drift.
export async function fetchEntityRelationships() {
  const res = await fetch(`${BACKEND_URL}/v1/schema/entity-relationships`);
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(payload?.error?.message || 'Failed to load entity relationships');
  }
  if (payload === null) {
    throw new Error('Entity relationships endpoint returned a malformed response.');
  }
  return payload.data;
}
