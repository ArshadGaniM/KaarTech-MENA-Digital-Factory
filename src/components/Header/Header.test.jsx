import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Header from './Header';
import { NAV_ITEMS } from '../../lib/navigation';

describe('Header', () => {
  it('links "Dashboard" to the first dashboard section', () => {
    render(<Header />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', NAV_ITEMS[0].hash);
  });
});
