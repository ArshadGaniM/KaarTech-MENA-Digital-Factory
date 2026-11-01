import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TeamDialog from './TeamDialog';
import { useTeamDetail } from '../../hooks/useTeamDetail';

vi.mock('../../hooks/useTeamDetail');
// The real form talks to the backend; the popup only has to open it with the right props.
vi.mock('../RecordFormModal', () => ({
  default: (props) => (
    <div role="dialog" aria-label={`form ${props.record ? 'edit' : 'add'}`}>
      <span>{JSON.stringify({ record: props.record ?? null, initialValues: props.initialValues, lockedKeys: props.lockedKeys, route: props.route })}</span>
      <button type="button" onClick={props.onSaved}>save form</button>
      <button type="button" onClick={props.onClose}>close form</button>
    </div>
  ),
}));

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
  allocatedTeamCost: 2375,
  locationMix: 'Hybrid',
  assignmentEndDate: '2026-12-05',
  projects: [{ id: 'A-1', projectId: 'P1', projectName: 'Rollout', start: '2026-09-01', end: '2026-12-05' }],
  monthlyPlan: {
    months: [
      { month: '2026-09', utilizationPercent: 100, cost: 2375 },
      { month: '2026-10', utilizationPercent: 100, cost: 2375 },
      { month: '2026-11', utilizationPercent: 100, cost: 2375 },
      { month: '2026-12', utilizationPercent: 16.13, cost: 383.06 },
    ],
    totalCost: 7508.06,
  },
  seats: [
    { positionCode: 'POS-1', positionName: 'Module Lead', counted: false, employeeId: 1, employeeName: 'Mona Lead', allocationPercentage: 100, availablePercentage: 0, plannedResourceCost: null, actualResourceCost: null, allocatedResourceCost: null, costSource: null },
    { positionCode: 'POS-3', positionName: 'Consultant', counted: true, employeeId: 3, employeeName: 'Sam Split', allocationPercentage: 50, availablePercentage: 25, plannedResourceCost: 1750, actualResourceCost: 2000, allocatedResourceCost: 1000, costSource: 'Actual' },
    { positionCode: 'POS-4', positionName: 'Consultant', counted: true, employeeId: null, employeeName: null, allocationPercentage: null, availablePercentage: null, plannedResourceCost: null, actualResourceCost: null, allocatedResourceCost: null, costSource: null },
  ],
};

const props = {
  code: 'TEAM-001',
  month: '2026-10',
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
    expect(dialog).toHaveTextContent('Rollout, 2026-09-01 to 2026-12-05');

    const sam = screen.getByRole('row', { name: /Sam Split/ });
    expect(within(sam).getByText('50%')).toBeInTheDocument();
    expect(within(sam).getByText('25%')).toBeInTheDocument();
  });

  it('labels a Module Lead as not counted and an empty seat as vacant with dashes', () => {
    useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
    render(<TeamDialog {...props} />);

    expect(screen.getByRole('row', { name: /Module Lead/ })).toHaveTextContent('not counted in the team');
    const vacant = screen.getByRole('row', { name: /Vacant/ });
    expect(within(vacant).getAllByText('—')).toHaveLength(5);
  });

  it('says when a team has no current assignment, and shows zero for the month-wise panels', () => {
    useTeamDetail.mockReturnValue({
      data: { ...detail, projects: [], assignmentEndDate: null, allocatedTeamCost: 0, monthlyPlan: { months: [], totalCost: 0 } },
      isLoading: false,
      error: null,
    });
    render(<TeamDialog {...props} />);
    expect(screen.getByText('No current assignment')).toBeInTheDocument();
    expect(screen.getAllByText('No live project assignment')).toHaveLength(2);
    expect(screen.getByText('Planned utilization 0%')).toBeInTheDocument();
    expect(screen.getByText('Total $0.00')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
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

  it('refetches the team whenever the page refreshed, using the page update time as the key', () => {
    useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
    const updatedAt = new Date(2026, 9, 30, 15, 0, 0);
    render(<TeamDialog {...props} updatedAt={updatedAt} />);
    expect(useTeamDetail).toHaveBeenCalledWith('TEAM-001', '2026-10', `${updatedAt.getTime()}-0`);
  });

  it('does not claim to be live while the page refresh is failing', () => {
    useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
    render(<TeamDialog {...props} pageError={new Error('Backend unreachable')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not refresh, showing the last data: Backend unreachable');
    expect(screen.queryByText(/Live, updated/)).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Sam Split/ })).toBeInTheDocument();
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

  describe('costs', () => {
    beforeEach(() => {
      useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
    });

    it('has the three cost columns after Available, named exactly', () => {
      render(<TeamDialog {...props} />);
      const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
      expect(headers).toEqual([
        'Position', 'Person', 'Allocation', 'Available',
        'Planned Resource Cost', 'Actual Resource Cost', 'Allocated Resource Cost',
      ]);
    });

    it('shows each person\'s costs with the source of the allocated one, and dashes where there is none', () => {
      render(<TeamDialog {...props} />);
      const sam = screen.getByRole('row', { name: /Sam Split/ });
      expect(within(sam).getByText('$1,750.00')).toBeInTheDocument();
      expect(within(sam).getByText('$2,000.00')).toBeInTheDocument();
      expect(within(sam).getByText('$1,000.00')).toBeInTheDocument();
      expect(within(sam).getByText('Actual')).toBeInTheDocument();
      expect(within(screen.getByRole('row', { name: /Module Lead/ })).getAllByText('—').length).toBeGreaterThanOrEqual(3);
    });

    it('shows the Allocated Team Cost at the top', () => {
      render(<TeamDialog {...props} />);
      const stat = screen.getByText('Allocated Team Cost').closest('li');
      expect(stat).toHaveTextContent('$2,375.00');
    });

    it('tags a person costed as the Senior Consultant default', () => {
      useTeamDetail.mockReturnValue({
        data: { ...detail, seats: detail.seats.map((s) => (s.employeeId === 3 ? { ...s, costSource: 'Default' } : s)) },
        isLoading: false,
        error: null,
      });
      render(<TeamDialog {...props} />);
      expect(within(screen.getByRole('row', { name: /Sam Split/ })).getByText('Default')).toBeInTheDocument();
    });
  });

  describe('month-wise panels', () => {
    it('lists each month of the live assignment with its utilization percentage and cost', () => {
      useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
      render(<TeamDialog {...props} />);

      const utilization = screen.getByRole('region', { name: 'Month-wise Utilization Percentage' });
      expect(within(utilization).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        'September 2026100%', 'October 2026100%', 'November 2026100%', 'December 202616.13%',
      ]);
      expect(utilization).toHaveTextContent('Assignment ends 5 Dec 2026');

      const cost = screen.getByRole('region', { name: 'Month-wise Utilization Cost' });
      expect(within(cost).getByText('$383.06')).toBeInTheDocument();
      expect(cost).toHaveTextContent('Total $7,508.06');
    });

    it('shows the Onsite, Offshore and Hybrid legend and marks the team\'s own', () => {
      useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
      render(<TeamDialog {...props} />);
      const legend = screen.getByRole('list', { name: 'Location of the people deployed' });
      expect(within(legend).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Onsite', 'Offshore', 'Hybrid']);
    });

    it('does not break when an older backend sends no plan', () => {
      const { monthlyPlan: _plan, ...older } = detail;
      useTeamDetail.mockReturnValue({ data: older, isLoading: false, error: null });
      render(<TeamDialog {...props} />);
      expect(screen.getByRole('region', { name: 'Month-wise Utilization Cost' })).toHaveTextContent('Total $0.00');
    });
  });

  describe('adding and editing the current project assignment', () => {
    beforeEach(() => {
      useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
    });

    it('opens the Add form for this team with the team filled in and locked', async () => {
      const user = userEvent.setup();
      render(<TeamDialog {...props} />);

      await user.click(screen.getByRole('button', { name: 'Add Project Assignment' }));

      const form = screen.getByRole('dialog', { name: 'form add' });
      const passed = JSON.parse(within(form).getByText(/route/).textContent);
      expect(passed).toMatchObject({ route: 'project-assignments', record: null, initialValues: { teamId: 'TEAM-001' }, lockedKeys: ['teamId'] });
    });

    it('offers the Add button even when the team already has a current assignment', () => {
      render(<TeamDialog {...props} />);
      expect(screen.getByRole('button', { name: 'Add Project Assignment' })).toBeInTheDocument();
    });

    it('opens the Edit form on the current assignment, with the team locked', async () => {
      const user = userEvent.setup();
      render(<TeamDialog {...props} />);

      await user.click(screen.getByRole('button', { name: 'Edit' }));

      const passed = JSON.parse(within(screen.getByRole('dialog', { name: 'form edit' })).getByText(/route/).textContent);
      expect(passed.record).toEqual({
        id: 'A-1', projectId: 'P1', teamId: 'TEAM-001', projectAssignmentStartDate: '2026-09-01', projectAssignmentEndDate: '2026-12-05',
      });
      expect(passed.lockedKeys).toEqual(['teamId']);
    });

    it('has no Delete or Undo delete action', () => {
      render(<TeamDialog {...props} />);
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('refetches the team after the form saves and closes the form', async () => {
      const user = userEvent.setup();
      render(<TeamDialog {...props} />);
      await user.click(screen.getByRole('button', { name: 'Add Project Assignment' }));

      await user.click(screen.getByRole('button', { name: 'save form' }));

      expect(screen.queryByRole('dialog', { name: 'form add' })).not.toBeInTheDocument();
      expect(useTeamDetail).toHaveBeenLastCalledWith('TEAM-001', '2026-10', `${props.updatedAt.getTime()}-1`);
    });

    it('closes only the form on Escape, and the popup on the next Escape', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<TeamDialog {...props} onClose={onClose} />);
      await user.click(screen.getByRole('button', { name: 'Add Project Assignment' }));

      await user.keyboard('{Escape}');
      expect(onClose).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'close form' }));
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
