import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAllocationSummary } from './useAllocationSummary';
import { fetchAllocationSummary } from '../lib/allocationApi';

vi.mock('../lib/allocationApi');

const summary = { buckets: [], positions: [] };

beforeEach(() => {
  vi.clearAllMocks();
  fetchAllocationSummary.mockResolvedValue(summary);
});

describe('useAllocationSummary', () => {
  it('fetches with the filters', async () => {
    const filters = { bucket: 'full', position: null };

    const { result } = renderHook(() => useAllocationSummary(filters));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchAllocationSummary).toHaveBeenCalledWith(filters);
    expect(result.current.data.buckets).toEqual([]);
  });

  it('refetches when a filter or the refresh key changes, but not for an equal filters object', async () => {
    const { result, rerender } = renderHook(({ filters, key }) => useAllocationSummary(filters, key), {
      initialProps: { filters: { bucket: null, position: null }, key: 0 },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ filters: { bucket: null, position: null }, key: 0 });
    expect(fetchAllocationSummary).toHaveBeenCalledTimes(1);

    rerender({ filters: { bucket: 'none', position: null }, key: 0 });
    await waitFor(() => expect(fetchAllocationSummary).toHaveBeenCalledTimes(2));

    rerender({ filters: { bucket: 'none', position: null }, key: 1 });
    await waitFor(() => expect(fetchAllocationSummary).toHaveBeenCalledTimes(3));
  });

  it('reports loading, not the old result as current, for the first render after a filter change', async () => {
    const renders = [];
    const { result, rerender } = renderHook(
      ({ filters }) => {
        const state = useAllocationSummary(filters);
        renders.push({ wanted: filters.bucket, loading: state.isLoading, fetchedFor: state.data?.key });
        return state;
      },
      { initialProps: { filters: { bucket: null, position: null } } }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ filters: { bucket: 'full', position: null } });
    await waitFor(() => expect(result.current.data.key).toContain('full'));

    const staleRenders = renders.filter((r) => r.wanted === 'full' && r.fetchedFor && !r.fetchedFor.includes('full'));
    // The old result was on screen for at least one render, and every such render said loading.
    expect(staleRenders.length).toBeGreaterThan(0);
    expect(staleRenders.every((r) => r.loading)).toBe(true);
  });

  it('surfaces a failure as error', async () => {
    fetchAllocationSummary.mockRejectedValue(new Error('Backend unreachable'));

    const { result } = renderHook(() => useAllocationSummary({ bucket: null, position: null }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toEqual(new Error('Backend unreachable'));
  });
});
