import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  MASTER_DATA_TABLES,
  deleteRecord,
  fetchMasterDataTable,
  fetchAllMasterDataTableRows,
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

    await expect(deleteRecord('practices', 'row-1')).rejects.toThrow('Failed to delete practices record');
  });
});

describe('fetchMasterDataTable', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('throws the backend error message on a non-2xx response', async () => {
    fetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: { message: 'Nope.' } }) });

    await expect(fetchMasterDataTable('resources')).rejects.toThrow('Nope.');
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
});
