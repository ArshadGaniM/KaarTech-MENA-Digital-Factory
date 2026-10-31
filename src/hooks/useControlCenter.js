import { useEffect, useState } from 'react';
import { CONTROL_CENTER_STREAM_URL, fetchControlCenter } from '../lib/controlCenterApi';

// Safety net for a dropped stream, or a database without the change
// notifications (migration 0023): the page still refreshes by itself.
const POLL_MS = 30_000;
// Open pages all refetch after one change; spreading them out keeps the
// backend from taking every request in the same instant.
const MAX_JITTER_MS = 500;

// The factory for one month, refreshed whenever the backend says data
// changed.
//  - Same month, refresh fails: the last data stays on screen and `error`
//    says the latest try failed.
//  - Another month is loading: the previous month's data stays on screen
//    while `isLoading` is true.
//  - Another month fails to load: `data` is null. Showing the previous
//    month's numbers under the new month's label would be wrong.
export function useControlCenter(month) {
  const [state, setState] = useState({ data: null, dataMonth: null, error: null, errorMonth: null, updatedAt: null });

  useEffect(() => {
    let cancelled = false;
    let latest = 0;
    let jitterTimer = null;

    // Only the newest request may update the page, so a slow older response
    // cannot overwrite newer data.
    const load = () => {
      const request = ++latest;
      return fetchControlCenter(month)
        .then((data) => {
          if (!cancelled && request === latest) {
            setState({ data, dataMonth: month, error: null, errorMonth: null, updatedAt: new Date() });
          }
        })
        .catch((error) => {
          if (!cancelled && request === latest) setState((prev) => ({ ...prev, error, errorMonth: month }));
        });
    };
    const loadSoon = () => {
      clearTimeout(jitterTimer);
      jitterTimer = setTimeout(load, Math.random() * MAX_JITTER_MS);
    };

    load();
    const stream = typeof EventSource === 'undefined' ? null : new EventSource(CONTROL_CENTER_STREAM_URL);
    stream?.addEventListener('changed', loadSoon);
    const poll = setInterval(load, POLL_MS);

    return () => {
      cancelled = true;
      clearTimeout(jitterTimer);
      stream?.close();
      clearInterval(poll);
    };
  }, [month]);

  const error = state.errorMonth === month ? state.error : null;
  const otherMonth = state.dataMonth !== month;
  return {
    data: otherMonth && error ? null : state.data,
    error,
    isLoading: otherMonth && !error,
    updatedAt: state.updatedAt,
  };
}
