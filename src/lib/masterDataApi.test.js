import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  MASTER_DATA_TABLES,
  deleteRecord,
  createRecord,
  updateRecord,
  restoreRecord,
  fetchMasterDataTable,
  fetchAllMasterDataTableRows,
  fetchGroupSummary,
} from './masterDataApi';

function columnsFor(route) {
  return MASTER_DATA_TABLES.find((table) => table.route === route).columns;
}

describe('MASTER_DATA_TABLES column definitions', () => {
  // FEAT-15: competencies, resource-cost, resource-deployment, and
  // project-assignments all have identity: "none" (see useEntityRelationships)
  // — the internal row id is the only thing the "Delete by Code or ID" popup
  // can match against, so each of these tables must render a "Record ID"
  // column backed by the `id` key.
  it.each(['competencies', 'resource-cost', 'resource-deployment', 'project-assignments'])(
    'gives %s a "Record ID" column bound to the `id` key, first in the column order',
    (route) => {
      const columns = columnsFor(route);
      expect(columns[0]).toEqual({ key: 'id', label: 'Record ID' });
    }
  );

  // FEAT-20: departments gained two optional free-text fields.
  it('gives departments Floor Number, Input and Output columns between the name and the audit columns', () => {
    const keys = columnsFor('departments').map((column) => column.key);
    expect(keys.slice(0, 5)).toEqual(['code', 'name', 'floorNumber', 'input', 'output']);
  });

  // FEAT-21: a resource can hold several deployments, each with a share.
  it('gives resource-deployment Allocation % and Employee Total % columns after the position columns', () => {
    const keys = columnsFor('resource-deployment').map((column) => column.key);
    expect(keys.slice(3, 7)).toEqual(['positionId', 'positionName', 'allocationPercentage', 'employeeTotalAllocation']);
  });

  // FEAT-22: positions record the competencies they need.
  it('gives positions a Competencies column after the team columns', () => {
    const keys = columnsFor('positions').map((column) => column.key);
    expect(keys.slice(2, 5)).toEqual(['teamCode', 'teamName', 'competencies']);
  });

  // Tables with a business identity (auto-generated code or caller-supplied
  // unique field) don't need the internal id surfaced — the Delete popup
  // matches on their business identity instead.
  it.each(['practices', 'projects'])('does not add a Record ID column to %s', (route) => {
    const columns = columnsFor(route);
    expect(columns.some((column) => column.key === 'id')).toBe(false);
  });
});

describe('deleteRecord', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a DELETE request to the record\'s own route/id with the internal API key header', async () => {
    fetch.mockResolvedValue({ ok: true });

    await deleteRecord('practices', 'row-1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/v1\/practices\/row-1$/),
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ 'x-internal-api-key': expect.any(String) }),
      })
    );
  });

  it('resolves without throwing on a successful response', async () => {
    fetch.mockResolvedValue({ ok: true });

    await expect(deleteRecord('practices', 'row-1')).resolves.toBeUndefined();
  });

  it('throws the backend error message on a non-2xx JSON response', async () => {
    fetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'No such record.' } }),
    });

    await expect(deleteRecord('practices', 'row-1')).rejects.toThrow('No such record.');
  });

  it('falls back to a generic message on a non-2xx response with a non-JSON body', async () => {
    fetch.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error('not json')),
    });

    await expect(deleteRecord('practices', 'row-1')).rejects.toThrow('Failed to delete practices record (HTTP');
  });
});

describe('fetchMasterDataTable', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes activeTotal through when the backend sends it', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [], total: 10, activeTotal: 4 }) });

    expect((await fetchMasterDataTable('resources')).activeTotal).toBe(4);
  });

  it.each([
    ['absent', undefined],
    ['negative', -1],
    ['a string', '4'],
    ['NaN', NaN],
  ])('treats an activeTotal that is %s as missing', async (_label, activeTotal) => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [], total: 10, activeTotal }) });

    expect((await fetchMasterDataTable('resources')).activeTotal).toBeUndefined();
  });

  it('defaults to limit=20, offset=0 and returns { rows, total } (CLAUDE.md §10)', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [{ id: '1' }], total: 45 }) });

    const result = await fetchMasterDataTable('resources');

    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/v1\/resources\?limit=20&offset=0$/));
    expect(result).toEqual({ rows: [{ id: '1' }], total: 45 });
  });

  it('sends the given limit/offset (FEAT-18 pagination)', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [], total: 45 }) });

    await fetchMasterDataTable('resources', { limit: 20, offset: 40 });

    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/v1\/resources\?limit=20&offset=40$/));
  });

  // FEAT-24
  it('sends a trimmed search term as q, and omits q when the term is blank', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [], total: 0 }) });

    await fetchMasterDataTable('resources', { query: '  Nithya  ' });
    expect(fetch).toHaveBeenLastCalledWith(expect.stringMatching(/\/v1\/resources\?limit=20&offset=0&q=Nithya$/));

    await fetchMasterDataTable('resources', { query: '   ' });
    expect(fetch).toHaveBeenLastCalledWith(expect.stringMatching(/\/v1\/resources\?limit=20&offset=0$/));
  });

  it('throws the backend error message on a non-2xx response', async () => {
    fetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: { message: 'Nope.' } }) });

    await expect(fetchMasterDataTable('resources')).rejects.toThrow('Nope.');
  });

  // Gate finding (code-reviewer): an undefined/NaN/negative total would
  // otherwise propagate into totalPages as NaN, and into
  // fetchAllMasterDataTableRows's loop-termination check where it could
  // never be satisfied — reject it once, here, for every caller.
  it.each([
    ['missing', undefined],
    ['non-numeric', 'not-a-number'],
    ['negative', -1],
  ])('rejects a %s total instead of returning it', async (_label, badTotal) => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [], total: badTotal }) });

    await expect(fetchMasterDataTable('resources')).rejects.toThrow(/invalid total/);
  });

  it('includes the route and offset in the error when the response body fails to parse as JSON', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error('Unexpected token')),
    });

    await expect(fetchMasterDataTable('resources', { limit: 100, offset: 1400 })).rejects.toThrow(
      /resources.*offset 1400.*limit 100.*Unexpected token/
    );
  });
});

describe('fetchAllMasterDataTableRows', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // FEAT-18: an FK pick-list and the "Delete by Code or ID" search both
  // need every active row, not just one visible page — a table with more
  // rows than the backend's 100-row page cap (e.g. resources, 2,756 rows)
  // must page through transparently rather than silently returning only
  // the first page.
  it('pages through until every row is collected, across more than one backend page', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: Array.from({ length: 100 }, (_, i) => ({ id: String(i) })), total: 150 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: Array.from({ length: 50 }, (_, i) => ({ id: String(100 + i) })), total: 150 }),
      });

    const rows = await fetchAllMasterDataTableRows('resources');

    expect(rows).toHaveLength(150);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringMatching(/\/v1\/resources\?limit=100&offset=0$/));
    expect(fetch).toHaveBeenNthCalledWith(2, expect.stringMatching(/\/v1\/resources\?limit=100&offset=100$/));
  });

  it('stops after one page when the table has fewer rows than the page size', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [{ id: '1' }], total: 1 }) });

    const rows = await fetchAllMasterDataTableRows('practices');

    expect(rows).toEqual([{ id: '1' }]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  // Performance (gate finding, code-reviewer): once `total` is known from
  // the first page, every remaining page's offset is already known too —
  // this fetches them all at once instead of one at a time, so a 2,756-row
  // table (resources, ~28 pages) is ~2 round-trips, not ~28.
  it('fetches the first page alone, then every remaining page in parallel', async () => {
    const page = (n, offset) => ({
      ok: true,
      json: () => Promise.resolve({ data: Array.from({ length: n }, (_, i) => ({ id: String(offset + i) })), total: 250 }),
    });
    fetch
      .mockResolvedValueOnce(page(100, 0))
      .mockResolvedValueOnce(page(100, 100))
      .mockResolvedValueOnce(page(50, 200));

    const rows = await fetchAllMasterDataTableRows('resources');

    expect(rows).toHaveLength(250);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringMatching(/offset=0$/));
    // Calls 2 and 3 are issued together (Promise.all), not awaited
    // sequentially — both offsets must appear, order between them isn't
    // guaranteed by the implementation.
    const laterCalls = fetch.mock.calls.slice(1).map(([url]) => url);
    expect(laterCalls.some((url) => /offset=100$/.test(url))).toBe(true);
    expect(laterCalls.some((url) => /offset=200$/.test(url))).toBe(true);
  });

  it('throws rather than looping forever if a page keeps returning rows at an offset that never reaches total', async () => {
    // Every call looks like "there's more" — offset never catches up to
    // total(1_000_000), simulating a backend that's stuck/misreporting.
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: Array.from({ length: 100 }, (_, i) => ({ id: String(i) })), total: 1_000_000 }),
    });

    await expect(fetchAllMasterDataTableRows('resources')).rejects.toThrow(/more pages than expected/);
  });
});

// FEAT-19: PATCH and the restore action share createRecord's write path.
describe('updateRecord / restoreRecord / createRecord', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('updateRecord PATCHes the record\'s own route/id with the key header and only the given fields', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { id: 'row-1' } }) });

    const result = await updateRecord('departments', 'row-1', { name: 'New' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/v1\/departments\/row-1$/),
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ 'x-internal-api-key': expect.any(String) }),
        body: JSON.stringify({ name: 'New' }),
      })
    );
    expect(result).toEqual({ id: 'row-1' });
  });

  it('restoreRecord POSTs to /:id/restore', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { id: 'row-1' } }) });

    await restoreRecord('teams', 'row-1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/v1\/teams\/row-1\/restore$/),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it.each([
    ['createRecord', () => createRecord('departments', {}), 'Failed to create departments record'],
    ['updateRecord', () => updateRecord('departments', 'row-1', {}), 'Failed to update departments record'],
    ['restoreRecord', () => restoreRecord('departments', 'row-1'), 'Failed to restore departments record'],
  ])('%s throws the backend message and carries the per-field `details` from a 422', async (_name, call) => {
    fetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Request failed validation.', details: { name: 'bad' } } }),
    });

    await expect(call()).rejects.toMatchObject({ message: 'Request failed validation.', details: { name: 'bad' } });
  });

  it.each([
    ['createRecord', () => createRecord('departments', {}), 'Failed to create departments record (HTTP 502).'],
    ['updateRecord', () => updateRecord('departments', 'row-1', {}), 'Failed to update departments record (HTTP 502).'],
    ['restoreRecord', () => restoreRecord('departments', 'row-1'), 'Failed to restore departments record (HTTP 502).'],
  ])('%s falls back to a message carrying the HTTP status when the error body is not JSON', async (_name, call, message) => {
    fetch.mockResolvedValue({ ok: false, status: 502, json: () => Promise.reject(new Error('not json')) });

    await expect(call()).rejects.toMatchObject({ message, details: {} });
  });

  it('throws rather than reporting success when a 2xx response carries no readable record', async () => {
    fetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.reject(new Error('not json')) });

    await expect(updateRecord('departments', 'row-1', {})).rejects.toThrow(/could not be read/);
  });
});

describe('fetchGroupSummary', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests the summary route with groupBy and only the filters that have a value', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ value: 'Onsite', count: 3 }, { value: null, count: 1 }], total: 4 }),
    });

    const result = await fetchGroupSummary('resources', 'designation', { locationType: 'Offshore', skill: null });

    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.pathname).toBe('/v1/resources/summary');
    expect(url.searchParams.get('groupBy')).toBe('designation');
    expect(url.searchParams.get('locationType')).toBe('Offshore');
    expect(url.searchParams.has('skill')).toBe(false);
    expect(result).toEqual({
      groups: [
        { value: 'Onsite', count: 3 },
        { value: null, count: 1 },
      ],
      total: 4,
    });
  });

  it("throws the backend's own message on an error response", async () => {
    fetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'groupBy must be one of: name.' } }),
    });

    await expect(fetchGroupSummary('resources', 'nope')).rejects.toThrow('groupBy must be one of: name.');
  });

  it("includes the HTTP status when an error body is not JSON, such as a proxy 502", async () => {
    fetch.mockResolvedValue({ ok: false, status: 502, json: () => Promise.reject(new SyntaxError('Unexpected token <')) });

    await expect(fetchGroupSummary('resources', 'designation')).rejects.toThrow('HTTP 502');
  });

  it.each([
    ['missing', { data: [{ value: 'a', count: 3 }] }],
    ['negative', { data: [{ value: 'a', count: 3 }], total: -1 }],
    ['a string', { data: [{ value: 'a', count: 3 }], total: '3' }],
  ])('rejects a response whose total is %s instead of summing the groups', async (_label, payload) => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) });

    await expect(fetchGroupSummary('resources', 'designation')).rejects.toThrow(/malformed/);
  });

  it('keeps the backend total even when it is larger than the groups it sent', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [{ value: 'a', count: 3 }], total: 500 }) });

    expect((await fetchGroupSummary('resources', 'designation')).total).toBe(500);
  });

  it.each([
    ['not an array', { data: 'x', total: 1 }],
    ['a negative count', { data: [{ value: 'a', count: -1 }], total: 1 }],
    ['a non-numeric count', { data: [{ value: 'a', count: '3' }], total: 1 }],
    ['no body data', {}],
  ])('rejects a malformed response (%s)', async (_label, payload) => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) });

    await expect(fetchGroupSummary('resources', 'designation')).rejects.toThrow(/malformed/);
  });
});
