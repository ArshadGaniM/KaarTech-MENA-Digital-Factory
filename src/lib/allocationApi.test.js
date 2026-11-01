import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAllocationSummary } from './allocationApi';

const buckets = [
  { key: 'full', count: 98 },
  { key: 'partial', count: 0 },
  { key: 'none', count: 2658 },
  { key: 'over', count: 0 },
];
const ok = (data) => ({ ok: true, json: () => Promise.resolve({ data }) });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchAllocationSummary', () => {
  it('requests the summary with no query string when nothing is filtered', async () => {
    fetch.mockResolvedValue(ok({ buckets, positions: [{ value: 'Consultant', count: 71 }] }));

    const result = await fetchAllocationSummary();

    expect(new URL(fetch.mock.calls[0][0]).search).toBe('');
    expect(new URL(fetch.mock.calls[0][0]).pathname).toBe('/v1/allocation/summary');
    expect(result.buckets).toHaveLength(4);
    expect(result.positions).toEqual([{ value: 'Consultant', count: 71 }]);
  });

  it('sends only the filters that are set, encoded', async () => {
    fetch.mockResolvedValue(ok({ buckets, positions: [] }));

    await fetchAllocationSummary({ bucket: 'full', position: 'Lead Consultant & Co' });

    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.searchParams.get('bucket')).toBe('full');
    expect(url.searchParams.get('position')).toBe('Lead Consultant & Co');
  });

  it('omits a null filter', async () => {
    fetch.mockResolvedValue(ok({ buckets, positions: [] }));

    await fetchAllocationSummary({ bucket: null, position: 'Consultant' });

    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.searchParams.has('bucket')).toBe(false);
  });

  it("throws the backend's own message on an error response", async () => {
    fetch.mockResolvedValue({ ok: false, status: 422, json: () => Promise.resolve({ error: { message: 'bucket must be one of: full.' } }) });

    await expect(fetchAllocationSummary({ bucket: 'x' })).rejects.toThrow('bucket must be one of: full.');
  });

  it('includes the HTTP status when an error body is not JSON', async () => {
    fetch.mockResolvedValue({ ok: false, status: 502, json: () => Promise.reject(new SyntaxError('Unexpected token <')) });

    await expect(fetchAllocationSummary()).rejects.toThrow('HTTP 502');
  });

  it.each([
    ['no data', {}],
    ['buckets missing', { positions: [] }],
    ['a missing bucket', { buckets: buckets.slice(0, 3), positions: [] }],
    ['buckets out of order', { buckets: [...buckets].reverse(), positions: [] }],
    ['a negative count', { buckets: [{ key: 'full', count: -1 }, ...buckets.slice(1)], positions: [] }],
    ['a non-numeric count', { buckets: [{ key: 'full', count: '98' }, ...buckets.slice(1)], positions: [] }],
    ['positions missing', { buckets }],
    ['a position with no name', { buckets, positions: [{ count: 3 }] }],
    ['a position with a bad count', { buckets, positions: [{ value: 'A', count: NaN }] }],
  ])('rejects a malformed response (%s)', async (_label, data) => {
    fetch.mockResolvedValue(ok(data));

    await expect(fetchAllocationSummary()).rejects.toThrow(/malformed/);
  });
});
