import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useMasterDataTable } from './useMasterDataTable';
import { fetchMasterDataTable } from '../lib/masterDataApi';

vi.mock('../lib/masterDataApi');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useMasterDataTable', () => {
  it('starts loading, then returns the fetched rows', async () => {
    fetchMasterDataTable.mockResolvedValue([{ id: '1', name: 'Digital Factory' }]);

    const { result } = renderHook(() => useMasterDataTable('practices'));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual([{ id: '1', name: 'Digital Factory' }]);
    expect(result.current.error).toBeNull();
    expect(fetchMasterDataTable).toHaveBeenCalledWith('practices');
  });

  it('surfaces a fetch failure as `error`', async () => {
    fetchMasterDataTable.mockRejectedValue(new Error('Backend unreachable'));

    const { result } = renderHook(() => useMasterDataTable('practices'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toEqual(new Error('Backend unreachable'));
    expect(result.current.data).toBeNull();
  });

  it('calling `refetch` re-triggers a fetch (FEAT-14: lets the Add-record modal refresh the table without a full reload)', async () => {
    fetchMasterDataTable.mockResolvedValue([{ id: '1', name: 'First' }]);

    const { result } = renderHook(() => useMasterDataTable('practices'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchMasterDataTable).toHaveBeenCalledTimes(1);

    fetchMasterDataTable.mockResolvedValue([{ id: '1', name: 'First' }, { id: '2', name: 'Second' }]);

    act(() => {
      result.current.refetch();
    });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchMasterDataTable).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual([{ id: '1', name: 'First' }, { id: '2', name: 'Second' }]);
  });
});
