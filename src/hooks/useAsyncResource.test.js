import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAsyncResource } from './useAsyncResource';

describe('useAsyncResource', () => {
  it('starts loading, then returns the resolved value', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: '1' });

    const { result } = renderHook(() => useAsyncResource(fetcher, []));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual({ id: '1' });
    expect(result.current.error).toBeNull();
  });

  it('surfaces a rejection as `error`, leaving `data` null', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Backend down'));

    const { result } = renderHook(() => useAsyncResource(fetcher, []));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toEqual(new Error('Backend down'));
    expect(result.current.data).toBeNull();
  });

  it('re-fetches when a dependency changes', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');

    const { result, rerender } = renderHook(({ dep }) => useAsyncResource(fetcher, [dep]), {
      initialProps: { dep: 'a' },
    });
    await waitFor(() => expect(result.current.data).toBe('first'));
    expect(fetcher).toHaveBeenCalledTimes(1);

    rerender({ dep: 'b' });

    await waitFor(() => expect(result.current.data).toBe('second'));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  // The cancelled-flag guard this hook exists to centralize: a stale
  // in-flight response (from before a dependency changed) must not
  // clobber the newer one that resolves after it.
  it('discards a stale response that resolves after the dependency has already changed', async () => {
    let resolveFirst;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const fetcher = vi.fn().mockReturnValueOnce(firstPromise).mockResolvedValueOnce('second');

    const { result, rerender } = renderHook(({ dep }) => useAsyncResource(fetcher, [dep]), {
      initialProps: { dep: 'a' },
    });

    rerender({ dep: 'b' });
    await waitFor(() => expect(result.current.data).toBe('second'));

    resolveFirst('first');
    // Give the already-resolved (but cancelled) first promise a tick to
    // settle — it must not overwrite the already-current 'second' value.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.data).toBe('second');
  });
});
