import { useEffect, useState } from 'react';

// The cancelled-flag fetch-on-mount pattern (frontend.md: "a hook that
// fetches data returns { data, isLoading, error }"), extracted once it
// showed up a third time (useMasterDataTable, AddRecordModal's pick-list
// loader, and DeleteRecordModal's full-dataset loader all hand-rolled the
// same shape — gate finding, refactorer). `fetcher` is called once per
// `deps` change; a change mid-flight is discarded rather than applied.
export function useAsyncResource(fetcher, deps) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetcher()
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
