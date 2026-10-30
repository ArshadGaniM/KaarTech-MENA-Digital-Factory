import { useEffect, useState } from 'react';

// The cancelled-flag fetch-on-deps-change pattern (frontend.md: "a hook that
// fetches data returns { data, isLoading, error }"). `fetcher` is called
// once per `deps` change; a response that arrives after the deps changed is
// discarded rather than applied. Used by DeleteRecordModal; the richer
// fetch effects (useMasterDataTable's pagination, RecordFormModal's
// multi-table pick-lists) carry extra state and stay hand-rolled.
export function useAsyncResource(fetcher, deps) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    // Promise.resolve().then so a fetcher that throws synchronously (or
    // returns a non-promise) lands in `error` instead of escaping the effect.
    Promise.resolve()
      .then(fetcher)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, isLoading, error };
}
