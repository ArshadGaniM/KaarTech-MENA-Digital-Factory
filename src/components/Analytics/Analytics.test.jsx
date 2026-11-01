import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Analytics from './Analytics';
import { fetchPeople, fetchSeats } from '../../lib/analyticsApi';
import { addMonths, currentMonth } from '../../lib/analyticsData';

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
    expect(within(totals).getByText('Headcount').parentElement).toHaveTextContent('4');
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

  it('clicking a heatmap cell sets both slicers', async () => {
    const user = userEvent.setup();
    renderTab('workforce');
    await screen.findByText('4 of 4 people');

    await user.click(within(card('Two-way headcount grid')).getAllByRole('button', { name: '1' })[0]);

    expect(screen.getByLabelText('Employment type')).toHaveValue('Full Time');
    expect(screen.getByLabelText('Region')).not.toHaveValue('');
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

    expect(fetchSeats).toHaveBeenCalledWith(addMonths(month, -2), addMonths(month, 6));
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
    expect(screen.getByText(/1 seats in/)).toBeInTheDocument();
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
