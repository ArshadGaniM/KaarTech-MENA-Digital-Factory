import { useState } from 'react';

// State for a chart panel whose charts filter each other: the current
// picks, toggling or clearing one, and a retry counter for a failed load.
// `initial` must be one constant object (every pick null), because Clear
// filters puts that same object back.
export function useCrossFilters(initial) {
  const [filters, setFilters] = useState(initial);
  const [retries, setRetries] = useState(0);
  return {
    filters,
    toggle: (field, value) => setFilters((current) => ({ ...current, [field]: current[field] === value ? null : value })),
    clear: (field) => setFilters((current) => ({ ...current, [field]: null })),
    clearAll: () => setFilters(initial),
    retries,
    retry: () => setRetries((count) => count + 1),
  };
}
