import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCountUp } from './useCountUp';

const realMatchMedia = window.matchMedia;

const setReducedMotion = (reduced) => {
  window.matchMedia = (query) => ({ matches: reduced && query.includes('prefers-reduced-motion') });
};

afterEach(() => {
  window.matchMedia = realMatchMedia;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useCountUp', () => {
  it('returns the target immediately when the user prefers reduced motion', () => {
    setReducedMotion(true);

    const { result } = renderHook(() => useCountUp(500));

    expect(result.current).toBe(500);
  });

  it('returns null untouched, so "not loaded" never animates from zero', () => {
    setReducedMotion(false);

    const { result } = renderHook(() => useCountUp(null));

    expect(result.current).toBeNull();
  });

  describe('with motion allowed', () => {
    let frames;

    beforeEach(() => {
      setReducedMotion(false);
      frames = [];
      vi.stubGlobal('requestAnimationFrame', (callback) => frames.push(callback));
      vi.stubGlobal('cancelAnimationFrame', () => {});
      vi.spyOn(performance, 'now').mockReturnValue(0);
    });

    it('starts at zero, rises, and lands exactly on the target', () => {
      const { result } = renderHook(() => useCountUp(100, 1000));
      expect(result.current).toBe(0);

      act(() => frames.shift()(500));
      expect(result.current).toBeGreaterThan(0);
      expect(result.current).toBeLessThan(100);

      act(() => frames.shift()(1000));
      expect(result.current).toBe(100);
      expect(frames).toHaveLength(0);
    });

    it('never shows -0 when the first frame timestamp is earlier than the start time', () => {
      performance.now.mockReturnValue(100);
      const { result } = renderHook(() => useCountUp(100, 1000));

      act(() => frames.shift()(50));

      expect(Object.is(result.current, -0)).toBe(false);
      expect(result.current).toBeGreaterThanOrEqual(0);
    });

    it('cancels the pending frame when the component unmounts', () => {
      const cancel = vi.fn();
      vi.stubGlobal('cancelAnimationFrame', cancel);
      const { unmount } = renderHook(() => useCountUp(100, 1000));

      unmount();

      expect(cancel).toHaveBeenCalled();
    });

    it('stops animating and returns null when the target goes back to null', () => {
      const { result, rerender } = renderHook(({ target }) => useCountUp(target, 1000), { initialProps: { target: 100 } });
      act(() => frames.shift()(1000));
      expect(result.current).toBe(100);

      rerender({ target: null });

      expect(result.current).toBeNull();
    });

    it('animates from the last shown value when the target changes', () => {
      const { result, rerender } = renderHook(({ target }) => useCountUp(target, 1000), { initialProps: { target: 100 } });
      act(() => frames.shift()(1000));
      expect(result.current).toBe(100);

      rerender({ target: 200 });
      act(() => frames.shift()(500));

      expect(result.current).toBeGreaterThan(100);
      expect(result.current).toBeLessThan(200);
    });
  });
});
