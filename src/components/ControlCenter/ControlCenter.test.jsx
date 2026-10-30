import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ControlCenter from './ControlCenter';
import { FLOORS } from './factoryLayout';

describe('ControlCenter', () => {
  it('shows the factory building with one floor per department, in sequence', () => {
    render(<ControlCenter />);

    expect(screen.getByRole('heading', { name: 'MENA Digital Factory' })).toBeInTheDocument();
    const names = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(names).toEqual(FLOORS.map((floor) => floor.name));
    expect(names[0]).toBe('Design Dept');
    expect(names[2]).toBe('Development Dept');
  });

  it('lists each floor\'s team codes in a row on its own floor', () => {
    render(<ControlCenter />);

    const development = screen.getByRole('list', { name: 'Development Dept teams' });
    const codes = within(development).getAllByRole('listitem').map((item) => item.textContent);
    expect(codes).toEqual(FLOORS.find((floor) => floor.id === 'development').teams);
    expect(codes[0]).toBe('DEV-01');
  });
});
