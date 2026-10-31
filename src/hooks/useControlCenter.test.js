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
    expect(fetchControlCenter.mock.calls.length).toBeGreaterThan(callsAfterLoad);
  });

  it('still works where EventSource does not exist', async () => {
    vi.stubGlobal('EventSource', undefined);
    fetchControlCenter.mockResolvedValue({ departments: ['only'] });
    const { result } = renderHook(() => useControlCenter('2026-10'));
    await waitFor(() => expect(result.current.data).toEqual({ departments: ['only'] }));
  });
});
