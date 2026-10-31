import { fetchGroupSummary } from '../lib/masterDataApi';
import { useAsyncResource } from './useAsyncResource';

// `refreshKey` is bumped to refetch on demand. Previous data stays in place
// while a refetch is in flight, so a chart does not blank on every click.
export function useGroupSummary(route, groupBy, filters, refreshKey = 0) {
  const filterKey = JSON.stringify(filters);
  return useAsyncResource(() => fetchGroupSummary(route, groupBy, filters), [route, groupBy, filterKey, refreshKey]);
}
