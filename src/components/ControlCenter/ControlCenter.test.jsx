import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ControlCenter from './ControlCenter';
import { FLOORS } from './factoryLayout';
import { useDepartmentNames } from '../../hooks/useDepartmentNames';

vi.mock('../../hooks/useDepartmentNames');

const names = new Map(FLOORS.map((floor) => [floor.departmentCode, `Name of ${floor.departmentCode}`]));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ControlCenter', () => {
  it('shows a polite status region while the departments load', () => {
    useDepartmentNames.mockReturnValue({ data: null, isLoading: true, error: null });
    render(<ControlCenter />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('shows an alert when the departments fail to load', () => {
    useDepartmentNames.mockReturnValue({ data: null, isLoading: false, error: new Error('Backend unreachable') });
    render(<ControlCenter />);
    expect(screen.getByRole('alert')).toHaveTextContent('Backend unreachable');
  });

  it('shows one floor per department, in sequence, named from the departments table', () => {
    useDepartmentNames.mockReturnValue({ data: names, isLoading: false, error: null });
    render(<ControlCenter />);

    expect(screen.getByRole('heading', { name: 'MENA Digital Factory' })).toBeInTheDocument();
    const floorNames = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(floorNames).toEqual(FLOORS.map((floor) => `Name of ${floor.departmentCode}`));
    expect(floorNames[0]).toBe('Name of DEPT-002');
  });

  it('falls back to the department code when the departments table has no such row', () => {
    useDepartmentNames.mockReturnValue({ data: new Map(), isLoading: false, error: null });
    render(<ControlCenter />);

    expect(screen.getAllByRole('heading', { level: 3 })[0]).toHaveTextContent('DEPT-002');
  });

  it('gives each team its own room, labelled with the team code, on its floor', () => {
    useDepartmentNames.mockReturnValue({ data: names, isLoading: false, error: null });
    render(<ControlCenter />);

    const development = screen.getByRole('list', { name: 'Name of DEPT-003 teams' });
    const codes = within(development).getAllByRole('listitem').map((room) => room.textContent);
    expect(codes).toEqual(FLOORS.find((floor) => floor.id === 'development').teams);
  });
});
