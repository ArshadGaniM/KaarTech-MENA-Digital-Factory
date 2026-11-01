import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPeople, fetchSeats } from './analyticsApi';

const ok = (data) => ({ ok: true, json: () => Promise.resolve({ data }) });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('analytics api', () => {
  it('reads the people rows', async () => {
    fetch.mockResolvedValue(ok([{ employeeId: 1 }]));

    expect(await fetchPeople()).toEqual([{ employeeId: 1 }]);
    expect(fetch.mock.calls[0][0]).toMatch(/\/v1\/analytics\/people$/);
  });

  it('asks for the month range, encoded', async () => {
    fetch.mockResolvedValue(ok([]));

    await fetchSeats('2026-09', '2027-05');

    expect(fetch.mock.calls[0][0]).toMatch(/\/v1\/analytics\/seats\?from=2026-09&to=2027-05$/);
  });

  it('turns an error response into an Error with the backend message', async () => {
    fetch.mockResolvedValue({ ok: false, status: 422, json: () => Promise.resolve({ error: { message: 'bad range' } }) });

    await expect(fetchSeats('x', 'y')).rejects.toThrow('bad range');
  });

  it('falls back to the status when the error has no body', async () => {
    fetch.mockResolvedValue({ ok: false, status: 502, json: () => Promise.reject(new Error('not json')) });

    await expect(fetchPeople()).rejects.toThrow('failed (502)');
  });

  it('rejects a response that is not a list', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { oops: true } }) });

    await expect(fetchPeople()).rejects.toThrow('malformed');
  });
});
