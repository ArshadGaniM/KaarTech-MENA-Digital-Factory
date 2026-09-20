import { useCallback, useEffect, useState } from 'react';
import { fetchMasterDataTable } from '../lib/masterDataApi';

// Every data-fetching hook returns { data, isLoading, error } (frontend.md).
// `refetch` (FEAT-14) is additive — it lets the Add-record modal refresh
// the table after a successful create without a full page reload, without
// changing what every existing caller already relies on.
export function useMasterDataTable(route) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchMasterDataTable(route)
      .then((rows) => {
        if (!cancelled) setData(rows);
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
  }, [route, refreshToken]);

  const refetch = useCallback(() => setRefreshToken((token) => token + 1), []);

  return { data, isLoading, error, refetch };
}
