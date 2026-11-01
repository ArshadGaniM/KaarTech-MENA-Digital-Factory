import { describe, expect, it } from 'vitest';
import { fitScale, MIN_FIT_VIEWPORT_WIDTH } from './fitScale';

const size = { contentWidth: 2400, contentHeight: 1200, availableWidth: 1800, availableHeight: 1000, viewportWidth: 1920 };

describe('fitScale', () => {
  it('shrinks to the tighter of the two directions', () => {
    // Width allows 0.75, height allows 0.833, so the width decides.
    expect(fitScale(size)).toBe(0.75);
    expect(fitScale({ ...size, contentWidth: 1500, contentHeight: 2000 })).toBe(0.5);
  });

  it('never enlarges content that already fits', () => {
    expect(fitScale({ ...size, contentWidth: 800, contentHeight: 600 })).toBe(1);
  });

  it('keeps the full size, so the content scrolls, on a screen narrower than 1200 pixels', () => {
    expect(fitScale({ ...size, viewportWidth: MIN_FIT_VIEWPORT_WIDTH - 1 })).toBe(1);
    expect(fitScale({ ...size, viewportWidth: MIN_FIT_VIEWPORT_WIDTH })).toBeLessThan(1);
  });

  it.each([0, -5, NaN, undefined])('keeps the full size when a measure is %s', (bad) => {
    expect(fitScale({ ...size, contentWidth: bad })).toBe(1);
    expect(fitScale({ ...size, availableHeight: bad })).toBe(1);
  });

  it('rounds down, so a rounding error never adds a scrollbar', () => {
    expect(fitScale({ ...size, contentWidth: 3000, availableWidth: 1000 })).toBe(0.333);
  });
});
