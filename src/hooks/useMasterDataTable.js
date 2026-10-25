import { useCallback, useEffect, useState } from 'react';
import { fetchMasterDataTable } from '../lib/masterDataApi';

export const PAGE_SIZE = 20;

// Every data-fetching hook returns { data, isLoading, error } (frontend.md).
// `refetch` (FEAT-14) is additive — it lets the Add-record modal refresh
// the table after a successful create without a full page reload, without
// changing what every existing caller already relies on. `page`/`setPage`/
// `totalPages` (FEAT-18) add offset-based pagination (CLAUDE.md §10) —
// a route switch or a refetch both reset back to page 1, since neither
// guarantees the current page still has anything on it.
export function useMasterDataTable(route) {
  const [data, setData] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [route, refreshToken]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchMasterDataTable(route, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
      .then(({ rows, total: rowTotal }) => {
        if (cancelled) return;
        setData(rows);
        setTotal(rowTotal);
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
  }, [route, page, refreshToken]);

  const refetch = useCallback(() => setRefreshToken((token) => token + 1), []);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return { data, total, page, totalPages, setPage, isLoading, error, refetch };
}
