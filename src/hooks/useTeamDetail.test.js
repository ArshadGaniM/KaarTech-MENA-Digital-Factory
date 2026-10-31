import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTeamDetail } from './useTeamDetail';
import { fetchTeamDetail } from '../lib/controlCenterApi';

vi.mock('../lib/controlCenterApi', () => ({ fetchTeamDetail: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('useTeamDetail', () => {
  it('loads the team for the month', async () => {
    fetchTeamDetail.mockResolvedValue({ code: 'TEAM-001', seats: [] });
    const { result } = renderHook(() => useTeamDetail('TEAM-001', '2026-10', 1));

    await waitFor(() => expect(result.current.data).toEqual({ code: 'TEAM-001', seats: [] }));
    expect(fetchTeamDetail).toHaveBeenCalledWith('TEAM-001', '2026-10');
  });

  it('refetches when the refresh key changes and keeps the earlier detail while it loads', async () => {
    let resolveSecond;
    fetchTeamDetail
      .mockResolvedValueOnce({ code: 'TEAM-001', seats: ['old'] })
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));
    const { result, rerender } = renderHook(({ key }) => useTeamDetail('TEAM-001', '2026-10', key), { initialProps: { key: 1 } });
    await waitFor(() => expect(result.current.data).toEqual({ code: 'TEAM-001', seats: ['old'] }));

    rerender({ key: 2 });
    await waitFor(() => expect(fetchTeamDetail).toHaveBeenCalledTimes(2));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual({ code: 'TEAM-001', seats: ['old'] });

    resolveSecond({ code: 'TEAM-001', seats: ['new'] });
    await waitFor(() => expect(result.current.data).toEqual({ code: 'TEAM-001', seats: ['new'] }));
  });
});
