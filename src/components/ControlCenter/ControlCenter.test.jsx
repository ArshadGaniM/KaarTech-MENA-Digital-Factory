import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ControlCenter from './ControlCenter';
import { FLOORS } from './factoryLayout';
import { useFactoryData } from '../../hooks/useFactoryData';

vi.mock('../../hooks/useFactoryData');

const departmentNames = new Map(FLOORS.map((floor) => [floor.departmentCode, `Name of ${floor.departmentCode}`]));
const loaded = (teamCodesByDepartment = new Map()) => ({
  data: { departmentNames, teamCodesByDepartment },
  isLoading: false,
  error: null,
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ControlCenter', () => {
  it('shows a polite status region while the factory loads', () => {
    useFactoryData.mockReturnValue({ data: null, isLoading: true, error: null });
    render(<ControlCenter />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('shows an alert when the factory fails to load', () => {
    useFactoryData.mockReturnValue({ data: null, isLoading: false, error: new Error('Backend unreachable') });
    render(<ControlCenter />);
    expect(screen.getByRole('alert')).toHaveTextContent('Backend unreachable');
  });

  it('shows one floor per department, in sequence, named from the departments table', () => {
    useFactoryData.mockReturnValue(loaded());
    render(<ControlCenter />);

    expect(screen.getByRole('heading', { name: 'MENA Digital Factory' })).toBeInTheDocument();
    const floorNames = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(floorNames).toEqual(FLOORS.map((floor) => `Name of ${floor.departmentCode}`));
  });

  it('falls back to the department code when the departments table has no such row', () => {
    useFactoryData.mockReturnValue({
      data: { departmentNames: new Map(), teamCodesByDepartment: new Map() },
      isLoading: false,
      error: null,
    });
    render(<ControlCenter />);

    expect(screen.getAllByRole('heading', { level: 3 })[0]).toHaveTextContent('DEPT-002');
  });

  it('lists a department\'s team codes in a row on its own floor', () => {
    useFactoryData.mockReturnValue(loaded(new Map([['DEPT-003', ['TEAM-001', 'TEAM-002']]])));
    render(<ControlCenter />);

    const development = screen.getByRole('list', { name: 'Name of DEPT-003 teams' });
    expect(within(development).getAllByRole('listitem').map((team) => team.textContent)).toEqual([
      'TEAM-001',
      'TEAM-002',
    ]);
  });

  it('says a floor has no teams yet when the teams table has none for it', () => {
    useFactoryData.mockReturnValue(loaded());
    render(<ControlCenter />);

    const design = screen.getByRole('list', { name: 'Name of DEPT-002 teams' });
    expect(within(design).getByText('No teams yet')).toBeInTheDocument();
  });
});
