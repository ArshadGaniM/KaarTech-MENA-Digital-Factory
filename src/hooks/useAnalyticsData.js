import { fetchAssignments, fetchCatalog, fetchHealth, fetchPeople, fetchSeats, fetchStructure } from '../lib/analyticsApi';
import { fetchPlanActuals } from '../lib/initiativePlanApi';
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

export const useAnalyticsHealth = (refreshKey = 0) => useKeyedResource(async () => ({ rows: await fetchHealth() }), 'health', refreshKey);

// The recorded actual progress of the initiative plan, by activity key.
export const usePlanActuals = (refreshKey = 0) => useKeyedResource(async () => ({ actuals: await fetchPlanActuals() }), 'plan-actuals', refreshKey);
