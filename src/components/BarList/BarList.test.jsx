import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BarList from './BarList';

describe('BarList', () => {
  it('renders each row with a readable name that keeps the label and the count apart', () => {
    render(<BarList max={100} rows={[{ key: 'a', label: 'Analyst', count: 1200, onClick: () => {} }]} />);

    expect(screen.getByRole('button', { name: 'Analyst 1,200' })).toBeInTheDocument();
  });

  it('sizes each bar against max', () => {
    const { container } = render(
      <BarList
        max={200}
        rows={[
          { key: 'a', label: 'A', count: 200, onClick: () => {} },
          { key: 'b', label: 'B', count: 50, onClick: () => {} },
        ]}
      />
    );

    const widths = [...container.querySelectorAll('[aria-hidden="true"] > span')].map((fill) => fill.style.width);
    expect(widths).toEqual(['100%', '25%']);
  });

  it('does not divide by zero when every count is zero', () => {
    const { container } = render(<BarList max={0} rows={[{ key: 'a', label: 'A', count: 0, onClick: () => {} }]} />);

    expect(container.querySelector('[aria-hidden="true"] > span').style.width).toBe('0%');
  });

  it('calls onClick for an interactive row', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<BarList max={10} rows={[{ key: 'a', label: 'A', count: 5, onClick }]} />);

    await user.click(screen.getByRole('button', { name: /^A/ }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('marks a toggle row as pressed, and leaves a plain row without aria-pressed', () => {
    render(
      <BarList
        max={10}
        rows={[
          { key: 'a', label: 'Toggle', count: 5, onClick: () => {}, pressed: true },
          { key: 'b', label: 'Plain', count: 5, onClick: () => {} },
        ]}
      />
    );

    expect(screen.getByRole('button', { name: /Toggle/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Plain/ })).not.toHaveAttribute('aria-pressed');
  });

  it('disables a row that is not selectable', () => {
    render(<BarList max={10} rows={[{ key: 'a', label: 'Not set', count: 5, onClick: () => {}, disabled: true }]} />);

    expect(screen.getByRole('button', { name: /Not set/ })).toBeDisabled();
  });

  it('renders a row without onClick as plain text, not a button', () => {
    render(<BarList max={10} rows={[{ key: 'o', label: 'Other designations', count: 354 }]} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Other designations')).toBeInTheDocument();
    expect(screen.getByText('354')).toBeInTheDocument();
  });
});
