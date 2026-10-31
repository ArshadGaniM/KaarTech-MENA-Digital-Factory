import { fetchGroupSummary } from '../lib/masterDataApi';
import { useAsyncResource } from './useAsyncResource';

// `refreshKey` is bumped to refetch on demand. Previous data stays in place
// while a refetch is in flight, so a chart does not blank on every click.
//
// useAsyncResource only flips `isLoading` in an effect, so for one render
// after the inputs change it still reports "not loading" with the old
// result. Each result carries the key it was fetched for, and a result for
// a different key counts as loading.
export function useGroupSummary(route, groupBy, filters, refreshKey = 0) {
  const key = JSON.stringify([route, groupBy, filters, refreshKey]);
  const result = useAsyncResource(async () => ({ ...(await fetchGroupSummary(route, groupBy, filters)), key }), [key]);
  const isStale = result.data !== null && result.data.key !== key;
  return { ...result, isLoading: result.isLoading || isStale };
}
