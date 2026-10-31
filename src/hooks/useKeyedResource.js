import { useAsyncResource } from './useAsyncResource';

// `fetcher` loads the data for `key`. useAsyncResource only flips
// `isLoading` in an effect, so for one render after the inputs change it
// still reports "not loading" with the old result. Each result carries the
// key it was fetched for, and a result for a different key counts as
// loading. Previous data stays in place while the new one loads.
export function useKeyedResource(fetcher, key) {
  const result = useAsyncResource(async () => ({ ...(await fetcher()), key }), [key]);
  const isStale = result.data !== null && result.data.key !== key;
  return { ...result, isLoading: result.isLoading || isStale };
}
