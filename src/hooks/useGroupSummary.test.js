import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGroupSummary } from './useGroupSummary';
import { fetchGroupSummary } from '../lib/masterDataApi';

vi.mock('../lib/masterDataApi');

beforeEach(() => {
  vi.clearAllMocks();
  fetchGroupSummary.mockResolvedValue({ groups: [{ value: 'Onsite', count: 3 }], total: 3 });
});

describe('useGroupSummary', () => {
  it('fetches the grouped counts with the filters', async () => {
    const { result } = renderHook(() => useGroupSummary('resources', 'locationType', { designation: 'Consultant' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data.total).toBe(3);
    expect(fetchGroupSummary).toHaveBeenCalledWith('resources', 'locationType', { designation: 'Consultant' });
  });

  it('refetches when a filter changes, and when the refresh key changes', async () => {
    const { result, rerender } = renderHook(({ filters, key }) => useGroupSummary('resources', 'designation', filters, key), {
      initialProps: { filters: { locationType: null }, key: 0 },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ filters: { locationType: 'Offshore' }, key: 0 });
    await waitFor(() => expect(fetchGroupSummary).toHaveBeenCalledTimes(2));

    rerender({ filters: { locationType: 'Offshore' }, key: 1 });
    await waitFor(() => expect(fetchGroupSummary).toHaveBeenCalledTimes(3));
  });

  it('does not refetch for a new filters object with the same content', async () => {
    const { result, rerender } = renderHook(({ filters }) => useGroupSummary('resources', 'designation', filters), {
      initialProps: { filters: { locationType: 'Offshore' } },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ filters: { locationType: 'Offshore' } });

    expect(fetchGroupSummary).toHaveBeenCalledTimes(1);
  });

  it('never reports a result as current for filters it was not fetched with', async () => {
    const renders = [];
    const { result, rerender } = renderHook(
      ({ filters }) => {
        const summary = useGroupSummary('resources', 'designation', filters);
        renders.push({ wanted: filters.locationType, loading: summary.isLoading, fetchedFor: summary.data?.key });
        return summary;
      },
      { initialProps: { filters: { locationType: null } } }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ filters: { locationType: 'Offshore' } });
    await waitFor(() => expect(result.current.data.key).toContain('Offshore'));

    // Every render that asked for Offshore but still held the old result must say it is loading.
    const staleButQuiet = renders.filter(
      (entry) => entry.wanted === 'Offshore' && entry.fetchedFor && !entry.fetchedFor.includes('Offshore') && !entry.loading
    );
    expect(staleButQuiet).toEqual([]);
  });

  it('surfaces a failure as error', async () => {
    fetchGroupSummary.mockRejectedValue(new Error('Backend unreachable'));

    const { result } = renderHook(() => useGroupSummary('resources', 'designation', {}));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toEqual(new Error('Backend unreachable'));
  });
});
