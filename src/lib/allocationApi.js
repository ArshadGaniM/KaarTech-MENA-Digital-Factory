import { BACKEND_URL } from './masterDataApi';

// The four ways a resource's total deployment can fall, in display order.
export const ALLOCATION_BUCKETS = ['full', 'partial', 'none', 'over'];

// The most position names the backend sends. A list this long may have been cut off.
export const ALLOCATION_MAX_POSITIONS = 50;

// People per allocation bucket and per position (GET /v1/allocation/summary).
// Each side is already filtered by the other's pick: `bucket` narrows the
// positions, `position` narrows the buckets. A filter left null is not sent.
export async function fetchAllocationSummary({ bucket = null, position = null } = {}) {
  const params = new URLSearchParams();
  if (bucket !== null) params.set('bucket', bucket);
  if (position !== null) params.set('position', position);
  const query = params.toString();
  const res = await fetch(`${BACKEND_URL}/v1/allocation/summary${query ? `?${query}` : ''}`);
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(payload?.error?.message || `Failed to load the allocation summary (HTTP ${res.status})`);
  }
  const { buckets, positions } = payload?.data ?? {};
  const isCount = (count) => Number.isFinite(count) && count >= 0;
  const valid =
    Array.isArray(buckets) &&
    buckets.length === ALLOCATION_BUCKETS.length &&
    ALLOCATION_BUCKETS.every((key, i) => buckets[i]?.key === key && isCount(buckets[i].count)) &&
    Array.isArray(positions) &&
    positions.every((row) => typeof row?.value === 'string' && isCount(row.count));
  if (!valid) {
    throw new Error('The allocation summary returned a malformed response.');
  }
  return { buckets, positions };
}
