import { fetchPeople, fetchSeats } from '../lib/analyticsApi';
import { useKeyedResource } from './useKeyedResource';

// `refreshKey` is bumped to refetch on demand.
export function useAnalyticsPeople(refreshKey = 0) {
  return useKeyedResource(async () => ({ rows: await fetchPeople() }), 'people', refreshKey);
}

export function useAnalyticsSeats(from, to, refreshKey = 0) {
  return useKeyedResource(async () => ({ rows: await fetchSeats(from, to) }), `seats:${from}:${to}`, refreshKey);
}
