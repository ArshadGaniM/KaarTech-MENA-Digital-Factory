import { useEffect, useState } from 'react';
import { fetchEntityRelationships } from '../lib/schemaApi';

// Every data-fetching hook returns { data, isLoading, error } (frontend.md).
export function useEntityRelationships() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchEntityRelationships()
      .then((entities) => {
        if (!cancelled) setData(entities);
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
  }, []);

  return { data, isLoading, error };
}
