import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import FitToScreen from './FitToScreen';

// jsdom does no layout, so sizes are given by hand: the content is 2400 by 1200
// and the space for it is 1800 by 1000.
function mockSizes() {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(2400);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(1200);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1800);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(1000);
}

const renderFrame = () =>
  render(
    <FitToScreen>
      <p>content</p>
    </FitToScreen>
  );

afterEach(() => {
  vi.restoreAllMocks();
  window.innerWidth = 1024;
});

describe('FitToScreen', () => {
  it('shrinks the content to fit on a wide screen', () => {
    mockSizes();
    window.innerWidth = 1920;
    renderFrame();

    const inner = screen.getByText('content').parentElement;
    expect(inner).toHaveAttribute('data-scale', '0.75');
    expect(inner.style.transform).toBe('scale(0.75)');
    // Centred: (1800 - 2400 * 0.75) / 2 = 0
    expect(inner.style.marginLeft).toBe('0px');
  });

  it('keeps the full size, to scroll, on a screen narrower than 1200 pixels', () => {
    mockSizes();
    window.innerWidth = 1000;
    renderFrame();

    const inner = screen.getByText('content').parentElement;
    expect(inner).toHaveAttribute('data-scale', '1');
    expect(inner.style.transform).toBe('');
  });

  it('keeps the full size when nothing can be measured', () => {
    window.innerWidth = 1920;
    renderFrame();

    expect(screen.getByText('content').parentElement).toHaveAttribute('data-scale', '1');
  });

  it('centres the shrunken content sideways', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1000);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(2000);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(1000);
    window.innerWidth = 1920;
    renderFrame();

    const inner = screen.getByText('content').parentElement;
    // Height decides: 1000 / 2000 = 0.5. Free width: 1800 - 1000 * 0.5 = 1300, half of it each side.
    expect(inner).toHaveAttribute('data-scale', '0.5');
    expect(inner.style.marginLeft).toBe('650px');
  });

  it('measures again when the window is resized, and stops listening when it is removed', () => {
    mockSizes();
    window.innerWidth = 1920;
    const { unmount } = renderFrame();
    const inner = screen.getByText('content').parentElement;
    expect(inner).toHaveAttribute('data-scale', '0.75');

    window.innerWidth = 1000;
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(inner).toHaveAttribute('data-scale', '1');

    const removed = vi.spyOn(window, 'removeEventListener');
    unmount();
    expect(removed).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
