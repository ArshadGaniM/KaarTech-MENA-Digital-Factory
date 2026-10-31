import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useMasterDataTable, PAGE_SIZE } from './useMasterDataTable';
import { fetchMasterDataTable } from '../lib/masterDataApi';

vi.mock('../lib/masterDataApi');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useMasterDataTable', () => {
  it('starts loading, then returns the fetched page and total', async () => {
    fetchMasterDataTable.mockResolvedValue({ rows: [{ id: '1', name: 'Digital Factory' }], total: 1 });

    const { result } = renderHook(() => useMasterDataTable('practices'));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual([{ id: '1', name: 'Digital Factory' }]);
    expect(result.current.total).toBe(1);
    expect(result.current.page).toBe(1);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.error).toBeNull();
    expect(fetchMasterDataTable).toHaveBeenCalledWith('practices', { limit: PAGE_SIZE, offset: 0, query: '' });
  });

  it('surfaces a fetch failure as `error`', async () => {
    fetchMasterDataTable.mockRejectedValue(new Error('Backend unreachable'));

    const { result } = renderHook(() => useMasterDataTable('practices'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toEqual(new Error('Backend unreachable'));
    expect(result.current.data).toBeNull();
  });

  it('calling `refetch` re-triggers a fetch (FEAT-14: lets the Add-record modal refresh the table without a full reload)', async () => {
    fetchMasterDataTable.mockResolvedValue({ rows: [{ id: '1', name: 'First' }], total: 1 });

    const { result } = renderHook(() => useMasterDataTable('practices'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchMasterDataTable).toHaveBeenCalledTimes(1);

    fetchMasterDataTable.mockResolvedValue({
      rows: [{ id: '1', name: 'First' }, { id: '2', name: 'Second' }],
      total: 2,
    });

    act(() => {
      result.current.refetch();
    });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchMasterDataTable).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual([{ id: '1', name: 'First' }, { id: '2', name: 'Second' }]);
  });

  it('setPage advances to the next page, fetching with the matching offset (FEAT-18)', async () => {
    fetchMasterDataTable.mockResolvedValue({ rows: [{ id: '1' }], total: 45 });

    const { result } = renderHook(() => useMasterDataTable('resources'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalPages).toBe(3);

    act(() => {
      result.current.setPage(2);
    });

    await waitFor(() => expect(result.current.page).toBe(2));
    await waitFor(() =>
      expect(fetchMasterDataTable).toHaveBeenLastCalledWith('resources', { limit: PAGE_SIZE, offset: PAGE_SIZE, query: '' })
    );
  });

  it('switching routes resets back to page 1', async () => {
    fetchMasterDataTable.mockResolvedValue({ rows: [{ id: '1' }], total: 45 });

    const { result, rerender } = renderHook(({ route }) => useMasterDataTable(route), {
      initialProps: { route: 'resources' },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setPage(2);
    });
    await waitFor(() => expect(result.current.page).toBe(2));

    rerender({ route: 'projects' });

    await waitFor(() => expect(result.current.page).toBe(1));
  });

  // FEAT-19: an edit or an undo-delete re-fetches the page you're on;
  // `refetch` (after an add/delete) deliberately goes back to page 1.
  it('reload re-fetches the current page, keeping page > 1', async () => {
    fetchMasterDataTable.mockResolvedValue({ rows: [{ id: '1' }], total: 45 });

    const { result } = renderHook(() => useMasterDataTable('resources'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.setPage(3);
    });
    await waitFor(() => expect(result.current.page).toBe(3));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const callsBefore = fetchMasterDataTable.mock.calls.length;

    act(() => {
      result.current.reload();
    });

    await waitFor(() => expect(fetchMasterDataTable.mock.calls.length).toBe(callsBefore + 1));
    expect(fetchMasterDataTable).toHaveBeenLastCalledWith('resources', { limit: PAGE_SIZE, offset: 2 * PAGE_SIZE, query: '' });
    expect(result.current.page).toBe(3);
  });

  it('refetch, by contrast, goes back to page 1', async () => {
    fetchMasterDataTable.mockResolvedValue({ rows: [{ id: '1' }], total: 45 });

    const { result } = renderHook(() => useMasterDataTable('resources'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.setPage(3);
    });
    await waitFor(() => expect(result.current.page).toBe(3));

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.page).toBe(1));
  });

  // FEAT-24: a search term is sent with every request, and changing it goes back to page 1.
  it('passes the search term to the fetch and goes back to page 1 when it changes', async () => {
    fetchMasterDataTable.mockResolvedValue({ rows: [{ id: '1' }], total: 45 });

    const { result, rerender } = renderHook(({ query }) => useMasterDataTable('resources', query), {
      initialProps: { query: '' },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.setPage(3);
    });
    await waitFor(() => expect(result.current.page).toBe(3));

    rerender({ query: 'nithya' });

    await waitFor(() => expect(result.current.page).toBe(1));
    await waitFor(() =>
      expect(fetchMasterDataTable).toHaveBeenLastCalledWith('resources', { limit: PAGE_SIZE, offset: 0, query: 'nithya' })
    );
  });
});
