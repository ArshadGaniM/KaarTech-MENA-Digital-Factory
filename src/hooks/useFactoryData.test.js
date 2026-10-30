import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFactoryData } from './useFactoryData';
import { fetchAllMasterDataTableRows } from '../lib/masterDataApi';

vi.mock('../lib/masterDataApi', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAllMasterDataTableRows: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

function mockTables({ departments, teams }) {
  fetchAllMasterDataTableRows.mockImplementation(async (route) => (route === 'departments' ? departments : teams));
}

describe('useFactoryData', () => {
  it('maps department code to name and groups live team codes by department, sorted', async () => {
    mockTables({
      departments: [
        { code: 'DEPT-002', name: 'Design Services', markedDeleted: 'No' },
        { code: 'DEPT-099', name: 'Retired', markedDeleted: 'Yes' },
      ],
      teams: [
        { code: 'TEAM-02', departmentCode: 'DEPT-002', markedDeleted: 'No' },
        { code: 'TEAM-01', departmentCode: 'DEPT-002', markedDeleted: 'No' },
        { code: 'TEAM-03', departmentCode: 'DEPT-002', markedDeleted: 'Yes' },
      ],
    });

    const { result } = renderHook(() => useFactoryData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data.departmentNames.get('DEPT-002')).toBe('Design Services');
    expect(result.current.data.departmentNames.has('DEPT-099')).toBe(false);
    expect(result.current.data.teamCodesByDepartment.get('DEPT-002')).toEqual(['TEAM-01', 'TEAM-02']);
  });

  it('surfaces a failed load of either table as an error', async () => {
    fetchAllMasterDataTableRows.mockImplementation(async (route) => {
      if (route === 'teams') throw new Error('Backend unreachable');
      return [];
    });

    const { result } = renderHook(() => useFactoryData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error.message).toBe('Backend unreachable');
  });
});
