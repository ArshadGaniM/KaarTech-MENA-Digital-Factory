import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchControlCenter, fetchTeamDetail } from './controlCenterApi';

const respond = (status, body) => ({ ok: status < 400, status, json: () => (body === undefined ? Promise.reject(new Error('bad json')) : Promise.resolve(body)) });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('controlCenterApi', () => {
  it('requests the snapshot for the month and returns its data', async () => {
    fetch.mockResolvedValue(respond(200, { data: { departments: [{ code: 'D' }] } }));
    expect(await fetchControlCenter('2026-10')).toEqual({ departments: [{ code: 'D' }] });
    expect(fetch.mock.calls[0][0]).toMatch(/\/v1\/control-center\?month=2026-10$/);
  });

  it('requests one team for the month', async () => {
    fetch.mockResolvedValue(respond(200, { data: { seats: [] } }));
    await fetchTeamDetail('TEAM-001', '2026-10');
    expect(fetch.mock.calls[0][0]).toMatch(/\/v1\/control-center\/teams\/TEAM-001\?month=2026-10$/);
  });

  it('turns an error response into an error with the backend message', async () => {
    fetch.mockResolvedValue(respond(422, { error: { message: 'month must look like 2026-10.' } }));
    await expect(fetchControlCenter('bad')).rejects.toThrow('month must look like 2026-10.');
  });

  it('falls back to a generic message when the error body is not JSON', async () => {
    fetch.mockResolvedValue(respond(502, undefined));
    await expect(fetchControlCenter('2026-10')).rejects.toThrow(/failed \(502\)/);
  });

  it.each([
    ['no data field', { nothing: true }],
    ['data without departments', { data: [] }],
  ])('rejects a malformed snapshot: %s', async (_name, body) => {
    fetch.mockResolvedValue(respond(200, body));
    await expect(fetchControlCenter('2026-10')).rejects.toThrow(/malformed/);
  });

  it('rejects a team without seats', async () => {
    fetch.mockResolvedValue(respond(200, { data: {} }));
    await expect(fetchTeamDetail('TEAM-001', '2026-10')).rejects.toThrow(/malformed/);
  });
});
