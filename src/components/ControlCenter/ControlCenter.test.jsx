import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ControlCenter from './ControlCenter';
import { useControlCenter } from '../../hooks/useControlCenter';
import { useTeamDetail } from '../../hooks/useTeamDetail';
import { currentMonth } from '../../lib/months';

vi.mock('../../hooks/useControlCenter');
vi.mock('../../hooks/useTeamDetail');

const team = (overrides) => ({
  code: 'TEAM-001',
  name: 'Alpha',
  primaryCompetency: 'FICO',
  competencies: ['FICO'],
  memberCount: 2,
  seatCount: 3,
  vacantSeatCount: 1,
  availableHours: 480,
  allocatedHours: 320,
  utilizedHours: 160,
  vacantHours: 160,
  utilizationPercent: 50,
  status: 'partial',
  ...overrides,
});

// Departments arrive top floor first, as the backend sends them.
const DEPARTMENTS = [
  { code: 'DEPT-001', floorNumber: 13 },
  { code: 'DEPT-002', floorNumber: 10 },
  { code: 'DEPT-003', floorNumber: 8 },
  { code: 'DEPT-013', floorNumber: 1 },
];

const snapshot = (teamsByCode = {}) => ({
  month: '2026-10',
  departments: DEPARTMENTS.map(({ code, floorNumber }) => ({
    code,
    floorNumber,
    name: `Name of ${code}`,
    teams: teamsByCode[code] ?? [],
  })),
});

const loaded = (data = snapshot()) => ({ data, isLoading: false, error: null, updatedAt: new Date(2026, 9, 30, 14, 3, 22) });

beforeEach(() => {
  vi.resetAllMocks();
  useTeamDetail.mockReturnValue({ data: null, isLoading: true, error: null });
});

describe('ControlCenter', () => {
  it('shows a polite status while the first load runs', () => {
    useControlCenter.mockReturnValue({ data: null, isLoading: true, error: null, updatedAt: null });
    render(<ControlCenter />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('shows an alert, and keeps the month picker, when the load fails with no data', () => {
    useControlCenter.mockReturnValue({ data: null, isLoading: false, error: new Error('Backend unreachable'), updatedAt: null });
    render(<ControlCenter />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the factory: Backend unreachable');
    expect(screen.getByRole('button', { name: 'Next month' })).toBeInTheDocument();
    expect(screen.getByText('Not live')).toBeInTheDocument();
  });

  it('keeps showing the last data, and says it is not live, when a refresh fails', () => {
    useControlCenter.mockReturnValue({ ...loaded(), error: new Error('Backend unreachable') });
    render(<ControlCenter />);
    expect(screen.getByRole('alert')).toHaveTextContent('showing the last data');
    expect(screen.getByText(/Not live, last updated 14:03:22/)).toBeInTheDocument();
    expect(screen.queryByText(/^Live,/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'MENA Digital Factory', level: 1 })).toBeInTheDocument();
  });

  it('raises an alert when the backend returns no departments at all', () => {
    useControlCenter.mockReturnValue(loaded({ month: '2026-10', departments: [] }));
    render(<ControlCenter />);
    expect(screen.getByRole('alert')).toHaveTextContent('no departments');
  });

  it('shows one floor per department, top floor first, numbered and named from the data', () => {
    useControlCenter.mockReturnValue(loaded());
    render(<ControlCenter />);

    const names = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(names).toEqual(DEPARTMENTS.map(({ code }) => `Name of ${code}`));
    expect(screen.getAllByText(/^F\d+$/).map((label) => label.textContent)).toEqual(['F13', 'F10', 'F8', 'F1']);
  });

  it('shows a department added later without any code change', () => {
    const data = snapshot();
    data.departments.splice(1, 0, { code: 'DEPT-099', floorNumber: 12, name: 'Brand New Services', teams: [] });
    useControlCenter.mockReturnValue(loaded(data));
    render(<ControlCenter />);

    expect(screen.getByRole('heading', { name: 'Brand New Services' })).toBeInTheDocument();
    expect(screen.getByText('F12')).toBeInTheDocument();
  });

  it('says a floor has no teams yet', () => {
    useControlCenter.mockReturnValue(loaded());
    render(<ControlCenter />);
    expect(screen.getAllByText('No teams yet')).toHaveLength(DEPARTMENTS.length);
  });

  it('puts every team of a floor on screen and groups them by competency', () => {
    useControlCenter.mockReturnValue(
      loaded(
        snapshot({
          'DEPT-003': [
            team({ code: 'TEAM-010', name: 'Ten', competencies: ['ABAP'] }),
            team({ code: 'TEAM-011', name: 'Eleven', competencies: ['ABAP'] }),
            team({ code: 'TEAM-012', name: 'Twelve', competencies: ['FICO'] }),
          ],
        })
      )
    );
    render(<ControlCenter />);

    const abap = screen.getByRole('list', { name: 'Name of DEPT-003, ABAP teams' });
    expect(within(abap).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('list', { name: 'Name of DEPT-003, FICO teams' })).toBeInTheDocument();
  });

  it('asks for the selected month, and changes it from the picker', async () => {
    const user = userEvent.setup();
    useControlCenter.mockReturnValue(loaded());
    render(<ControlCenter />);
    expect(useControlCenter).toHaveBeenLastCalledWith(currentMonth());

    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(useControlCenter).not.toHaveBeenLastCalledWith(currentMonth());
  });

  it('shows when the data was last updated, or that it is updating', () => {
    useControlCenter.mockReturnValue(loaded());
    const { rerender } = render(<ControlCenter />);
    expect(screen.getByText(/Live, updated 14:03:22/)).toBeInTheDocument();

    useControlCenter.mockReturnValue({ ...loaded(), isLoading: true });
    rerender(<ControlCenter />);
    expect(screen.getByText('Updating…')).toBeInTheDocument();
  });

  it('opens a team popup from its card and closes it with Escape', async () => {
    const user = userEvent.setup();
    useControlCenter.mockReturnValue(loaded(snapshot({ 'DEPT-002': [team({})] })));
    render(<ControlCenter />);

    await user.click(screen.getByRole('button', { name: /Alpha, TEAM-001/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(useTeamDetail).toHaveBeenCalledWith('TEAM-001', currentMonth(), loaded().updatedAt.getTime());

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
