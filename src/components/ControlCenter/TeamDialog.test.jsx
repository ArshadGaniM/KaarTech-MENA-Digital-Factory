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

beforeEach(() => {
  vi.resetAllMocks();
});

describe('TeamDialog', () => {
  it('shows a polite status while loading and an alert on failure', () => {
    useTeamDetail.mockReturnValue({ data: null, isLoading: true, error: null });
    const { rerender } = render(<TeamDialog code="TEAM-001" month="2026-10" onClose={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');

    useTeamDetail.mockReturnValue({ data: null, isLoading: false, error: new Error('Backend unreachable') });
    rerender(<TeamDialog code="TEAM-001" month="2026-10" onClose={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Backend unreachable');
  });

  it('shows the team, month, hours, projects and every position with its person and percentages', () => {
    useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
    render(<TeamDialog code="TEAM-001" month="2026-10" onClose={() => {}} />);

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
    render(<TeamDialog code="TEAM-001" month="2026-10" onClose={() => {}} />);

    expect(screen.getByRole('row', { name: /Module Lead/ })).toHaveTextContent('not counted in the team');
    const vacant = screen.getByRole('row', { name: /Vacant/ });
    expect(within(vacant).getAllByText('—')).toHaveLength(2);
  });

  it('says when a team has no project assignment', () => {
    useTeamDetail.mockReturnValue({ data: { ...detail, projects: [] }, isLoading: false, error: null });
    render(<TeamDialog code="TEAM-001" month="2026-10" onClose={() => {}} />);
    expect(screen.getByText('No project assignment for this team.')).toBeInTheDocument();
  });

  it('closes with the button, with Escape, and by clicking outside, but not by clicking inside', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
    render(<TeamDialog code="TEAM-001" month="2026-10" onClose={onClose} />);

    await user.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('dialog').parentElement);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('moves focus to the close button when it opens', () => {
    useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
    render(<TeamDialog code="TEAM-001" month="2026-10" onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });
});
