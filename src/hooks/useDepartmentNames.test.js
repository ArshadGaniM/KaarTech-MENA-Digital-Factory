import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDepartmentNames } from './useDepartmentNames';
import { fetchAllMasterDataTableRows } from '../lib/masterDataApi';

vi.mock('../lib/masterDataApi', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAllMasterDataTableRows: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDepartmentNames', () => {
  it('maps department code to name and leaves out soft-deleted departments', async () => {
    fetchAllMasterDataTableRows.mockResolvedValue([
      { code: 'DEPT-002', name: 'Design Services', markedDeleted: 'No' },
      { code: 'DEPT-099', name: 'Retired', markedDeleted: 'Yes' },
    ]);

    const { result } = renderHook(() => useDepartmentNames());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchAllMasterDataTableRows).toHaveBeenCalledWith('departments');
    expect(result.current.data.get('DEPT-002')).toBe('Design Services');
    expect(result.current.data.has('DEPT-099')).toBe(false);
  });

  it('surfaces a failed load as an error', async () => {
    fetchAllMasterDataTableRows.mockRejectedValue(new Error('Backend unreachable'));

    const { result } = renderHook(() => useDepartmentNames());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error.message).toBe('Backend unreachable');
  });
});
