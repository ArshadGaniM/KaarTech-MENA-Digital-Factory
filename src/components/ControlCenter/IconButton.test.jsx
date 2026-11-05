import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IconButton from './IconButton';

describe('IconButton', () => {
  it('names the button by its label and shows no tooltip at rest', () => {
    render(<IconButton icon="plus" label="Assign" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Assign' })).toBeInTheDocument();
    expect(screen.queryByText('Assign')).not.toBeInTheDocument();
  });

  it('shows the tooltip on hover and hides it on leave', async () => {
    const user = userEvent.setup();
    render(<IconButton icon="plus" label="Assign" onClick={() => {}} />);
    const button = screen.getByRole('button', { name: 'Assign' });
    await user.hover(button);
    expect(screen.getByText('Assign')).toHaveAttribute('aria-hidden', 'true');
    await user.unhover(button);
    expect(screen.queryByText('Assign')).not.toBeInTheDocument();
  });

  it('shows the tooltip on keyboard focus and hides it on blur', async () => {
    const user = userEvent.setup();
    render(<IconButton icon="plus" label="Assign" onClick={() => {}} />);
    await user.tab();
    expect(screen.getByText('Assign')).toBeInTheDocument();
    await user.tab();
    expect(screen.queryByText('Assign')).not.toBeInTheDocument();
  });

  it('does not show the tooltip for focus that is not keyboard-driven', () => {
    render(<IconButton icon="plus" label="Assign" onClick={() => {}} />);
    const button = screen.getByRole('button', { name: 'Assign' });
    vi.spyOn(button, 'matches').mockReturnValue(false);
    act(() => button.focus());
    expect(screen.queryByText('Assign')).not.toBeInTheDocument();
  });

  it('still shows the tooltip on focus when the browser cannot evaluate :focus-visible', () => {
    render(<IconButton icon="plus" label="Assign" onClick={() => {}} />);
    const button = screen.getByRole('button', { name: 'Assign' });
    vi.spyOn(button, 'matches').mockImplementation(() => {
      throw new SyntaxError('unsupported selector');
    });
    act(() => button.focus());
    expect(screen.getByText('Assign', { selector: '[role="tooltip"]' })).toBeInTheDocument();
  });

  it('hides the tooltip after a click until the mouse leaves', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<IconButton icon="plus" label="Assign" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Assign' });
    await user.hover(button);
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Assign')).not.toBeInTheDocument();
    await user.unhover(button);
    await user.hover(button);
    expect(screen.getByText('Assign')).toBeInTheDocument();
  });

  it('keeps a disabled-with-reason button focusable, announces the reason and ignores clicks', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<IconButton icon="close" label="Unassign" onClick={onClick} disabledReason="Reload after the server update" />);
    const button = screen.getByRole('button', { name: 'Unassign: Reload after the server update' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    await user.tab();
    expect(button).toHaveFocus();
    expect(screen.getByText('Unassign: Reload after the server update')).toBeInTheDocument();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByText('Unassign: Reload after the server update')).toBeInTheDocument();
  });

  it('shows the reason on tap even when hover never happened', async () => {
    const user = userEvent.setup();
    render(<IconButton icon="close" label="Unassign" onClick={() => {}} disabledReason="Reload" />);
    const button = screen.getByRole('button');
    await user.click(button);
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent('Unassign: Reload');
  });

  it('uses the plain disabled attribute for a normal disabled button', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<IconButton icon="close" label="Unassign" onClick={onClick} disabled />);
    const button = screen.getByRole('button', { name: 'Unassign' });
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute('aria-disabled');
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
