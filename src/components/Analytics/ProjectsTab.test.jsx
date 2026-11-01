import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectsTab from './ProjectsTab';
import { fetchAssignments, fetchStructure } from '../../lib/analyticsApi';

vi.mock('../../lib/analyticsApi');

const assignment = (teamCode, projectName, profitCenter, start, end, over = {}) => ({
  teamCode,
  teamName: teamCode,
  departmentName: 'Design',
  projectId: projectName,
  projectName,
  profitCenter,
  start,
  end,
  ...over,
});
const ASSIGNMENTS = [
  assignment('T1', 'Roll out', 'PC1', '2026-01-01', '2026-12-31'),
  assignment('T2', 'Roll out', 'PC1', '2026-03-01', '2026-06-30'),
  assignment('T3', 'Support', 'PC2', '2026-11-01', '2027-02-28', { departmentName: 'Audit' }),
];
const row = (teamCode, over = {}) => ({ departmentName: 'Design', teamCode, teamName: teamCode, practiceName: 'Finance', positionName: 'Consultant', competencies: [], filled: false, ...over });
const STRUCTURE = [row('T1'), row('T1'), row('T1'), row('T2'), row('T3', { departmentName: 'Audit', practiceName: null })];

const card = (name) => screen.getByRole('region', { name });
const cellsOf = (table) => within(table).getAllByRole('row').map((r) => Array.from(r.children, (cell) => cell.textContent));
const tableOf = async (user, name) => {
  await user.click(within(card(name)).getByRole('button', { name: 'Show table' }));
  return cellsOf(within(card(name)).getByRole('table'));
};
const renderTab = async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<ProjectsTab refreshKey={0} />);
  await screen.findByText('3 of 3 assignments');
  return user;
};

beforeEach(() => {
  vi.clearAllMocks();
  // Only the date is fixed, so the focus month and the 90 day window are stable.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-15T10:00:00Z'));
  fetchAssignments.mockResolvedValue(ASSIGNMENTS);
  fetchStructure.mockResolvedValue(STRUCTURE);
});

afterEach(() => vi.useRealTimers());

describe('ProjectsTab', () => {
  it('shows an error with Try again when the assignments cannot load', async () => {
    fetchAssignments.mockRejectedValueOnce(new Error('down'));
    render(<ProjectsTab refreshKey={0} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the projects: down');
  });

  it('counts the teams on each project', async () => {
    const user = await renderTab();

    expect(await tableOf(user, 'Teams per project')).toEqual([['Project', 'Teams'], ['Roll out', '2'], ['Support', '1']]);
  });

  it('counts work by profit center, by assignments or by teams', async () => {
    const user = await renderTab();

    expect(await tableOf(user, 'Work by profit center')).toEqual([['Profit center', 'Assignments'], ['PC1', '2'], ['PC2', '1']]);

    await user.selectOptions(within(card('Work by profit center')).getByLabelText('Count'), 'Teams');
    expect(cellsOf(within(card('Work by profit center')).getByRole('table'))[0]).toEqual(['Profit center', 'Teams']);
  });

  it('groups assignment lengths into bands of months, keeping empty bands', async () => {
    const user = await renderTab();

    expect(await tableOf(user, 'How long assignments last')).toEqual([
      ['Months', 'Assignments'],
      ['4-6', '2'],
      ['6-8', '0'],
      ['8-10', '0'],
      ['10-12', '0'],
      ['12-14', '1'],
    ]);
  });

  it('lists the assignments that end within the chosen number of days from today', async () => {
    const user = await renderTab();

    expect(await tableOf(user, 'Assignments ending soon')).toEqual([['Month', 'Assignments', 'Teams'], ['Dec 26', '1', '1']]);

    await user.selectOptions(within(card('Assignments ending soon')).getByLabelText('Within'), '180 days');
    expect(cellsOf(within(card('Assignments ending soon')).getByRole('table')).slice(1)).toEqual([['Dec 26', '1', '1'], ['Feb 27', '1', '1']]);
  });

  it('counts active projects and teams for each month of the range', async () => {
    const user = await renderTab();

    const table = await tableOf(user, 'Active projects and teams by month');
    expect(table[0]).toEqual(['Month', 'Projects', 'Teams']);
    expect(table.find((r) => r[0] === 'Nov 26')).toEqual(['Nov 26', '2', '2']);
    expect(table.find((r) => r[0] === 'May 27')).toEqual(['May 27', '0', '0']);
  });

  it('shows the share of each month a team has a project', async () => {
    const user = await renderTab();

    const table = await tableOf(user, 'Share of each month covered by a project');
    const header = table[0];
    const nov = header.indexOf('Nov 26');
    expect(table.find((r) => r[0] === 'T1')[nov]).toBe('100');
    expect(table.find((r) => r[0] === 'T2')[nov]).toBe('0');
    expect(table.find((r) => r[0] === 'T3')[nov]).toBe('100');
  });

  it('draws one bar per assignment on the timeline and orders them by the chosen field', async () => {
    const user = await renderTab();
    const timeline = within(card('Assignment timeline'));

    expect(timeline.getAllByRole('listitem').filter((item) => item.querySelector('i')).map((item) => item.querySelector('strong').textContent)).toEqual(['T1', 'T2', 'T3']);

    await user.selectOptions(timeline.getByLabelText('Order by'), 'End date');
    expect(timeline.getAllByRole('listitem').filter((item) => item.querySelector('i')).map((item) => item.querySelector('strong').textContent)).toEqual(['T2', 'T1', 'T3']);
  });

  it('lists the teams with no project in the focus month, with their department and practice', async () => {
    await renderTab();

    const idle = card('Teams with no project in Nov 26');
    expect(cellsOf(within(idle).getByRole('table'))).toEqual([['Team', 'Department', 'Practice', 'Positions'], ['T2', 'Design', 'Finance', '1']]);
  });

  it('narrows the charts to one project and clears with Reset slicers', async () => {
    const user = await renderTab();

    await user.selectOptions(screen.getByLabelText('Project'), 'Support');

    expect(screen.getByText('1 of 3 assignments')).toBeInTheDocument();
    expect(await tableOf(user, 'Work by profit center')).toEqual([['Profit center', 'Assignments'], ['PC2', '1']]);
    await user.click(screen.getByRole('button', { name: 'Reset slicers' }));
    expect(screen.getByText('3 of 3 assignments')).toBeInTheDocument();
  });

  it('keeps From before To when one month is moved past the other', async () => {
    const user = await renderTab();

    await user.selectOptions(screen.getByLabelText('From month'), '2027-05');

    expect(screen.getByLabelText('To month')).toHaveValue('2027-05');
  });
});
