import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useKeyedResource } from './useKeyedResource';

const settle = (result) => waitFor(() => expect(result.current.isLoading).toBe(false));

// A request the test finishes by hand, so a slow answer can arrive after a newer request.
const deferred = () => {
  const request = {};
  request.promise = new Promise((resolve, reject) => {
    request.resolve = resolve;
    request.reject = reject;
  });
  return request;
};

const render = (fetcher, initial = { key: 'a', refresh: 0 }) =>
  renderHook(({ key, refresh }) => useKeyedResource(fetcher, key, refresh), { initialProps: initial });

describe('useKeyedResource', () => {
  it('loads the data for its key and tags the result with that key', async () => {
    const fetcher = vi.fn().mockResolvedValue({ rows: [1, 2] });

    const { result } = render(fetcher);

    expect(result.current.isLoading).toBe(true);
    await settle(result);
    expect(result.current.data).toEqual({ rows: [1, 2], key: 'a' });
    expect(result.current.error).toBeNull();
  });

  it('reports loading, never "current", for the render right after the key changes', async () => {
    const seen = [];
    const fetcher = vi.fn().mockResolvedValue({});
    const { result, rerender } = renderHook(
      ({ key }) => {
        const state = useKeyedResource(fetcher, key);
        seen.push({ key, fetchedFor: state.data?.key, loading: state.isLoading });
        return state;
      },
      { initialProps: { key: 'a' } }
    );
    await settle(result);

    rerender({ key: 'b' });
    await waitFor(() => expect(result.current.data.key).toBe('b'));

    const stale = seen.filter((entry) => entry.key === 'b' && entry.fetchedFor === 'a');
    expect(stale.length).toBeGreaterThan(0);
    expect(stale.every((entry) => entry.loading)).toBe(true);
  });

  it('keeps the old data on screen while the new key loads', async () => {
    const slow = deferred();
    const fetcher = vi.fn().mockResolvedValueOnce({ n: 1 }).mockReturnValueOnce(slow.promise);
    const { result, rerender } = render(fetcher);
    await settle(result);

    rerender({ key: 'b', refresh: 0 });

    expect(result.current.data.key).toBe('a');
    expect(result.current.isLoading).toBe(true);
    await act(async () => slow.resolve({ n: 2 }));
    await settle(result);
    expect(result.current.data).toEqual({ n: 2, key: 'b' });
  });

  it('drops data that belongs to another key when the new fetch fails', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ n: 1 }).mockRejectedValueOnce(new Error('boom'));
    const { result, rerender } = render(fetcher);
    await settle(result);

    rerender({ key: 'b', refresh: 0 });
    await waitFor(() => expect(result.current.error).toEqual(new Error('boom')));

    expect(result.current.data).toBeNull();
  });

  it('keeps dropping the old data through a retry of the same failed key', async () => {
    const retry = deferred();
    const fetcher = vi.fn().mockResolvedValueOnce({ n: 1 }).mockRejectedValueOnce(new Error('boom')).mockReturnValueOnce(retry.promise);
    const { result, rerender } = render(fetcher);
    await settle(result);
    rerender({ key: 'b', refresh: 0 });
    await waitFor(() => expect(result.current.error).toEqual(new Error('boom')));

    rerender({ key: 'b', refresh: 1 });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeNull();
    await act(async () => retry.resolve({ n: 2 }));
    await settle(result);
    expect(result.current.data).toEqual({ n: 2, key: 'b' });
  });

  it('keeps dropping the old data while a third key loads after a failure', async () => {
    const third = deferred();
    const fetcher = vi.fn().mockResolvedValueOnce({ n: 1 }).mockRejectedValueOnce(new Error('boom')).mockReturnValueOnce(third.promise);
    const { result, rerender } = render(fetcher);
    await settle(result);
    rerender({ key: 'b', refresh: 0 });
    await waitFor(() => expect(result.current.error).toEqual(new Error('boom')));

    rerender({ key: 'c', refresh: 0 });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    await act(async () => third.resolve({ n: 3 }));
    await settle(result);
    expect(result.current.data).toEqual({ n: 3, key: 'c' });
  });

  it('is not fooled by a slow answer for an old key that arrives after a newer one failed', async () => {
    const slowB = deferred();
    const retryC = deferred();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ n: 1 }) // a
      .mockReturnValueOnce(slowB.promise) // b, still pending when c starts
      .mockRejectedValueOnce(new Error('boom')) // c fails fast
      .mockReturnValueOnce(retryC.promise); // c retried
    const { result, rerender } = render(fetcher);
    await settle(result);
    rerender({ key: 'b', refresh: 0 });
    rerender({ key: 'c', refresh: 0 });
    await waitFor(() => expect(result.current.error).toEqual(new Error('boom')));

    await act(async () => slowB.resolve({ n: 2 })); // the old request finishes late
    rerender({ key: 'c', refresh: 1 });

    // a's numbers must not come back under c, and b's late answer must not show.
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    await act(async () => retryC.resolve({ n: 3 }));
    await settle(result);
    expect(result.current.data).toEqual({ n: 3, key: 'c' });
  });

  it('ignores a late failure of an old key once the current key has loaded', async () => {
    const slowB = deferred();
    const slowD = deferred();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ n: 1 }) // a
      .mockReturnValueOnce(slowB.promise) // b, abandoned
      .mockResolvedValueOnce({ n: 3 }) // c loads fine
      .mockReturnValueOnce(slowD.promise); // d
    const { result, rerender } = render(fetcher);
    await settle(result);
    rerender({ key: 'b', refresh: 0 });
    rerender({ key: 'c', refresh: 0 });
    await waitFor(() => expect(result.current.data?.key).toBe('c'));

    await act(async () => slowB.reject(new Error('late')));
    rerender({ key: 'd', refresh: 0 });

    // The abandoned failure did not mark anything failed: c stays as the placeholder.
    expect(result.current.error).toBeNull();
    expect(result.current.data.key).toBe('c');
    await act(async () => slowD.resolve({ n: 4 }));
    await settle(result);
  });

  it('keeps its data when a refresh of the same key fails, and still shows it as the placeholder for the next key', async () => {
    const next = deferred();
    const fetcher = vi.fn().mockResolvedValueOnce({ n: 1 }).mockRejectedValueOnce(new Error('boom')).mockReturnValueOnce(next.promise);
    const { result, rerender } = render(fetcher);
    await settle(result);

    rerender({ key: 'a', refresh: 1 });
    await waitFor(() => expect(result.current.error).toEqual(new Error('boom')));
    expect(result.current.data).toEqual({ n: 1, key: 'a' });

    rerender({ key: 'b', refresh: 1 });

    // The failed refresh was for the key that is on screen, so nothing was dropped.
    expect(result.current.data.key).toBe('a');
    await act(async () => next.resolve({ n: 2 }));
    await settle(result);
  });

  it('shows the error with no data when the first load fails, and recovers on a retry', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ n: 1 });
    const { result, rerender } = render(fetcher);

    await waitFor(() => expect(result.current.error).toEqual(new Error('boom')));
    expect(result.current.data).toBeNull();

    rerender({ key: 'a', refresh: 1 });
    await settle(result);

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual({ n: 1, key: 'a' });
  });

  it('refetches when only the refresh counter changes', async () => {
    const fetcher = vi.fn().mockResolvedValue({});
    const { result, rerender } = render(fetcher);
    await settle(result);

    rerender({ key: 'a', refresh: 1 });

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it('turns a fetcher that throws before returning a promise into an error', async () => {
    const fetcher = vi.fn(() => {
      throw new Error('sync boom');
    });

    const { result } = render(fetcher);

    await waitFor(() => expect(result.current.error).toEqual(new Error('sync boom')));
    expect(result.current.data).toBeNull();
  });
});
