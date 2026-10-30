import { fetchMasterDataTable, MASTER_DATA_TABLES } from '../lib/masterDataApi';
import { useAsyncResource } from './useAsyncResource';

// One-row page per table: the backend returns its totals regardless of
// limit, so this reads every table's count without pulling its data.
// `activeTotal` leaves out soft-deleted rows; `total` is the fallback for a
// backend that doesn't send it yet.
// allSettled, not all — one failing table must not blank the rest of the
// dashboard. A failed table carries `count: null` and its `error`.
async function fetchTableCounts() {
  const results = await Promise.allSettled(
    MASTER_DATA_TABLES.map((table) => fetchMasterDataTable(table.route, { limit: 1, offset: 0 }))
  );
  return MASTER_DATA_TABLES.map((table, i) => {
    const result = results[i];
    return result.status === 'fulfilled'
      ? { route: table.route, label: table.label, count: result.value.activeTotal ?? result.value.total, error: null }
      : { route: table.route, label: table.label, count: null, error: result.reason };
  });
}

export function useTableCounts() {
  return useAsyncResource(fetchTableCounts, []);
}
