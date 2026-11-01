import { fetchAssignments, fetchCatalog, fetchPeople, fetchSeats, fetchStructure } from '../lib/analyticsApi';
import { useKeyedResource } from './useKeyedResource';

// `refreshKey` is bumped to refetch on demand.
export function useAnalyticsPeople(refreshKey = 0) {
  return useKeyedResource(async () => ({ rows: await fetchPeople() }), 'people', refreshKey);
}

export function useAnalyticsSeats(from, to, refreshKey = 0) {
  return useKeyedResource(async () => ({ rows: await fetchSeats(from, to) }), `seats:${from}:${to}`, refreshKey);
}

export const useAnalyticsStructure = (refreshKey = 0) => useKeyedResource(async () => ({ rows: await fetchStructure() }), 'structure', refreshKey);

export const useAnalyticsCatalog = (refreshKey = 0) => useKeyedResource(async () => ({ rows: await fetchCatalog() }), 'catalog', refreshKey);

export const useAnalyticsAssignments = (refreshKey = 0) => useKeyedResource(async () => ({ rows: await fetchAssignments() }), 'assignments', refreshKey);
