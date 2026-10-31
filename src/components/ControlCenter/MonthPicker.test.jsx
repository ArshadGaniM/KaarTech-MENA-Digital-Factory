import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MonthPicker from './MonthPicker';

describe('MonthPicker', () => {
  it('shows the month and steps to the exact previous and next month', async () => {
    const onChange = vi.fn();
    render(<MonthPicker month="2026-12" onChange={onChange} />);

    expect(screen.getByLabelText('Month, December 2026')).toHaveValue('2026-12');
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));

    expect(onChange).toHaveBeenNthCalledWith(1, '2027-01');
    expect(onChange).toHaveBeenNthCalledWith(2, '2026-11');
  });

  it('reports a month typed into the input, and ignores a cleared input', () => {
    const onChange = vi.fn();
    render(<MonthPicker month="2026-10" onChange={onChange} />);
    const input = screen.getByLabelText(/^Month, /);

    fireEvent.change(input, { target: { value: '2027-03' } });
    expect(onChange).toHaveBeenCalledWith('2027-03');

    onChange.mockClear();
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
