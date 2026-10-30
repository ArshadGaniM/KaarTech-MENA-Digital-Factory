import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTableCounts } from './useTableCounts';
import { fetchMasterDataTable, MASTER_DATA_TABLES } from '../lib/masterDataApi';

vi.mock('../lib/masterDataApi', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchMasterDataTable: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useTableCounts', () => {
  it('reads each table total with a one-row page', async () => {
    fetchMasterDataTable.mockResolvedValue({ rows: [], total: 7 });

    const { result } = renderHook(() => useTableCounts());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(MASTER_DATA_TABLES.length);
    expect(result.current.data[0]).toEqual({
      route: MASTER_DATA_TABLES[0].route,
      label: MASTER_DATA_TABLES[0].label,
      count: 7,
      error: null,
    });
    expect(fetchMasterDataTable).toHaveBeenCalledWith(MASTER_DATA_TABLES[0].route, { limit: 1, offset: 0 });
  });

  it('records a per-table failure without failing the rest', async () => {
    fetchMasterDataTable.mockImplementation((route) =>
      route === 'teams' ? Promise.reject(new Error('boom')) : Promise.resolve({ rows: [], total: 1 })
    );

    const { result } = renderHook(() => useTableCounts());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    const teams = result.current.data.find((table) => table.route === 'teams');
    expect(teams).toMatchObject({ count: null, error: new Error('boom') });
    expect(result.current.data.filter((table) => table.error === null)).toHaveLength(MASTER_DATA_TABLES.length - 1);
  });
});
