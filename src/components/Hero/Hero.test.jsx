import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Hero from './Hero';
import { NAV_ITEMS } from '../../lib/navigation';

describe('Hero', () => {
  it('links "Enter the Application" to the first dashboard section', () => {
    render(<Hero />);

    expect(screen.getByRole('link', { name: 'Enter the Application' })).toHaveAttribute(
      'href',
      NAV_ITEMS[0].hash
    );
  });

  it('links "See Our Delivery Centers" to the marketing anchor, not the dashboard\'s colliding route', () => {
    render(<Hero />);

    expect(screen.getByRole('link', { name: 'See Our Delivery Centers' })).toHaveAttribute(
      'href',
      '#our-delivery-centers'
    );
  });
});
