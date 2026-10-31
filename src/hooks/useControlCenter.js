import { useEffect, useState } from 'react';
import { CONTROL_CENTER_STREAM_URL, fetchControlCenter } from '../lib/controlCenterApi';

// Safety net for a dropped stream, or a database without the change
// notifications (migration 0023): the page still refreshes by itself.
const POLL_MS = 30_000;

// The factory for one month, refreshed whenever the backend says data
// changed. Earlier data stays on screen while another month loads or a
// refresh fails, so the page never blanks out; `error` says the latest try
// failed and `isLoading` that the shown data is for a different month.
export function useControlCenter(month) {
  const [state, setState] = useState({ data: null, month: null, error: null, updatedAt: null });

  useEffect(() => {
    let cancelled = false;

    const load = () =>
      fetchControlCenter(month)
        .then((data) => {
          if (!cancelled) setState({ data, month, error: null, updatedAt: new Date() });
        })
        .catch((error) => {
          if (!cancelled) setState((prev) => ({ ...prev, month, error }));
        });

    load();
    const stream = typeof EventSource === 'undefined' ? null : new EventSource(CONTROL_CENTER_STREAM_URL);
    stream?.addEventListener('changed', load);
    const poll = setInterval(load, POLL_MS);

    return () => {
      cancelled = true;
      stream?.close();
      clearInterval(poll);
    };
  }, [month]);

  return { data: state.data, error: state.error, updatedAt: state.updatedAt, isLoading: state.month !== month };
}
