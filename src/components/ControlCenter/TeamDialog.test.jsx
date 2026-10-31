import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TeamDialog from './TeamDialog';
import { useTeamDetail } from '../../hooks/useTeamDetail';

vi.mock('../../hooks/useTeamDetail');

const detail = {
  code: 'TEAM-001',
  name: 'Alpha',
  department: { code: 'DEPT-002', name: 'Design Services' },
  month: '2026-10',
  competencies: ['FICO', 'MM'],
  availableHours: 480,
  allocatedHours: 240,
  utilizedHours: 240,
  status: 'full',
  projects: [{ projectId: 'P1', projectName: 'Rollout', start: '2026-10-01', end: '2026-10-31' }],
  seats: [
    { positionCode: 'POS-1', positionName: 'Module Lead', counted: false, employeeId: 1, employeeName: 'Mona Lead', allocationPercentage: 100, availablePercentage: 0 },
    { positionCode: 'POS-3', positionName: 'Consultant', counted: true, employeeId: 3, employeeName: 'Sam Split', allocationPercentage: 50, availablePercentage: 25 },
    { positionCode: 'POS-4', positionName: 'Consultant', counted: true, employeeId: null, employeeName: null, allocationPercentage: null, availablePercentage: null },
  ],
};

const props = {
  code: 'TEAM-001',
  month: '2026-10',
  refreshKey: 1,
  updatedAt: new Date(2026, 9, 30, 14, 3, 22),
  onClose: () => {},
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('TeamDialog', () => {
  it('shows a polite status while loading and an alert on failure', () => {
    useTeamDetail.mockReturnValue({ data: null, isLoading: true, error: null });
    const { rerender } = render(<TeamDialog {...props} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');

    useTeamDetail.mockReturnValue({ data: null, isLoading: false, error: new Error('Backend unreachable') });
    rerender(<TeamDialog {...props} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Backend unreachable');
  });

  it('shows the team, month, hours, projects and every position with its person and percentages', () => {
    useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
    render(<TeamDialog {...props} />);

    const dialog = screen.getByRole('dialog', { name: 'Alpha' });
    expect(dialog).toHaveTextContent('Design Services');
    expect(dialog).toHaveTextContent('October 2026');
    expect(dialog).toHaveTextContent('Fully utilized');
    expect(dialog).toHaveTextContent('Rollout, 2026-10-01 to 2026-10-31');

    const sam = screen.getByRole('row', { name: /Sam Split/ });
    expect(within(sam).getByText('50%')).toBeInTheDocument();
    expect(within(sam).getByText('25%')).toBeInTheDocument();
  });

  it('labels a Module Lead as not counted and an empty seat as vacant with dashes', () => {
    useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
    render(<TeamDialog {...props} />);

    expect(screen.getByRole('row', { name: /Module Lead/ })).toHaveTextContent('not counted in the team');
    const vacant = screen.getByRole('row', { name: /Vacant/ });
    expect(within(vacant).getAllByText('—')).toHaveLength(2);
  });

  it('says when a team has no project assignment', () => {
    useTeamDetail.mockReturnValue({ data: { ...detail, projects: [] }, isLoading: false, error: null });
    render(<TeamDialog {...props} />);
    expect(screen.getByText('No project assignment for this team.')).toBeInTheDocument();
  });

  it('closes with the button, with Escape, and by clicking outside, but not by clicking inside', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
    render(<TeamDialog {...props} onClose={onClose} />);

    await user.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('dialog').parentElement);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('moves focus to the close button when it opens', () => {
    useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
    render(<TeamDialog {...props} />);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('asks for the team with the refresh key, so a refreshed page refetches the open team', () => {
    useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
    render(<TeamDialog {...props} refreshKey={42} />);
    expect(useTeamDetail).toHaveBeenCalledWith('TEAM-001', '2026-10', 42);
  });

  it('shows when the figures were last updated, and "Updating…" while a refetch runs, without hiding the team', () => {
    useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
    const { rerender } = render(<TeamDialog {...props} />);
    expect(screen.getByText(/Live, updated 14:03:22/)).toBeInTheDocument();

    useTeamDetail.mockReturnValue({ data: detail, isLoading: true, error: null });
    rerender(<TeamDialog {...props} />);
    expect(screen.getByText('Updating…')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Sam Split/ })).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('keeps the last data and says so when a refresh fails', () => {
    useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: new Error('Backend unreachable') });
    render(<TeamDialog {...props} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not refresh, showing the last data: Backend unreachable');
    expect(screen.getByRole('row', { name: /Sam Split/ })).toBeInTheDocument();
    expect(screen.queryByText(/Live, updated/)).not.toBeInTheDocument();
  });
});
