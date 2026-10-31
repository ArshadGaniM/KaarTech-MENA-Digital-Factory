import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useControlCenter } from './useControlCenter';
import { fetchControlCenter } from '../lib/controlCenterApi';

vi.mock('../lib/controlCenterApi', () => ({
  CONTROL_CENTER_STREAM_URL: 'http://stream.test',
  fetchControlCenter: vi.fn(),
}));

class FakeEventSource {
  static instances = [];
  constructor() {
    this.listeners = {};
    this.closed = false;
    FakeEventSource.instances.push(this);
  }
  addEventListener(name, fn) {
    this.listeners[name] = fn;
  }
  close() {
    this.closed = true;
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useControlCenter', () => {
  it('loads the month, then reloads when the stream says data changed', async () => {
    fetchControlCenter.mockResolvedValueOnce({ departments: ['first'] }).mockResolvedValueOnce({ departments: ['second'] });
    const { result } = renderHook(() => useControlCenter('2026-10'));

    await waitFor(() => expect(result.current.data).toEqual({ departments: ['first'] }));
    expect(fetchControlCenter).toHaveBeenCalledWith('2026-10');

    await act(async () => FakeEventSource.instances[0].listeners.changed());
    await waitFor(() => expect(result.current.data).toEqual({ departments: ['second'] }));
  });

  it('clears an earlier error once a refresh succeeds', async () => {
    fetchControlCenter
      .mockResolvedValueOnce({ departments: ['first'] })
      .mockRejectedValueOnce(new Error('Backend unreachable'))
      .mockResolvedValueOnce({ departments: ['third'] });
    const { result } = renderHook(() => useControlCenter('2026-10'));
    await waitFor(() => expect(result.current.data).not.toBeNull());

    await act(async () => FakeEventSource.instances[0].listeners.changed());
    await waitFor(() => expect(result.current.error).not.toBeNull());

    await act(async () => FakeEventSource.instances[0].listeners.changed());
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.data).toEqual({ departments: ['third'] });
  });

  it('keeps the previous month on screen, marked as loading, while another month loads', async () => {
    let resolveNovember;
    fetchControlCenter.mockImplementation((month) =>
      month === '2026-10' ? Promise.resolve({ departments: ['october'] }) : new Promise((resolve) => (resolveNovember = resolve))
    );
    const { result, rerender } = renderHook(({ month }) => useControlCenter(month), { initialProps: { month: '2026-10' } });
    await waitFor(() => expect(result.current.data).toEqual({ departments: ['october'] }));
    expect(result.current.isLoading).toBe(false);

    rerender({ month: '2026-11' });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual({ departments: ['october'] });

    await act(async () => resolveNovember({ departments: ['november'] }));
    await waitFor(() => expect(result.current.data).toEqual({ departments: ['november'] }));
    expect(result.current.isLoading).toBe(false);
  });

  it('never shows the previous month under a new month whose load failed', async () => {
    fetchControlCenter.mockImplementation((month) =>
      month === '2026-10' ? Promise.resolve({ departments: ['october'] }) : Promise.reject(new Error('Backend unreachable'))
    );
    const { result, rerender } = renderHook(({ month }) => useControlCenter(month), { initialProps: { month: '2026-10' } });
    await waitFor(() => expect(result.current.data).not.toBeNull());

    rerender({ month: '2026-11' });
    await waitFor(() => expect(result.current.error?.message).toBe('Backend unreachable'));
    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('ignores a slow older response that arrives after a newer one', async () => {
    const resolvers = [];
    fetchControlCenter.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)));
    const { result } = renderHook(() => useControlCenter('2026-10'));
    await act(async () => FakeEventSource.instances[0].listeners.changed());
    await waitFor(() => expect(resolvers).toHaveLength(2));

    await act(async () => resolvers[1]({ departments: ['newer'] }));
    await act(async () => resolvers[0]({ departments: ['older'] }));
    expect(result.current.data).toEqual({ departments: ['newer'] });
  });

  it('closes the stream and stops polling when unmounted', async () => {
    vi.useFakeTimers();
    fetchControlCenter.mockResolvedValue({ departments: [] });
    const { unmount } = renderHook(() => useControlCenter('2026-10'));
    await act(async () => {});
    unmount();
    const calls = fetchControlCenter.mock.calls.length;

    await act(async () => vi.advanceTimersByTime(60_000));
    expect(FakeEventSource.instances[0].closed).toBe(true);
    expect(fetchControlCenter.mock.calls.length).toBe(calls);
  });

  it('keeps the earlier data and reports the error when a refresh fails', async () => {
    fetchControlCenter.mockResolvedValueOnce({ departments: ['first'] }).mockRejectedValueOnce(new Error('Backend unreachable'));
    const { result } = renderHook(() => useControlCenter('2026-10'));
    await waitFor(() => expect(result.current.data).not.toBeNull());

    await act(async () => FakeEventSource.instances[0].listeners.changed());
    await waitFor(() => expect(result.current.error?.message).toBe('Backend unreachable'));
    expect(result.current.data).toEqual({ departments: ['first'] });
  });

  it('reloads for a new month and closes the old stream', async () => {
    fetchControlCenter.mockResolvedValue({ departments: [] });
    const { rerender } = renderHook(({ month }) => useControlCenter(month), { initialProps: { month: '2026-10' } });
    await waitFor(() => expect(fetchControlCenter).toHaveBeenCalledWith('2026-10'));

    rerender({ month: '2026-11' });
    await waitFor(() => expect(fetchControlCenter).toHaveBeenCalledWith('2026-11'));
    expect(FakeEventSource.instances[0].closed).toBe(true);
  });

  it('polls as a safety net', async () => {
    vi.useFakeTimers();
    fetchControlCenter.mockResolvedValue({ departments: [] });
    renderHook(() => useControlCenter('2026-10'));
    await act(async () => {});
    const callsAfterLoad = fetchControlCenter.mock.calls.length;

    await act(async () => vi.advanceTimersByTime(30_000));
    expect(fetchControlCenter.mock.calls.length).toBe(callsAfterLoad + 1);
  });

  it('still works where EventSource does not exist', async () => {
    vi.stubGlobal('EventSource', undefined);
    fetchControlCenter.mockResolvedValue({ departments: ['only'] });
    const { result } = renderHook(() => useControlCenter('2026-10'));
    await waitFor(() => expect(result.current.data).toEqual({ departments: ['only'] }));
  });
});
