import { useEffect, useState } from 'react';

const NOTHING = { good: null, failedKey: null, error: null, settledToken: null };

// `key` says which data is wanted (the route and its filters) and
// `refreshKey` only asks for the same data again. `fetcher` loads the data
// for `key`.
//
// Every write to state happens in a callback that checks the request is
// still the current one, so a slow answer for an old key can never touch
// state after a newer request has started. Whether a result is still loading
// or failed is read off which request settled last, so nothing lags behind
// by a render.
//
// While a new key loads, the previous result stays on screen so a chart does
// not blank on every click. If the fetch for a new key fails, that result is
// dropped, and stays dropped (`failedKey`) until a result for the current
// key arrives: it belongs to other filters, and would sit on screen under
// the new filters' labels, including after a retry clears the error. A
// failed refresh of the same key keeps its data, since those numbers still
// match what is asked for.
export function useKeyedResource(fetcher, key, refreshKey = 0) {
  const [state, setState] = useState(NOTHING);
  const token = `${refreshKey}:${key}`;

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => fetcher())
      .then(
        (result) => {
          if (!cancelled) setState({ good: { ...result, key }, failedKey: null, error: null, settledToken: token });
        },
        (error) => {
          if (!cancelled) {
            setState((current) => ({
              ...current,
              error,
              failedKey: current.good?.key === key ? current.failedKey : key,
              settledToken: token,
            }));
          }
        }
      );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshKey]);

  const isStale = state.good !== null && state.good.key !== key;
  const settled = state.settledToken === token;
  return {
    data: isStale && state.failedKey !== null ? null : state.good,
    error: settled ? state.error : null,
    isLoading: !settled || isStale,
  };
}
