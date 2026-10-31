import { useState } from 'react';
import { useAsyncResource } from './useAsyncResource';

// `key` says which data is wanted (the route and its filters) and
// `refreshKey` only asks for the same data again. `fetcher` loads the data
// for `key`.
//
// useAsyncResource only flips `isLoading` in an effect, so for one render
// after `key` changes it still reports "not loading" with the old result.
// Each result carries the key it was fetched for, and a result for another
// key counts as loading. While it loads, that old result stays on screen so
// a chart does not blank on every click.
//
// If the fetch for a new key fails, the old result is dropped, and stays
// dropped until a result for the current key arrives: it belongs to other
// filters, and would sit on screen under the new filters' labels. Without
// the memory in `dropOld`, a retry would clear the error and bring the old
// result back for as long as the retry loads. A failed refresh of the same
// `key` keeps its data, since those numbers still match what is asked for.
export function useKeyedResource(fetcher, key, refreshKey = 0) {
  const [dropOld, setDropOld] = useState(false);
  const result = useAsyncResource(async () => {
    try {
      const data = { ...(await fetcher()), key };
      setDropOld(false);
      return data;
    } catch (error) {
      setDropOld(true);
      throw error;
    }
  }, [key, refreshKey]);
  const isStale = result.data !== null && result.data.key !== key;
  return {
    ...result,
    data: isStale && (result.error || dropOld) ? null : result.data,
    isLoading: result.isLoading || isStale,
  };
}
