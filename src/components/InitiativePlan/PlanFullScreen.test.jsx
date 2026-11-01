import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlanFullScreen from './PlanFullScreen';

const renderFrame = (onClose = () => {}) =>
  render(
    <PlanFullScreen title="Plan" onClose={onClose}>
      <button type="button">inside</button>
    </PlanFullScreen>
  );

describe('PlanFullScreen', () => {
  it('is a modal dialog named by its title, with its content inside', () => {
    renderFrame();

    const dialog = screen.getByRole('dialog', { name: 'Plan' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toContainElement(screen.getByRole('button', { name: 'inside' }));
  });

  it('puts focus on Close when it opens', () => {
    renderFrame();

    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('calls onClose for the Close button and for Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderFrame(onClose);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('calls the latest onClose after a re-render, without moving focus', async () => {
    const user = userEvent.setup();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderFrame(first);
    screen.getByRole('button', { name: 'inside' }).focus();

    rerender(
      <PlanFullScreen title="Plan" onClose={second}>
        <button type="button">inside</button>
      </PlanFullScreen>
    );
    expect(screen.getByRole('button', { name: 'inside' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
