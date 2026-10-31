import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useKeyedResource } from './useKeyedResource';

const settle = (result) => waitFor(() => expect(result.current.isLoading).toBe(false));

describe('useKeyedResource', () => {
  it('loads the data for its key and tags the result with that key', async () => {
    const fetcher = vi.fn().mockResolvedValue({ rows: [1, 2] });

    const { result } = renderHook(() => useKeyedResource(fetcher, 'a'));

    expect(result.current.isLoading).toBe(true);
    await settle(result);
    expect(result.current.data).toEqual({ rows: [1, 2], key: 'a' });
  });

  it('reports loading, never "current", for the render right after the key changes', async () => {
    const fetcher = vi.fn().mockResolvedValue({});
    const seen = [];
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
    let finish;
    const fetcher = vi.fn().mockResolvedValueOnce({ n: 1 }).mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const { result, rerender } = renderHook(({ key }) => useKeyedResource(fetcher, key), { initialProps: { key: 'a' } });
    await settle(result);

    rerender({ key: 'b' });

    expect(result.current.data.key).toBe('a');
    expect(result.current.isLoading).toBe(true);
    await act(async () => finish({ n: 2 }));
    await settle(result);
    expect(result.current.data).toEqual({ n: 2, key: 'b' });
  });

  it('drops data that belongs to another key when the new fetch fails', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ n: 1 }).mockRejectedValueOnce(new Error('boom'));
    const { result, rerender } = renderHook(({ key }) => useKeyedResource(fetcher, key), { initialProps: { key: 'a' } });
    await settle(result);

    rerender({ key: 'b' });
    await waitFor(() => expect(result.current.error).toEqual(new Error('boom')));

    expect(result.current.data).toBeNull();
  });

  it('keeps its data when a refresh of the same key fails, since it still matches what is asked for', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ n: 1 }).mockRejectedValueOnce(new Error('boom'));
    const { result, rerender } = renderHook(({ refresh }) => useKeyedResource(fetcher, 'a', refresh), { initialProps: { refresh: 0 } });
    await settle(result);

    rerender({ refresh: 1 });
    await waitFor(() => expect(result.current.error).toEqual(new Error('boom')));

    expect(result.current.data).toEqual({ n: 1, key: 'a' });
  });

  it('refetches when only the refresh counter changes', async () => {
    const fetcher = vi.fn().mockResolvedValue({});
    const { result, rerender } = renderHook(({ refresh }) => useKeyedResource(fetcher, 'a', refresh), { initialProps: { refresh: 0 } });
    await settle(result);

    rerender({ refresh: 1 });

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });
});
