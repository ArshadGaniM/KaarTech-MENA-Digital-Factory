import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPlanActual, fetchPlanActuals, savePlanActual } from './initiativePlanApi';

describe('initiativePlanApi', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('loads the actuals keyed by activity', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [{ activityKey: '1a', actualPoc: 100 }] }) });

    expect(await fetchPlanActuals()).toEqual({ '1a': { activityKey: '1a', actualPoc: 100 } });
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/v1\/initiative-plan\/actuals$/));
  });

  it('rejects a malformed list and a failed load', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await expect(fetchPlanActuals()).rejects.toThrow(/malformed/);

    fetch.mockResolvedValue({ ok: false, status: 502, json: () => Promise.reject(new Error('no')) });
    await expect(fetchPlanActuals()).rejects.toThrow(/HTTP 502/);
  });

  it('saves with PUT, the key header and only the three fields', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { activityKey: '2b' } }) });

    await savePlanActual('2b', { actualStartWeek: 18, actualEndWeek: null, actualPoc: 40 });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/v1\/initiative-plan\/actuals\/2b$/),
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ 'x-internal-api-key': expect.any(String) }),
        body: JSON.stringify({ actualStartWeek: 18, actualEndWeek: null, actualPoc: 40 }),
      })
    );
  });

  it('carries the per-field details of a 422', async () => {
    fetch.mockResolvedValue({ ok: false, status: 422, json: () => Promise.resolve({ error: { message: 'Bad.', details: { actualPoc: 'no' } } }) });

    await expect(savePlanActual('1a', { actualPoc: 1 })).rejects.toMatchObject({ message: 'Bad.', details: { actualPoc: 'no' } });
  });

  it('clears with DELETE', async () => {
    fetch.mockResolvedValue({ ok: true });

    await clearPlanActual('1a');

    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/actuals\/1a$/), expect.objectContaining({ method: 'DELETE' }));
  });
});
