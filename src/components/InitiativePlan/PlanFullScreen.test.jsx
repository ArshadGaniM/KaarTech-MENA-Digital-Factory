import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlanFullScreen from './PlanFullScreen';

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
    <PlanFullScreen title="Plan" onClose={() => {}}>
      <p>content</p>
    </PlanFullScreen>
  );

afterEach(() => {
  vi.restoreAllMocks();
  window.innerWidth = 1024;
});

describe('PlanFullScreen', () => {
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

  it('is a modal dialog named by its title', () => {
    renderFrame();

    expect(screen.getByRole('dialog', { name: 'Plan' })).toHaveAttribute('aria-modal', 'true');
  });
});
