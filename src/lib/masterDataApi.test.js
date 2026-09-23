import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MASTER_DATA_TABLES, deleteRecord } from './masterDataApi';

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
