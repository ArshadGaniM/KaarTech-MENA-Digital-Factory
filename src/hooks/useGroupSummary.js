import { fetchGroupSummary } from '../lib/masterDataApi';
import { useKeyedResource } from './useKeyedResource';

// `refreshKey` is bumped to refetch on demand.
export function useGroupSummary(route, groupBy, filters, refreshKey = 0) {
  return useKeyedResource(() => fetchGroupSummary(route, groupBy, filters), JSON.stringify([route, groupBy, filters, refreshKey]));
}
