import { fetchMasterDataTable, MASTER_DATA_TABLES } from '../lib/masterDataApi';
import { useAsyncResource } from './useAsyncResource';

// One-row page per table: the backend returns its totals regardless of
// limit, so this reads every table's count without pulling its data.
// `activeTotal` leaves out soft-deleted rows. There is deliberately no
// fallback to `total`: against a backend that predates `activeTotal` that
// would show deleted rows as live records, a plausible-looking wrong
// number. A table without `activeTotal` is reported as failed instead.
// allSettled, not all: one failing table must not blank the rest of the
// dashboard. A failed table carries `count: null` and its `error`.
// The Dashboard banner only names the failed tables, so the cause goes to
// the console where someone debugging can find it.
function failedCount(route, label, error) {
  console.warn(`Dashboard: could not count ${route}: ${error.message}`);
  return { route, label, count: null, error };
}

async function fetchTableCounts() {
  const results = await Promise.allSettled(
    MASTER_DATA_TABLES.map((table) => fetchMasterDataTable(table.route, { limit: 1, offset: 0 }))
  );
  return MASTER_DATA_TABLES.map((table, i) => {
    const { route, label } = table;
    const result = results[i];
    if (result.status === 'rejected') return failedCount(route, label, result.reason);
    const { activeTotal } = result.value;
    if (activeTotal === undefined) {
      return failedCount(route, label, new Error(`${route} did not report a valid activeTotal. The backend may need updating.`));
    }
    return { route, label, count: activeTotal, error: null };
  });
}

export function useTableCounts(refreshKey = 0) {
  return useAsyncResource(fetchTableCounts, [refreshKey]);
}
