import { fetchAllocationSummary } from '../lib/allocationApi';
import { useKeyedResource } from './useKeyedResource';

// `filters` is { bucket, position }, each a string or null. `refreshKey` is
// bumped to refetch on demand.
export function useAllocationSummary(filters, refreshKey = 0) {
  return useKeyedResource(() => fetchAllocationSummary(filters), JSON.stringify(filters), refreshKey);
}
