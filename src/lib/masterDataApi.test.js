import { describe, expect, it } from 'vitest';
import { MASTER_DATA_TABLES } from './masterDataApi';

function columnsFor(route) {
  return MASTER_DATA_TABLES.find((table) => table.route === route).columns;
}

describe('MASTER_DATA_TABLES column definitions', () => {
  // FEAT-15: resource-cost, resource-deployment, and project-assignments have
  // identity: "none" (see useEntityRelationships) — the internal row id is the
  // only thing the "Delete by Code or ID" popup can match against, so each of
  // these tables must render a "Record ID" column backed by the `id` key.
  it.each(['resource-cost', 'resource-deployment', 'project-assignments'])(
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
