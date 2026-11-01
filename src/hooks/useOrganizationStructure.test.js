import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAllMasterDataTableRows } from '../lib/masterDataApi';
import { useOrganizationStructure } from './useOrganizationStructure';

vi.mock('../lib/masterDataApi', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAllMasterDataTableRows: vi.fn(),
}));

const TABLE_COUNT = 6;
const loads = () => fetchAllMasterDataTableRows.mock.calls.length / TABLE_COUNT;

class FakeEventSource {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.listeners = {};
    this.close = vi.fn();
    FakeEventSource.instances.push(this);
  }
  addEventListener(name, listener) {
    this.listeners[name] = listener;
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.instances = [];
  fetchAllMasterDataTableRows.mockReset();
  fetchAllMasterDataTableRows.mockResolvedValue([]);
  vi.stubGlobal('EventSource', FakeEventSource);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useOrganizationStructure', () => {
  it('starts loading, then returns the built structure', async () => {
    const { result } = renderHook(() => useOrganizationStructure());
    expect(result.current).toMatchObject({ data: null, isLoading: true, error: null });

    await act(async () => {});

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data.totalSeats).toBe(0);
    expect(result.current.data.projectManagers).toHaveLength(5);
  });

  it('works when the browser has no EventSource', async () => {
    vi.unstubAllGlobals();
    const { result } = renderHook(() => useOrganizationStructure());
    await act(async () => {});

    expect(result.current.data).not.toBeNull();
  });

  it('reloads shortly after the change stream says data changed', async () => {
    renderHook(() => useOrganizationStructure());
    await act(async () => {});
    expect(loads()).toBe(1);

    act(() => FakeEventSource.instances[0].listeners.changed());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(loads()).toBe(2);
  });

  it('reloads every 30 seconds even without a change event', async () => {
    renderHook(() => useOrganizationStructure());
    await act(async () => {});

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(loads()).toBe(2);
  });

  it('keeps the last data and reports the error when a refresh fails', async () => {
    const { result } = renderHook(() => useOrganizationStructure());
    await act(async () => {});
    fetchAllMasterDataTableRows.mockRejectedValue(new Error('boom'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.error).toHaveProperty('message', 'boom');
    expect(result.current.isLoading).toBe(false);
  });

  it('reports the error with no data when the first load fails', async () => {
    fetchAllMasterDataTableRows.mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useOrganizationStructure());
    await act(async () => {});

    expect(result.current).toMatchObject({ data: null, isLoading: false });
    expect(result.current.error.message).toBe('down');
  });

  it('closes the stream and stops polling on unmount', async () => {
    const { unmount } = renderHook(() => useOrganizationStructure());
    await act(async () => {});

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(FakeEventSource.instances[0].close).toHaveBeenCalledOnce();
    expect(loads()).toBe(1);
  });
});
