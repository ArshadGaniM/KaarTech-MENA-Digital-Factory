import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortalGate from './PortalGate';

describe('PortalGate', () => {
  it('opens the portal when the right password is typed', async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn();
    render(<PortalGate onUnlock={onUnlock} />);

    await user.type(screen.getByLabelText('Password'), 'Meena UOCC');
    await user.click(screen.getByRole('button', { name: 'Open the portal' }));

    await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1));
  });

  it('shows an error and stays locked for a wrong password, and clears it on typing', async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn();
    render(<PortalGate onUnlock={onUnlock} />);

    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Open the portal' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That password is not right');
    expect(onUnlock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Password'), 'x');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the button off until something is typed', () => {
    render(<PortalGate onUnlock={() => {}} />);

    expect(screen.getByRole('button', { name: 'Open the portal' })).toBeDisabled();
  });
});
