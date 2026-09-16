import { useEffect, useState } from 'react';
import { fetchMasterDataTable } from '../lib/masterDataApi';

// Every data-fetching hook returns { data, isLoading, error } (frontend.md).
export function useMasterDataTable(route) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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
  }, [route]);

  return { data, isLoading, error };
}
