import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TeamDialog from './TeamDialog';
import { useTeamDetail } from '../../hooks/useTeamDetail';
import { createRecord, deleteRecord, fetchMasterDataTable, updateRecord } from '../../lib/masterDataApi';

vi.mock('../../hooks/useTeamDetail');
vi.mock('../../lib/masterDataApi', async (importOriginal) => ({
  ...(await importOriginal()),
  createRecord: vi.fn(),
  updateRecord: vi.fn(),
  deleteRecord: vi.fn(),
  fetchMasterDataTable: vi.fn(),
}));
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

vi.mock('../DeleteRecordModal', () => ({
  default: (props) => (
    <div role="dialog" aria-label="delete position">
      <span>{JSON.stringify({ route: props.route, selectedValue: props.selectedValue })}</span>
      <button type="button" onClick={props.onDeleted}>confirm delete</button>
      <button type="button" onClick={props.onClose}>close delete</button>
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
    { positionCode: 'POS-1', positionName: 'Module Lead', counted: false, deploymentId: 'D-1', startDate: '2026-08-01', endDate: '2027-03-31', employeeId: 1, employeeName: 'Mona Lead', allocationPercentage: 100, availablePercentage: 0, plannedResourceCost: null, actualResourceCost: null, allocatedResourceCost: null, costSource: null },
    { positionCode: 'POS-3', positionName: 'Consultant', counted: true, deploymentId: 'D-3', startDate: '2026-08-01', endDate: '2027-01-31', employeeId: 3, employeeName: 'Sam Split', allocationPercentage: 50, availablePercentage: 25, plannedResourceCost: 1750, actualResourceCost: 2000, allocatedResourceCost: 1000, costSource: 'Actual' },
    { positionCode: 'POS-4', positionName: 'Consultant', counted: true, deploymentId: null, startDate: null, endDate: null, employeeId: null, employeeName: null, allocationPercentage: null, availablePercentage: null, plannedResourceCost: null, actualResourceCost: null, allocatedResourceCost: null, costSource: null },
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
    expect(dialog).toHaveTextContent('Rollout');
    expect(dialog).toHaveTextContent('1 Sep 2026 to 5 Dec 2026');
    expect(dialog).not.toHaveTextContent('2026-09-01');

    const sam = screen.getByRole('row', { name: /Sam Split/ });
    expect(within(sam).getByText('50%')).toBeInTheDocument();
    expect(within(sam).getByText('25%')).toBeInTheDocument();
  });

  it('labels an empty seat as vacant with dashes and drops the old Module Lead suffix', () => {
    useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
    render(<TeamDialog {...props} />);

    expect(screen.getByRole('row', { name: /Module Lead/ })).not.toHaveTextContent('not counted in the team');
    expect(screen.getByRole('row', { name: /Module Lead/ })).toHaveTextContent('POS-1');
    const vacant = screen.getByRole('row', { name: /Vacant/ });
    expect(within(vacant).getAllByText('—')).toHaveLength(5);
    expect(within(vacant).getByRole('button', { name: 'Assign' })).toBeInTheDocument();
  });

  it('shows each project in its own row: name bold, project id below it, readable dates, Edit at the right', () => {
    useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
    render(<TeamDialog {...props} />);
    const row = screen.getByText('Rollout').closest('li');
    expect(screen.getByText('Rollout').tagName).toBe('STRONG');
    expect(within(row).getByText('P1')).toBeInTheDocument();
    expect(within(row).getByText('1 Sep 2026 to 5 Dec 2026')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(row).queryByText(/active|status/i)).not.toBeInTheDocument();
  });

  it('says "No assignment" when nothing runs in the viewed month, and still lists the viewed month at 0% and $0.00', () => {
    useTeamDetail.mockReturnValue({
      data: {
        ...detail,
        month: '2027-01',
        status: 'unused',
        projects: [],
        assignmentEndDate: null,
        allocatedTeamCost: 0,
        monthlyPlan: {
          months: [
            { month: '2026-12', utilizationPercent: 100, cost: 2375 },
            { month: '2027-01', utilizationPercent: 0, cost: 0 },
          ],
          totalCost: 2375,
        },
      },
      isLoading: false,
      error: null,
    });
    render(<TeamDialog {...props} month="2027-01" />);
    expect(screen.getByText('No assignment')).toBeInTheDocument();
    expect(screen.getByText('Not utilized')).toBeInTheDocument();
    const utilization = screen.getByRole('region', { name: 'Month-wise Utilization Percentage' });
    expect(within(utilization).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['December 2026100%', 'January 20270%']);
    expect(within(screen.getByRole('region', { name: 'Month-wise Utilization Cost' })).getByText('$0.00')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('keeps the "No live project assignment" text when an older backend sends no plan months', () => {
    useTeamDetail.mockReturnValue({
      data: { ...detail, projects: [], assignmentEndDate: null, allocatedTeamCost: 0, monthlyPlan: { months: [], totalCost: 0 } },
      isLoading: false,
      error: null,
    });
    render(<TeamDialog {...props} />);
    expect(screen.getAllByText('No live project assignment')).toHaveLength(2);
    expect(screen.getByText('Planned utilization 0%')).toBeInTheDocument();
    expect(screen.getByText('Total $0.00')).toBeInTheDocument();
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

    it('shows the Allocated Team Monthly Cost at the top, and not the old label', () => {
      render(<TeamDialog {...props} />);
      const stat = screen.getByText('Allocated Team Monthly Cost').closest('li');
      expect(stat).toHaveTextContent('$2,375.00');
      expect(screen.queryByText('Allocated Team Cost')).not.toBeInTheDocument();
      expect(screen.queryByText('Allocated Team Total Cost')).not.toBeInTheDocument();
    });

    it('shows the Utilized Team Total Cost equal to the Total line of the cost panel', () => {
      render(<TeamDialog {...props} />);
      const stat = screen.getByText('Utilized Team Total Cost').closest('li');
      expect(stat).toHaveTextContent('$7,508.06');
      expect(screen.getByText('Total $7,508.06')).toBeInTheDocument();
    });

    it('shows a zero Utilized Team Total Cost for a team without plan months', () => {
      useTeamDetail.mockReturnValue({ data: { ...detail, projects: [], monthlyPlan: { months: [], totalCost: 0 } }, isLoading: false, error: null });
      render(<TeamDialog {...props} />);
      expect(screen.getByText('Utilized Team Total Cost').closest('li')).toHaveTextContent('$0.00');
    });

    it('shows the Module Lead note once at the bottom only when the team has a Module Lead seat', () => {
      const note = 'Module Lead position is not counted in the total available, allocated and planned utilization hours.';
      const { unmount } = render(<TeamDialog {...props} />);
      expect(screen.getAllByText(note)).toHaveLength(1);
      unmount();
      useTeamDetail.mockReturnValue({ data: { ...detail, seats: detail.seats.filter((s) => s.positionName !== 'Module Lead') }, isLoading: false, error: null });
      render(<TeamDialog {...props} />);
      expect(screen.queryByText(note)).not.toBeInTheDocument();
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
    const noProject = { ...detail, projects: [], assignmentEndDate: null };

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-15T09:00:00Z') });
      useTeamDetail.mockReturnValue({ data: noProject, isLoading: false, error: null });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('opens the Add form for this team with the team locked and the start date set to today', async () => {
      const user = userEvent.setup();
      render(<TeamDialog {...props} />);

      await user.click(screen.getByRole('button', { name: 'Add Project Assignment' }));

      const form = screen.getByRole('dialog', { name: 'form add' });
      const passed = JSON.parse(within(form).getByText(/route/).textContent);
      expect(passed).toMatchObject({
        route: 'project-assignments',
        record: null,
        initialValues: { teamId: 'TEAM-001', projectAssignmentStartDate: '2026-10-15' },
        lockedKeys: ['teamId'],
      });
    });

    it('opens the Edit form on the project, with the team locked', async () => {
      const user = userEvent.setup();
      useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
      render(<TeamDialog {...props} />);

      await user.click(screen.getByRole('button', { name: 'Edit' }));

      const passed = JSON.parse(within(screen.getByRole('dialog', { name: 'form edit' })).getByText(/route/).textContent);
      expect(passed.record).toEqual({
        id: 'A-1', projectId: 'P1', teamId: 'TEAM-001', projectAssignmentStartDate: '2026-09-01', projectAssignmentEndDate: '2026-12-05',
      });
      expect(passed.lockedKeys).toEqual(['teamId']);
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
      expect(screen.queryByRole('dialog', { name: 'form add' })).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();

      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Delete Project Assignment', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-15T09:00:00Z') });
      useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
      updateRecord.mockResolvedValue({});
      deleteRecord.mockResolvedValue(undefined);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('reads Delete Project Assignment while a project runs, never "End", and Add Project Assignment otherwise', () => {
      const { rerender } = render(<TeamDialog {...props} />);
      expect(screen.getByRole('button', { name: 'Delete Project Assignment' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add Project Assignment' })).not.toBeInTheDocument();
      expect(screen.queryByText(/End Project Assignment/)).not.toBeInTheDocument();

      useTeamDetail.mockReturnValue({ data: { ...detail, projects: [] }, isLoading: false, error: null });
      rerender(<TeamDialog {...props} />);
      expect(screen.getByRole('button', { name: 'Add Project Assignment' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete Project Assignment' })).not.toBeInTheDocument();
    });

    it('shows the project and dates with the end date set to yesterday, and saves it as a PATCH of the end date only', async () => {
      const user = userEvent.setup();
      render(<TeamDialog {...props} />);
      await user.click(screen.getByRole('button', { name: 'Delete Project Assignment' }));

      const form = screen.getByRole('form', { name: 'Delete Project Assignment' });
      expect(form).toHaveTextContent('Rollout');
      expect(form).toHaveTextContent('1 Sep 2026 to 5 Dec 2026');
      expect(within(form).getByLabelText('End date')).toHaveValue('2026-10-14');

      await user.click(within(form).getByRole('button', { name: 'Save' }));

      expect(updateRecord).toHaveBeenCalledWith('project-assignments', 'A-1', { projectAssignmentEndDate: '2026-10-14' });
      expect(deleteRecord).not.toHaveBeenCalled();
      expect(screen.queryByRole('form', { name: 'Delete Project Assignment' })).not.toBeInTheDocument();
      expect(useTeamDetail).toHaveBeenLastCalledWith('TEAM-001', '2026-10', `${props.updatedAt.getTime()}-1`);
    });

    it('saves an end date the user edited', async () => {
      const user = userEvent.setup();
      render(<TeamDialog {...props} />);
      await user.click(screen.getByRole('button', { name: 'Delete Project Assignment' }));
      const end = screen.getByLabelText('End date');
      await user.clear(end);
      await user.type(end, '2026-10-20');
      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(updateRecord).toHaveBeenCalledWith('project-assignments', 'A-1', { projectAssignmentEndDate: '2026-10-20' });
    });

    it('soft-deletes the row when the project has not started yet', async () => {
      const user = userEvent.setup();
      useTeamDetail.mockReturnValue({
        data: { ...detail, projects: [{ ...detail.projects[0], start: '2026-10-15', end: '2026-12-05' }] },
        isLoading: false,
        error: null,
      });
      render(<TeamDialog {...props} />);
      await user.click(screen.getByRole('button', { name: 'Delete Project Assignment' }));
      expect(screen.queryByLabelText('End date')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(deleteRecord).toHaveBeenCalledWith('project-assignments', 'A-1');
      expect(updateRecord).not.toHaveBeenCalled();
    });

    it('shows the API message and keeps the form open when the save fails', async () => {
      const user = userEvent.setup();
      updateRecord.mockRejectedValue(new Error('projectAssignmentEndDate must not be earlier than projectAssignmentStartDate.'));
      render(<TeamDialog {...props} />);
      await user.click(screen.getByRole('button', { name: 'Delete Project Assignment' }));
      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('must not be earlier');
      expect(screen.getByRole('form', { name: 'Delete Project Assignment' })).toBeInTheDocument();
    });

    it('shows the field messages of a 422 on the delete form too', async () => {
      const user = userEvent.setup();
      const failure = Object.assign(new Error('Request failed validation.'), {
        details: { projectAssignmentEndDate: 'Ends before the next assignment starts.' },
      });
      updateRecord.mockRejectedValue(failure);
      render(<TeamDialog {...props} />);
      await user.click(screen.getByRole('button', { name: 'Delete Project Assignment' }));
      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Ends before the next assignment starts.');
    });

    const ended = { id: 'A-0', projectId: 'P0', projectName: 'Old', start: '2026-05-01', end: '2026-10-10' };
    const withProjects = (projects) => ({ data: { ...detail, projects }, isLoading: false, error: null });

    it('targets the first project that has not ended, not an ended one that starts earlier', async () => {
      const user = userEvent.setup();
      useTeamDetail.mockReturnValue(withProjects([ended, detail.projects[0]]));
      render(<TeamDialog {...props} />);
      await user.click(screen.getByRole('button', { name: 'Delete Project Assignment' }));
      const form = screen.getByRole('form', { name: 'Delete Project Assignment' });
      expect(form).toHaveTextContent('Rollout');
      expect(form).not.toHaveTextContent('Old');
      await user.click(within(form).getByRole('button', { name: 'Save' }));
      expect(updateRecord).toHaveBeenCalledWith('project-assignments', 'A-1', { projectAssignmentEndDate: '2026-10-14' });
    });

    it('offers Add Project Assignment when every listed project has ended', () => {
      useTeamDetail.mockReturnValue(withProjects([ended]));
      render(<TeamDialog {...props} />);
      expect(screen.getByRole('button', { name: 'Add Project Assignment' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete Project Assignment' })).not.toBeInTheDocument();
    });

    it('limits the end date to the project dates and rejects one outside them without a request', async () => {
      const user = userEvent.setup();
      render(<TeamDialog {...props} />);
      await user.click(screen.getByRole('button', { name: 'Delete Project Assignment' }));
      const form = screen.getByRole('form', { name: 'Delete Project Assignment' });
      const end = within(form).getByLabelText('End date');
      expect(end).toHaveAttribute('min', '2026-09-01');
      expect(end).toHaveAttribute('max', '2026-12-05');

      for (const value of ['2026-12-06', '2026-08-31']) {
        await user.clear(end);
        await user.type(end, value);
        await user.click(within(form).getByRole('button', { name: 'Save' }));
        expect(within(form).getByRole('alert')).toHaveTextContent('between 1 Sep 2026 and 5 Dec 2026');
      }
      expect(updateRecord).not.toHaveBeenCalled();
      expect(deleteRecord).not.toHaveBeenCalled();
    });

    it('stays on the project it was opened on when a refresh reorders the projects', async () => {
      const user = userEvent.setup();
      const later = { id: 'A-2', projectId: 'P2', projectName: 'Later', start: '2026-11-01', end: '2027-02-01' };
      useTeamDetail.mockReturnValue(withProjects([detail.projects[0], later]));
      const { rerender } = render(<TeamDialog {...props} />);
      await user.click(screen.getByRole('button', { name: 'Delete Project Assignment' }));

      useTeamDetail.mockReturnValue(withProjects([{ ...detail.projects[0], end: '2026-10-14' }, later]));
      rerender(<TeamDialog {...props} />);
      expect(screen.getByRole('form', { name: 'Delete Project Assignment' })).toHaveTextContent('Rollout');
    });

    it('closes the form when its project disappears after a refresh', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<TeamDialog {...props} />);
      await user.click(screen.getByRole('button', { name: 'Delete Project Assignment' }));

      useTeamDetail.mockReturnValue(withProjects([]));
      rerender(<TeamDialog {...props} />);
      expect(screen.queryByRole('form', { name: 'Delete Project Assignment' })).not.toBeInTheDocument();
      useTeamDetail.mockReturnValue(withProjects([detail.projects[0]]));
      rerender(<TeamDialog {...props} />);
      expect(screen.queryByRole('form', { name: 'Delete Project Assignment' })).not.toBeInTheDocument();
    });

    it('shows the latest end among the projects as the assignment end', () => {
      const later = { id: 'A-2', projectId: 'P2', projectName: 'Later', start: '2026-09-02', end: '2027-02-01' };
      useTeamDetail.mockReturnValue(withProjects([later, detail.projects[0]]));
      render(<TeamDialog {...props} />);
      expect(screen.getByRole('region', { name: 'Month-wise Utilization Percentage' })).toHaveTextContent('Assignment ends 1 Feb 2027');
    });

    it('does not touch the Project Assignments master-data wording: Cancel just closes the form', async () => {
      const user = userEvent.setup();
      render(<TeamDialog {...props} />);
      await user.click(screen.getByRole('button', { name: 'Delete Project Assignment' }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('form', { name: 'Delete Project Assignment' })).not.toBeInTheDocument();
      expect(updateRecord).not.toHaveBeenCalled();
    });
  });

  describe('seats: Assign and Unassign', () => {
    const moduleLeadVacant = { ...detail.seats[2], positionCode: 'POS-9', positionName: 'Module Lead' };
    const withSeats = (seats) => ({ ...detail, seats });

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-15T09:00:00Z') });
      useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
      createRecord.mockResolvedValue({});
      updateRecord.mockResolvedValue({});
      deleteRecord.mockResolvedValue(undefined);
      fetchMasterDataTable.mockResolvedValue({
        rows: [
          { employeeId: 501, name: 'Amal Search', markedDeleted: 'No' },
          { employeeId: 502, name: 'Gone Person', markedDeleted: 'Yes' },
        ],
        total: 2,
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const openAssign = async (user, rowName = /Vacant/) => {
      await user.click(within(screen.getByRole('row', { name: rowName })).getByRole('button', { name: 'Assign' }));
      return screen.getByRole('form', { name: 'Assign POS-4' });
    };

    const pickPerson = async (user, form) => {
      await user.type(within(form).getByLabelText('Person'), 'Amal');
      await user.click(await within(form).findByRole('button', { name: 'Amal Search (501)' }));
    };

    it('gives only vacant seats an Assign button and only filled seats an Unassign button, and no Change person', () => {
      render(<TeamDialog {...props} />);
      expect(screen.getAllByRole('button', { name: 'Assign' })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Unassign' })).toHaveLength(2);
      expect(screen.queryByRole('button', { name: /change person/i })).not.toBeInTheDocument();
    });

    it('opens the form for that exact seat, with start = today and end = the latest end among the others seated', async () => {
      const user = userEvent.setup();
      render(<TeamDialog {...props} />);
      const form = await openAssign(user);

      expect(form).toHaveTextContent('Consultant');
      expect(form).toHaveTextContent('POS-4');
      expect(within(form).getByLabelText('Start date')).toHaveValue('2026-10-15');
      expect(within(form).getByLabelText('End date')).toHaveValue('2027-03-31');
      expect(within(form).getByLabelText('Allocation %')).toHaveValue(100);
    });

    it('leaves the end date empty when nobody else is seated', async () => {
      const user = userEvent.setup();
      useTeamDetail.mockReturnValue({ data: withSeats([detail.seats[2]]), isLoading: false, error: null });
      render(<TeamDialog {...props} />);
      const form = await openAssign(user);
      expect(within(form).getByLabelText('End date')).toHaveValue('');
    });

    it('leaves the end date empty when the latest end among the others is already past', async () => {
      const user = userEvent.setup();
      const past = detail.seats.map((s) => (s.employeeId === null ? s : { ...s, endDate: '2026-10-10' }));
      useTeamDetail.mockReturnValue({ data: withSeats(past), isLoading: false, error: null });
      render(<TeamDialog {...props} />);
      const form = await openAssign(user);
      expect(within(form).getByLabelText('End date')).toHaveValue('');
    });

    it('searches Resources by name or employee id, hides deleted ones, and saves a POST of the existing deployment route', async () => {
      const user = userEvent.setup();
      render(<TeamDialog {...props} />);
      const form = await openAssign(user);

      await user.type(within(form).getByLabelText('Person'), 'Amal');
      expect(fetchMasterDataTable).toHaveBeenCalledWith('resources', { limit: 8, query: 'Amal' });
      expect(await within(form).findByRole('button', { name: 'Amal Search (501)' })).toBeInTheDocument();
      expect(within(form).queryByText(/Gone Person/)).not.toBeInTheDocument();
      await user.click(within(form).getByRole('button', { name: 'Amal Search (501)' }));
      expect(form).toHaveTextContent('Selected: Amal Search (501)');

      await user.click(within(form).getByRole('button', { name: 'Save' }));

      expect(createRecord).toHaveBeenCalledWith('resource-deployment', {
        employeeId: 501,
        positionId: 'POS-4',
        allocationPercentage: 100,
        startDate: '2026-10-15',
        endDate: '2027-03-31',
      });
      expect(screen.queryByRole('form', { name: 'Assign POS-4' })).not.toBeInTheDocument();
      expect(useTeamDetail).toHaveBeenLastCalledWith('TEAM-001', '2026-10', `${props.updatedAt.getTime()}-1`);
    });

    it('sends the allocation the user typed', async () => {
      const user = userEvent.setup();
      render(<TeamDialog {...props} />);
      const form = await openAssign(user);
      await pickPerson(user, form);
      const allocation = within(form).getByLabelText('Allocation %');
      await user.clear(allocation);
      await user.type(allocation, '40');
      await user.click(within(form).getByRole('button', { name: 'Save' }));
      expect(createRecord.mock.calls[0][1].allocationPercentage).toBe(40);
    });

    it('hides Allocation % for a Module Lead seat and omits it from the request', async () => {
      const user = userEvent.setup();
      useTeamDetail.mockReturnValue({ data: withSeats([detail.seats[1], moduleLeadVacant]), isLoading: false, error: null });
      render(<TeamDialog {...props} />);
      await user.click(screen.getByRole('button', { name: 'Assign' }));
      const form = screen.getByRole('form', { name: 'Assign POS-9' });
      expect(within(form).queryByLabelText('Allocation %')).not.toBeInTheDocument();

      await pickPerson(user, form);
      await user.click(within(form).getByRole('button', { name: 'Save' }));

      expect(createRecord).toHaveBeenCalledTimes(1);
      const body = createRecord.mock.calls[0][1];
      expect(body).toEqual({ employeeId: 501, positionId: 'POS-9', startDate: '2026-10-15', endDate: '2027-01-31' });
      expect('allocationPercentage' in body).toBe(false);
    });

    it('needs a person before it saves anything', async () => {
      const user = userEvent.setup();
      render(<TeamDialog {...props} />);
      const form = await openAssign(user);
      await user.click(within(form).getByRole('button', { name: 'Save' }));
      expect(within(form).getByRole('alert')).toHaveTextContent('Pick a person');
      expect(createRecord).not.toHaveBeenCalled();
    });

    it('shows the API 422 messages inline, saves nothing and keeps the form open', async () => {
      const user = userEvent.setup();
      const error = Object.assign(new Error('Validation failed.'), { details: { allocationPercentage: 'This person would be over 100% on 2026-10-15.' } });
      createRecord.mockRejectedValue(error);
      render(<TeamDialog {...props} />);
      const form = await openAssign(user);
      await pickPerson(user, form);
      await user.click(within(form).getByRole('button', { name: 'Save' }));

      expect(await within(form).findByRole('alert')).toHaveTextContent('over 100%');
      expect(screen.getByRole('form', { name: 'Assign POS-4' })).toBeInTheDocument();
      expect(useTeamDetail).not.toHaveBeenLastCalledWith('TEAM-001', '2026-10', `${props.updatedAt.getTime()}-1`);
    });

    it('closes the Assign form on Cancel and on Escape before the popup', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<TeamDialog {...props} onClose={onClose} />);
      await openAssign(user);
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('form', { name: 'Assign POS-4' })).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('Unassign ends the deployment the day before today with a PATCH of the end date only', async () => {
      const user = userEvent.setup();
      render(<TeamDialog {...props} />);
      await user.click(within(screen.getByRole('row', { name: /Sam Split/ })).getByRole('button', { name: 'Unassign' }));

      expect(updateRecord).toHaveBeenCalledWith('resource-deployment', 'D-3', { endDate: '2026-10-14' });
      expect(deleteRecord).not.toHaveBeenCalled();
      expect(useTeamDetail).toHaveBeenLastCalledWith('TEAM-001', '2026-10', `${props.updatedAt.getTime()}-1`);
    });

    it('Unassign soft-deletes a deployment that starts today or later', async () => {
      const user = userEvent.setup();
      useTeamDetail.mockReturnValue({
        data: withSeats(detail.seats.map((s) => (s.employeeId === 3 ? { ...s, startDate: '2026-10-15' } : s))),
        isLoading: false,
        error: null,
      });
      render(<TeamDialog {...props} />);
      await user.click(within(screen.getByRole('row', { name: /Sam Split/ })).getByRole('button', { name: 'Unassign' }));

      expect(deleteRecord).toHaveBeenCalledWith('resource-deployment', 'D-3');
      expect(updateRecord).not.toHaveBeenCalled();
    });

    it('shows no Unassign on a seat whose deployment has already ended', () => {
      useTeamDetail.mockReturnValue({
        data: withSeats(detail.seats.map((s) => (s.employeeId === 3 ? { ...s, endDate: '2026-10-10' } : s))),
        isLoading: false,
        error: null,
      });
      render(<TeamDialog {...props} />);
      expect(within(screen.getByRole('row', { name: /Sam Split/ })).queryByRole('button', { name: 'Unassign' })).not.toBeInTheDocument();
      expect(within(screen.getByRole('row', { name: /Sam Split/ })).getByText('Ended 10 Oct 2026')).toBeInTheDocument();
      expect(within(screen.getByRole('row', { name: /Mona Lead/ })).getByRole('button', { name: 'Unassign' })).toBeInTheDocument();
    });

    it('keeps Unassign visible but disabled when an older backend sends no deployment id', () => {
      useTeamDetail.mockReturnValue({
        data: withSeats(detail.seats.map((s) => (s.employeeId === 3 ? { ...s, deploymentId: undefined } : s))),
        isLoading: false,
        error: null,
      });
      render(<TeamDialog {...props} />);
      const button = within(screen.getByRole('row', { name: /Sam Split/ })).getByRole('button', { name: 'Unassign' });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'Reload after the server update');
    });

    it('removes an old "Could not unassign" banner after a later action reloads the team', async () => {
      const user = userEvent.setup();
      updateRecord.mockRejectedValueOnce(new Error('Backend unreachable'));
      render(<TeamDialog {...props} />);
      await user.click(within(screen.getByRole('row', { name: /Sam Split/ })).getByRole('button', { name: 'Unassign' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not unassign');

      await user.click(within(screen.getByRole('row', { name: /Mona Lead/ })).getByRole('button', { name: 'Unassign' }));
      expect(screen.queryByText(/Could not unassign/)).not.toBeInTheDocument();
    });

    it('closes the Assign form when a refresh shows the seat is no longer vacant', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<TeamDialog {...props} />);
      await openAssign(user);

      useTeamDetail.mockReturnValue({
        data: withSeats(detail.seats.map((s) => (s.positionCode === 'POS-4' ? { ...s, employeeId: 9, employeeName: 'New Person', deploymentId: 'D-9', endDate: '2027-03-31' } : s))),
        isLoading: false,
        error: null,
      });
      rerender(<TeamDialog {...props} />);
      expect(screen.queryByRole('form', { name: 'Assign POS-4' })).not.toBeInTheDocument();
    });

    it('says "No people found" when a search returns nothing, and clears matches and errors as the text changes', async () => {
      const user = userEvent.setup();
      render(<TeamDialog {...props} />);
      const form = await openAssign(user);
      const box = within(form).getByLabelText('Person');

      fetchMasterDataTable.mockResolvedValue({ rows: [], total: 0 });
      await user.type(box, 'zz');
      expect(await within(form).findByText('No people found')).toBeInTheDocument();

      fetchMasterDataTable.mockRejectedValueOnce(new Error('Search is down'));
      await user.type(box, 'x');
      expect(await within(form).findByRole('alert')).toHaveTextContent('Could not search people: Search is down');
      expect(within(form).queryByText('No people found')).not.toBeInTheDocument();

      await user.clear(box);
      expect(within(form).queryByRole('alert')).not.toBeInTheDocument();
      expect(within(form).queryByText('No people found')).not.toBeInTheDocument();
    });

    it('drops the old matches when a new search fails', async () => {
      const user = userEvent.setup();
      render(<TeamDialog {...props} />);
      const form = await openAssign(user);
      const box = within(form).getByLabelText('Person');
      await user.type(box, 'Am');
      expect(await within(form).findByRole('button', { name: 'Amal Search (501)' })).toBeInTheDocument();

      fetchMasterDataTable.mockRejectedValueOnce(new Error('Search is down'));
      await user.type(box, 'a');
      expect(await within(form).findByRole('alert')).toBeInTheDocument();
      expect(within(form).queryByRole('button', { name: 'Amal Search (501)' })).not.toBeInTheDocument();
    });

    it('Unassign shows the API message and does not refetch when it fails', async () => {
      const user = userEvent.setup();
      updateRecord.mockRejectedValue(new Error('Backend unreachable'));
      render(<TeamDialog {...props} />);
      await user.click(within(screen.getByRole('row', { name: /Sam Split/ })).getByRole('button', { name: 'Unassign' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not unassign: Backend unreachable');
      expect(useTeamDetail).not.toHaveBeenLastCalledWith('TEAM-001', '2026-10', `${props.updatedAt.getTime()}-1`);
    });
  });

  describe('icon buttons', () => {
    beforeEach(() => {
      useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
    });

    it.each([
      ['Assign', () => within(screen.getByRole('row', { name: /Vacant/ })).getByRole('button', { name: 'Assign' })],
      ['Unassign', () => within(screen.getByRole('row', { name: /Sam Split/ })).getByRole('button', { name: 'Unassign' })],
      ['Delete Position', () => within(screen.getByRole('row', { name: /Sam Split/ })).getByRole('button', { name: 'Delete Position' })],
      ['Add Position', () => screen.getByRole('button', { name: 'Add Position' })],
    ])('%s shows its tooltip on hover and on keyboard focus', async (name, find) => {
      const user = userEvent.setup();
      render(<TeamDialog {...props} />);
      const button = find();
      expect(button).toHaveAccessibleName(name);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      await user.hover(button);
      expect(screen.getByRole('tooltip')).toHaveTextContent(name);
      await user.unhover(button);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      act(() => button.focus());
      expect(screen.getByRole('tooltip')).toHaveTextContent(name);
      act(() => button.blur());
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Add Position and Delete Position', () => {
    beforeEach(() => {
      useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
    });

    it('opens the shared Position form for this team: team locked, competencies pre-filled, team context shown', async () => {
      const user = userEvent.setup();
      render(<TeamDialog {...props} />);

      await user.click(screen.getByRole('button', { name: 'Add Position' }));

      const form = screen.getByRole('dialog', { name: 'form add' });
      expect(JSON.parse(within(form).getByText(/route/).textContent)).toMatchObject({
        route: 'positions',
        record: null,
        initialValues: { teamCode: 'TEAM-001', competencies: 'FICO, MM' },
        lockedKeys: ['teamCode'],
      });
    });

    it('caps the pre-filled competencies at 500 characters, dropping trailing names that do not fit', async () => {
      const names = Array.from({ length: 60 }, (_, i) => `Competency number ${String(i).padStart(2, '0')}`);
      useTeamDetail.mockReturnValue({ data: { ...detail, competencies: names }, isLoading: false, error: null });
      const user = userEvent.setup();
      render(<TeamDialog {...props} />);

      await user.click(screen.getByRole('button', { name: 'Add Position' }));

      const { initialValues } = JSON.parse(within(screen.getByRole('dialog', { name: 'form add' })).getByText(/route/).textContent);
      const kept = initialValues.competencies.split(', ');
      expect(initialValues.competencies.length).toBeLessThanOrEqual(500);
      expect(kept.length).toBeLessThan(names.length);
      expect(kept).toEqual(names.slice(0, kept.length));
      expect(`${initialValues.competencies}, ${names[kept.length]}`.length).toBeGreaterThan(500);
    });

    it('closes the form and refetches the team after it saves', async () => {
      const user = userEvent.setup();
      render(<TeamDialog {...props} />);
      await user.click(screen.getByRole('button', { name: 'Add Position' }));

      await user.click(screen.getByRole('button', { name: 'save form' }));

      expect(screen.queryByRole('dialog', { name: 'form add' })).not.toBeInTheDocument();
      expect(useTeamDetail).toHaveBeenLastCalledWith('TEAM-001', '2026-10', `${props.updatedAt.getTime()}-1`);
    });

    it('gives every seat a Delete Position button, also one with a person seated', () => {
      render(<TeamDialog {...props} />);
      expect(screen.getAllByRole('button', { name: 'Delete Position' })).toHaveLength(detail.seats.length);
    });

    it('opens the shared Delete form on that seat, and refetches the team once it is deleted', async () => {
      const user = userEvent.setup();
      render(<TeamDialog {...props} />);

      const row = screen.getByText('POS-4').closest('tr');
      await user.click(within(row).getByRole('button', { name: 'Delete Position' }));

      const modal = screen.getByRole('dialog', { name: 'delete position' });
      expect(JSON.parse(within(modal).getByText(/route/).textContent)).toEqual({ route: 'positions', selectedValue: 'POS-4' });

      await user.click(screen.getByRole('button', { name: 'confirm delete' }));

      expect(screen.queryByRole('dialog', { name: 'delete position' })).not.toBeInTheDocument();
      expect(useTeamDetail).toHaveBeenLastCalledWith('TEAM-001', '2026-10', `${props.updatedAt.getTime()}-1`);
    });

    it('closes an open modal before the popup on Escape', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<TeamDialog {...props} onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: 'Add Position' }));
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog', { name: 'form add' })).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();

      await user.click(within(screen.getByText('POS-4').closest('tr')).getByRole('button', { name: 'Delete Position' }));
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog', { name: 'delete position' })).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();

      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('what the gate asked for', () => {
    it('shows the next assignment as information, without an Edit button of its own', () => {
      useTeamDetail.mockReturnValue({
        data: { ...detail, projects: [], nextAssignment: { id: 'N', projectId: 'P2', projectName: 'Next Rollout', start: '2026-12-06', end: '2027-01-31' } },
        isLoading: false,
        error: null,
      });
      render(<TeamDialog {...props} />);
      expect(screen.getByText(/Next assignment: Next Rollout, 6 Dec 2026 to 31 Jan 2027/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    });

    it('says how many people were costed at the default rate, and tags a missing cost', () => {
      useTeamDetail.mockReturnValue({
        data: { ...detail, defaultedCostCount: 2, seats: detail.seats.map((s) => (s.employeeId === 3 ? { ...s, costSource: 'Missing', allocatedResourceCost: 0 } : s)) },
        isLoading: false,
        error: null,
      });
      render(<TeamDialog {...props} />);
      expect(screen.getByText('2 people costed at the default rate')).toBeInTheDocument();
      expect(within(screen.getByRole('row', { name: /Sam Split/ })).getByText('Missing')).toBeInTheDocument();
    });

    it('keeps editing the assignment it was opened on, even if a refetch changes the current one', async () => {
      const user = userEvent.setup();
      useTeamDetail.mockReturnValue({ data: detail, isLoading: false, error: null });
      const { rerender } = render(<TeamDialog {...props} />);
      await user.click(screen.getByRole('button', { name: 'Edit' }));

      useTeamDetail.mockReturnValue({ data: { ...detail, projects: [{ ...detail.projects[0], id: 'A-2' }] }, isLoading: false, error: null });
      rerender(<TeamDialog {...props} />);

      const passed = JSON.parse(within(screen.getByRole('dialog', { name: 'form edit' })).getByText(/route/).textContent);
      expect(passed.record.id).toBe('A-1');
    });
  });
});
