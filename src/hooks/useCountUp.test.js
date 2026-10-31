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
