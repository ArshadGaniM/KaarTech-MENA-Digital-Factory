import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Analytics from './Analytics';
import { fetchPeople, fetchSeats } from '../../lib/analyticsApi';
import { currentMonth, shiftMonth as addMonths } from '../../lib/months';

vi.mock('../../lib/analyticsApi');

const person = (id, over = {}) => ({
  employeeId: id,
  name: `Person ${id}`,
  subDivision: 'SAP DeepTech',
  region: 'MENA',
  position: 'Analyst',
  designation: 'Analyst',
  skills: ['ABAP'],
  locationType: 'Offshore',
  employmentType: 'Full Time',
  geBatch: 'GE22',
  totalExperience: 3,
  sapExperience: 2,
  kaarExperience: 1,
  allocation: 0,
  ...over,
});
const PEOPLE = [
  person(1),
  person(2, { locationType: 'Onsite', region: 'KTGlobal', designation: 'Consultant', allocation: 100, totalExperience: 9 }),
  person(3, { designation: 'Consultant', allocation: 60, totalExperience: 5 }),
  person(4, { totalExperience: 7 }),
];

const month = currentMonth();
const seat = (team, over = {}) => ({
  month,
  departmentName: 'Design',
  teamCode: team,
  teamName: team,
  practiceName: 'Finance',
  positionName: 'Consultant',
  filled: false,
  availableHours: 160,
  allocatedHours: 0,
  utilizedHours: 0,
  occupants: [],
  ...over,
});
const SEATS = [
  seat('TEAM-1', { filled: true, allocatedHours: 160, utilizedHours: 80 }),
  seat('TEAM-2'),
  seat('TEAM-3', { departmentName: 'Audit' }),
];

const renderTab = (tab) => render(<Analytics tab={tab} refreshKey={0} />);
const card = (name) => screen.getByRole('region', { name });
const openTable = async (user, name) => {
  await user.click(within(card(name)).getByRole('button', { name: 'Show table' }));
  return within(card(name)).getByRole('table');
};
const cellsOf = (table) => within(table).getAllByRole('row').map((row) => Array.from(row.children, (cell) => cell.textContent));

beforeEach(() => {
  vi.clearAllMocks();
  fetchPeople.mockResolvedValue(PEOPLE);
  fetchSeats.mockResolvedValue(SEATS);
});

describe('Analytics loading', () => {
  it('shows Loading, then the slicers with the number of people', async () => {
    renderTab('workforce');

    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(await screen.findByText('4 of 4 people')).toBeInTheDocument();
  });

  it('shows the error and tries again on request', async () => {
    const user = userEvent.setup();
    fetchPeople.mockRejectedValueOnce(new Error('down'));
    renderTab('workforce');

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the workforce: down');
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('4 of 4 people')).toBeInTheDocument();
    expect(fetchPeople).toHaveBeenCalledTimes(2);
  });
});

describe('Workforce tab', () => {
  it('shows the totals', async () => {
    renderTab('workforce');

    const totals = await screen.findByRole('list', { name: 'Workforce totals' });
    expect(within(totals).getByText('Headcount').parentElement).toHaveTextContent(/^Headcount4$/);
    expect(within(totals).getByText('Deployed today').parentElement).toHaveTextContent('50%');
    expect(within(totals).getByText('Offshore share').parentElement).toHaveTextContent('75%');
  });

  it('narrows every chart when a slicer is set, and clears with Reset slicers', async () => {
    const user = userEvent.setup();
    renderTab('workforce');
    await screen.findByText('4 of 4 people');

    await user.selectOptions(screen.getByLabelText('Location type'), 'Onsite');

    expect(screen.getByText('1 of 4 people')).toBeInTheDocument();
    const totals = screen.getByRole('list', { name: 'Workforce totals' });
    expect(within(totals).getByText('Headcount').parentElement).toHaveTextContent('1');
    const table = await openTable(user, 'Headcount by designation');
    expect(cellsOf(table)).toEqual([['Designation', 'People'], ['Consultant', '1']]);

    await user.click(screen.getByRole('button', { name: 'Reset slicers' }));
    expect(screen.getByText('4 of 4 people')).toBeInTheDocument();
  });

  it('keeps all of a chart’s own slices when its own slicer is set', async () => {
    const user = userEvent.setup();
    renderTab('workforce');
    await screen.findByText('4 of 4 people');

    await user.selectOptions(screen.getByLabelText('Designation'), 'Analyst');

    const table = await openTable(user, 'Headcount by designation');
    expect(cellsOf(table)).toEqual([['Designation', 'People'], ['Analyst', '2'], ['Consultant', '2']]);
  });

  it('counts skills once per person and splits headcount by the chosen field', async () => {
    const user = userEvent.setup();
    renderTab('workforce');
    await screen.findByText('4 of 4 people');

    expect(cellsOf(await openTable(user, 'Skill mix'))).toEqual([['Skill', 'People'], ['ABAP', '4']]);

    await user.selectOptions(within(card('Headcount split')).getByLabelText('Split by'), 'Region');
    expect(cellsOf(await openTable(user, 'Headcount split'))).toEqual([['Region', 'People'], ['MENA', '3'], ['KTGlobal', '1']]);
  });

  it('draws experience bands that follow the chosen band width', async () => {
    const user = userEvent.setup();
    renderTab('workforce');
    await screen.findByText('4 of 4 people');
    await openTable(user, 'Experience bands');

    await user.selectOptions(within(card('Experience bands')).getByLabelText('Band width (years)'), '5');

    expect(cellsOf(within(card('Experience bands')).getByRole('table'))).toEqual([['Years', 'People'], ['0-5', '1'], ['5-10', '3']]);
  });

  it('clicking a heatmap cell sets both slicers to that cell', async () => {
    const user = userEvent.setup();
    renderTab('workforce');
    await screen.findByText('4 of 4 people');

    await user.click(within(card('Two-way headcount grid')).getByRole('button', { name: '1' }));

    expect(screen.getByLabelText('Employment type')).toHaveValue('Full Time');
    expect(screen.getByLabelText('Region')).toHaveValue('KTGlobal');
    expect(screen.getByText('1 of 4 people')).toBeInTheDocument();
  });

  it('shows dashes and zeros, not NaN, when the slicers leave nobody', async () => {
    const user = userEvent.setup();
    renderTab('workforce');
    await screen.findByText('4 of 4 people');

    await user.selectOptions(screen.getByLabelText('Region'), 'KTGlobal');
    await user.selectOptions(screen.getByLabelText('Location type'), 'Offshore');

    const totals = screen.getByRole('list', { name: 'Workforce totals' });
    expect(within(totals).getByText('Headcount').parentElement).toHaveTextContent(/^Headcount0$/);
    expect(within(totals).getByText('Offshore share').parentElement).toHaveTextContent('0%');
    expect(within(totals).getByText('Average total experience (years)').parentElement).toHaveTextContent('–');
  });
});

describe('Chart card', () => {
  it('says so when the slicers leave nothing, and downloads the table as CSV', async () => {
    const user = userEvent.setup();
    const click = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const create = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const element = create(tag);
      if (tag === 'a') element.click = click;
      return element;
    });
    renderTab('workforce');
    await screen.findByText('4 of 4 people');

    await user.click(within(card('Skill mix')).getByRole('button', { name: 'Download CSV' }));
    expect(click).toHaveBeenCalledTimes(1);

    await user.selectOptions(screen.getByLabelText('Region'), 'KTGlobal');
    await user.selectOptions(screen.getByLabelText('Location type'), 'Offshore');
    expect(within(card('Skill mix')).getByText('Nothing to show for the current slicers.')).toBeInTheDocument();
    expect(within(card('Skill mix')).getByRole('button', { name: 'Download CSV' })).toBeDisabled();
    document.createElement.mockRestore();
  });
});

describe('Allocation tab', () => {
  it('asks for a range of months around the current one', async () => {
    renderTab('allocation');
    await screen.findByText('4 of 4 people');

    // The request starts in an effect after the first render, so wait for it.
    await waitFor(() => expect(fetchSeats).toHaveBeenCalledWith(addMonths(month, -2), addMonths(month, 6)));
  });

  it('counts people by how fully they are deployed', async () => {
    const user = userEvent.setup();
    renderTab('allocation');
    await screen.findByText('4 of 4 people');

    expect(cellsOf(await openTable(user, 'Allocation of people'))).toEqual([
      ['Allocation', 'People'],
      ['Fully allocated', '1'],
      ['Partly allocated', '1'],
      ['Not deployed', '2'],
    ]);
  });

  it('lists the people not deployed, most experienced first, and switches to the partly allocated', async () => {
    const user = userEvent.setup();
    renderTab('allocation');
    await screen.findByText('4 of 4 people');

    const first = within(card('People to look at')).getByRole('table');
    expect(cellsOf(first).slice(1).map((row) => row[0])).toEqual(['Person 4 (4)', 'Person 1 (1)']);

    await user.selectOptions(within(card('People to look at')).getByLabelText('Show'), 'Partly allocated');
    expect(cellsOf(within(card('People to look at')).getByRole('table')).slice(1)).toEqual([['Person 3 (3)', 'Consultant', 'Offshore', '60', '5']]);
  });

  it('spreads allocation into bands that include their upper end, and adds a zero band on request', async () => {
    const user = userEvent.setup();
    renderTab('allocation');
    await screen.findByText('4 of 4 people');

    expect(cellsOf(await openTable(user, 'How allocation is spread'))).toEqual([
      ['Allocation %', 'People'],
      ['1-25', '0'],
      ['26-50', '0'],
      ['51-75', '1'],
      ['76-100', '1'],
    ]);

    await user.selectOptions(within(card('How allocation is spread')).getByLabelText('Include people not deployed'), 'Yes');
    expect(cellsOf(within(card('How allocation is spread')).getByRole('table'))[1]).toEqual(['0', '2']);
  });

  it('works out seats, fill and vacancy for the focus month', async () => {
    const user = userEvent.setup();
    renderTab('allocation');
    await screen.findByText(/3 seats in/);

    const vacant = card(new RegExp(`^Vacant seats in`));
    await user.click(within(vacant).getByRole('button', { name: 'Show table' }));
    expect(cellsOf(within(vacant).getByRole('table'))).toEqual([['Name', 'Vacant seats'], ['TEAM-2', '1'], ['TEAM-3', '1']]);

    await user.selectOptions(screen.getByLabelText('Department'), 'Audit');
    expect(screen.getByText(/^1 seats in/)).toBeInTheDocument();
  });

  it('follows the Control Center hours in the month totals', async () => {
    const user = userEvent.setup();
    renderTab('allocation');
    await screen.findByText(/3 seats in/);

    const table = await openTable(user, 'Hours by month');
    expect(cellsOf(table)[1].slice(1)).toEqual(['480', '160', '80']);
  });

  it('shows the error from the seat request and recovers on Try again', async () => {
    const user = userEvent.setup();
    fetchSeats.mockRejectedValueOnce(new Error('seats down'));
    renderTab('allocation');

    expect(await screen.findByText(/Could not load seat hours: seats down/)).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Try again' })[0]);
    expect(await screen.findByText(/3 seats in/)).toBeInTheDocument();
  });

  it('keeps From before To when one is moved past the other', async () => {
    const user = userEvent.setup();
    renderTab('allocation');
    await screen.findByText(/3 seats in/);

    await user.selectOptions(screen.getByLabelText('From month'), addMonths(month, 8));

    expect(screen.getByLabelText('To month')).toHaveValue(addMonths(month, 8));
  });
});

const seatsIn = (rows) => rows.map((row) => seat(row.team, { ...row, teamCode: row.code ?? row.team }));
const renderAllocation = async () => {
  const view = renderTab('allocation');
  await screen.findByText('4 of 4 people');
  return view;
};

describe('Allocation seat charts', () => {
  it('ranks vacant seats by count and leaves out a team with none', async () => {
    const user = userEvent.setup();
    fetchSeats.mockResolvedValue(
      seatsIn([
        ...['a', 'b', 'c'].map(() => ({ team: 'T-A' })),
        { team: 'T-B' },
        ...['a', 'b'].map(() => ({ team: 'T-C' })),
        { team: 'T-D', filled: true, allocatedHours: 160 },
      ])
    );
    await renderAllocation();
    await screen.findByText(/7 seats in/);

    const vacant = card(/^Vacant seats in/);
    await user.click(within(vacant).getByRole('button', { name: 'Show table' }));
    expect(cellsOf(within(vacant).getByRole('table'))).toEqual([['Name', 'Vacant seats'], ['T-A', '3'], ['T-C', '2'], ['T-B', '1']]);

    await user.selectOptions(within(vacant).getByLabelText('Show top'), '5');
    await user.selectOptions(within(vacant).getByLabelText('Rank'), 'Practices');
    expect(cellsOf(within(vacant).getByRole('table'))).toEqual([['Name', 'Vacant seats'], ['Finance', '6']]);
  });

  it('shows team tiles by allocation, and a click filters to that team and a second click clears it', async () => {
    const user = userEvent.setup();
    fetchSeats.mockResolvedValue(seatsIn([{ team: 'T-A', filled: true, allocatedHours: 160, utilizedHours: 80 }, { team: 'T-B', filled: true, allocatedHours: 80 }, { team: 'T-C' }]));
    await renderAllocation();
    await screen.findByText(/3 seats in/);

    const tiles = within(card(/^Team allocation in/));
    expect(tiles.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['T-A100%', 'T-B50%', 'T-C0%']);
    expect(tiles.getByText(/50% of 480 available hours are allocated/)).toBeInTheDocument();

    await user.click(tiles.getByRole('button', { name: /T-B/ }));
    expect(screen.getByText(/^1 seats in/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Team: T-B ×' })).toBeInTheDocument();
    expect(tiles.getByRole('button', { name: /T-B/ })).toHaveAttribute('aria-pressed', 'true');

    await user.click(tiles.getByRole('button', { name: /T-B/ }));
    expect(screen.getByText(/^3 seats in/)).toBeInTheDocument();

    await user.selectOptions(tiles.getByLabelText('Measure'), 'Vacant seats');
    expect(tiles.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['T-C1', 'T-A0', 'T-B0']);
  });

  it('keeps two teams that share a name apart', async () => {
    fetchSeats.mockResolvedValue(seatsIn([{ team: 'Support', code: 'TEAM-1', filled: true, allocatedHours: 160 }, { team: 'Support', code: 'TEAM-2' }]));
    await renderAllocation();
    await screen.findByText(/2 seats in/);

    const names = within(card(/^Team allocation in/)).getAllByRole('listitem').map((item) => item.textContent);
    expect(names).toEqual(['Support (TEAM-1)100%', 'Support (TEAM-2)0%']);
  });

  it('says Loading while seats load and that the data could not be loaded when they fail, never "nothing matches"', async () => {
    fetchSeats.mockReturnValue(new Promise(() => {}));
    const { unmount } = await renderAllocation();

    expect(within(card('Hours by month')).getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('Nothing to show for the current slicers.')).not.toBeInTheDocument();
    unmount();

    fetchSeats.mockRejectedValue(new Error('down'));
    await renderAllocation();
    expect(await within(card('Hours by month')).findByText('The data could not be loaded.')).toBeInTheDocument();
  });

  it('breaks a line where a group has no seats that month instead of drawing 0%', async () => {
    const user = userEvent.setup();
    const next = addMonths(month, 1);
    fetchSeats.mockResolvedValue([
      seat('T-A', { departmentName: 'Design', filled: true, allocatedHours: 160, utilizedHours: 160 }),
      seat('T-B', { departmentName: 'Audit', month: next, filled: true, allocatedHours: 80, utilizedHours: 40 }),
    ]);
    await renderAllocation();
    await screen.findByText(/1 seats in/);

    const trend = card('Allocation and utilization trend');
    await user.selectOptions(within(trend).getByLabelText('One line per'), 'Department');
    await user.click(within(trend).getByRole('button', { name: 'Show table' }));

    expect(cellsOf(within(trend).getByRole('table'))).toEqual([
      ['Month', 'Audit', 'Design'],
      [expect.any(String), '–', '100'],
      [expect.any(String), '50', '–'],
    ]);
  });

  it('shows the focus month the range allows when From moves past it', async () => {
    const user = userEvent.setup();
    await renderAllocation();
    await screen.findByText(/3 seats in/);

    await user.selectOptions(screen.getByLabelText('From month'), addMonths(month, 2));

    expect(screen.getByLabelText('Focus month')).toHaveValue(addMonths(month, 2));
    expect(screen.getByText(/^0 seats in/)).toBeInTheDocument();
  });

  it('keeps a pick made on the Workforce tab visible, and clearable, on the Allocation tab', async () => {
    const user = userEvent.setup();
    const { rerender } = renderTab('workforce');
    await screen.findByText('4 of 4 people');
    await user.selectOptions(screen.getByLabelText('GE batch'), 'GE22');
    await user.selectOptions(screen.getByLabelText('Region'), 'KTGlobal');

    rerender(<Analytics tab="allocation" refreshKey={0} />);

    expect(screen.getByRole('button', { name: 'GE batch: GE22 ×' })).toBeInTheDocument();
    expect(screen.getByText('1 of 4 people')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'GE batch: GE22 ×' }));
    expect(screen.queryByRole('button', { name: 'GE batch: GE22 ×' })).not.toBeInTheDocument();
  });
});

describe('Chart card controls', () => {
  it('flips between chart and table, and a table-only card has no toggle', async () => {
    const user = userEvent.setup();
    renderTab('workforce');
    await screen.findByText('4 of 4 people');

    const skills = within(card('Skill mix'));
    await user.click(skills.getByRole('button', { name: 'Show table' }));
    expect(skills.getByRole('button', { name: 'Show chart' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(skills.getByRole('button', { name: 'Show chart' }));
    expect(skills.queryByRole('table')).not.toBeInTheDocument();
    expect(skills.getByRole('button', { name: 'Show table' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('has no chart toggle on the people list', async () => {
    renderTab('allocation');
    await screen.findByText('4 of 4 people');

    expect(within(card('People to look at')).queryByRole('button', { name: /Show (table|chart)/ })).not.toBeInTheDocument();
  });
});
