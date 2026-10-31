import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Header from './Header';
import { DASHBOARD_HASH } from '../../lib/navigation';

describe('Header', () => {
  it('links "Dashboard" to the dashboard section', () => {
    render(<Header />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', DASHBOARD_HASH);
  });

  it('links "Delivery Centers" to the marketing anchor, not the dashboard\'s colliding route', () => {
    render(<Header />);

    expect(screen.getByRole('link', { name: 'Delivery Centers' })).toHaveAttribute(
      'href',
      '#our-delivery-centers'
    );
  });

  it('links "Initiative Plan" to the portal section', () => {
    render(<Header />);

    expect(screen.getByRole('link', { name: 'Initiative Plan' })).toHaveAttribute('href', '#initiative-plan');
  });
});
