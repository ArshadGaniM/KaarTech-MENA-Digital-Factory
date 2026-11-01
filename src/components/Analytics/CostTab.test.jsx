import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CostTab from './CostTab';
import { fetchCatalog, fetchSeats } from '../../lib/analyticsApi';
import { currentMonth, shiftMonth } from '../../lib/months';

vi.mock('../../lib/analyticsApi');

// A fixed date keeps the focus month, and so every label below, stable.
vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 15, 12) });
const month = currentMonth();
const seat = (teamCode, over = {}) => ({
  month,
  departmentName: 'Design',
  teamCode,
  teamName: teamCode,
  practiceName: 'Finance',
  positionName: 'Consultant',
  filled: false,
  availableHours: 160,
  allocatedHours: 0,
  utilizedHours: 0,
  onsiteCost: 0,
  offshoreCost: 0,
  actualPeople: 0,
  plannedPeople: 0,
  defaultPeople: 0,
  missingPeople: 0,
  ...over,
});
const SEATS = [
  seat('T1', { filled: true, allocatedHours: 160, onsiteCost: 1000, offshoreCost: 500, actualPeople: 1 }),
  seat('T2', { departmentName: 'Audit', filled: true, allocatedHours: 80, offshoreCost: 300, plannedPeople: 1 }),
  seat('T3'),
];
const CATALOG = [
  { kind: 'plannedCost', name: 'Consultant', grade: 'K9', offshoreCost: 800, onsiteCost: 2000 },
  { kind: 'plannedCost', name: 'Analyst', grade: 'K2', offshoreCost: 400, onsiteCost: 900 },
  { kind: 'plannedCost', name: 'Manager', grade: 'K10', offshoreCost: 1500, onsiteCost: 3000 },
  { kind: 'actualCost', name: 'Consultant', offshoreCost: 1000, onsiteCost: null },
  { kind: 'actualCost', name: 'Consultant', offshoreCost: 1200, onsiteCost: null },
];

const card = (name) => screen.getByRole('region', { name });
const cellsOf = (table) => within(table).getAllByRole('row').map((row) => Array.from(row.children, (cell) => cell.textContent));
const tableOf = async (user, name) => {
  await user.click(within(card(name)).getByRole('button', { name: 'Show table' }));
  return cellsOf(within(card(name)).getByRole('table'));
};
const renderTab = async () => {
  const user = userEvent.setup();
  render(<CostTab refreshKey={0} />);
  await screen.findByText(/USD 1,800 in/);
  return user;
};

afterEach(() => vi.useRealTimers());

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 15, 12) });
  vi.clearAllMocks();
  fetchSeats.mockResolvedValue(SEATS);
  fetchCatalog.mockResolvedValue(CATALOG);
});

describe('CostTab', () => {
  it('asks for the seats of the default range and shows the focus month total in the slicer bar', async () => {
    await renderTab();

    expect(fetchSeats).toHaveBeenCalledWith(shiftMonth(month, -2), shiftMonth(month, 6));
    expect(screen.getByText(/across 3 seats \(66.7% filled\)/)).toBeInTheDocument();
  });

  it('shows an error with Try again when the seats cannot load', async () => {
    fetchSeats.mockRejectedValueOnce(new Error('down'));
    render(<CostTab refreshKey={0} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the costs: down');
  });

  it('ranks teams by cost and leaves out a team that costs nothing', async () => {
    const user = await renderTab();

    expect((await tableOf(user, `Cost by team in ${shortMonth()}`))).toEqual([['Team', 'USD'], ['T1', '1500'], ['T2', '300']]);
  });

  it('splits the month between onsite and offshore', async () => {
    const user = await renderTab();

    expect(await tableOf(user, 'Onsite and offshore cost')).toEqual([['Location', 'USD'], ['Onsite', '1000'], ['Offshore', '800']]);
  });

  it('counts where the cost figures come from', async () => {
    const user = await renderTab();

    expect(await tableOf(user, `Where the cost figures come from in ${shortMonth()}`)).toEqual([['Source', 'People'], ['Actual cost', '1'], ['Planned cost', '1']]);
  });

  it('sets planned against the average actual cost, offshore or onsite', async () => {
    const user = await renderTab();

    const table = await tableOf(user, 'Planned against actual cost');
    expect(table.find((row) => row[0] === 'Consultant')).toEqual(['Consultant', '800', '1100']);
    expect(table.find((row) => row[0] === 'Analyst')).toEqual(['Analyst', '400', '–']);

    await user.selectOptions(within(card('Planned against actual cost')).getByLabelText('Location'), 'Onsite');
    expect(cellsOf(within(card('Planned against actual cost')).getByRole('table')).find((row) => row[0] === 'Consultant')).toEqual(['Consultant', '2000', '–']);
  });

  it('says so when no actual costs are recorded', async () => {
    fetchCatalog.mockResolvedValue(CATALOG.filter((row) => row.kind === 'plannedCost'));
    await renderTab();

    expect(screen.getByText('No actual costs are recorded yet, so every actual shows a dash.')).toBeInTheDocument();
  });

  it('orders planned cost by grade as a number and can show one location', async () => {
    const user = await renderTab();

    expect(await tableOf(user, 'Planned cost by grade')).toEqual([['Grade', 'Offshore', 'Onsite'], ['K2 Analyst', '400', '900'], ['K9 Consultant', '800', '2000'], ['K10 Manager', '1500', '3000']]);

    await user.selectOptions(within(card('Planned cost by grade')).getByLabelText('Location'), 'Onsite');
    expect(cellsOf(within(card('Planned cost by grade')).getByRole('table'))[0]).toEqual(['Grade', 'Onsite']);
  });

  it('works out the cost of each allocated hour, and leaves a month with no hours blank', async () => {
    const user = await renderTab();

    const table = await tableOf(user, 'Cost for each allocated hour');
    expect(table.find((row) => row[0] === shortMonth())).toEqual([shortMonth(), '7.5']);
    expect(table[table.length - 1][1]).toBe('–');
  });

  it('stacks the monthly cost by department for the focus month', async () => {
    const user = await renderTab();

    const table = await tableOf(user, 'Monthly allocated cost');
    expect(table[0]).toEqual(['Month', 'Design', 'Audit']);
    expect(table.find((row) => row[0] === shortMonth())).toEqual([shortMonth(), '1500', '300']);

    await user.selectOptions(within(card('Monthly allocated cost')).getByLabelText('Cost'), 'Onsite');
    expect(cellsOf(within(card('Monthly allocated cost')).getByRole('table')).find((row) => row[0] === shortMonth())).toEqual([shortMonth(), '1000', '0']);
  });

  it('narrows every chart to one department', async () => {
    const user = await renderTab();

    await user.selectOptions(screen.getByLabelText('Department'), 'Audit');

    expect(screen.getByText(/USD 300 in/)).toBeInTheDocument();
    expect(await tableOf(user, 'Onsite and offshore cost')).toEqual([['Location', 'USD'], ['Offshore', '300']]);
  });
});

function shortMonth() {
  return 'Nov 26';
}

describe('CostTab detail', () => {
  it('matches an actual cost to its designation whatever the case or spaces', async () => {
    fetchCatalog.mockResolvedValue([{ kind: 'plannedCost', name: 'Senior Consultant', grade: 'K12', offshoreCost: 900, onsiteCost: 2500 }, { kind: 'actualCost', name: ' senior consultant ', offshoreCost: 1200, onsiteCost: null }]);
    const user = userEvent.setup();
    render(<CostTab refreshKey={0} />);
    await screen.findByText(/USD 1,800 in/);

    expect((await tableOf(user, 'Planned against actual cost')).find((row) => row[0] === 'Senior Consultant')).toEqual(['Senior Consultant', '900', '1200']);
  });

  it('counts a seat with no cost fields as 0 instead of showing NaN', async () => {
    const bare = { ...seat('T1', { filled: true }) };
    delete bare.onsiteCost;
    delete bare.offshoreCost;
    fetchSeats.mockResolvedValue([bare]);
    render(<CostTab refreshKey={0} />);

    expect(await screen.findByText(/USD 0 in/)).toBeInTheDocument();
  });

  const seatsIn = (rows) => rows.map((row) => seat(row.team, { filled: true, allocatedHours: 160, ...row }));

  it('shows a team with people but no cost as 0 instead of dropping it', async () => {
    fetchSeats.mockResolvedValue(seatsIn([{ team: 'T1', onsiteCost: 500 }, { team: 'T2', missingPeople: 1 }]));
    const user = userEvent.setup();
    render(<CostTab refreshKey={0} />);
    await screen.findByText(/USD 500 in/);

    expect(await tableOf(user, 'Cost by team in Nov 26')).toEqual([['Team', 'USD'], ['T1', '500'], ['T2', '0']]);
  });

  it('warns how many people are costed by default or have no cost', async () => {
    fetchSeats.mockResolvedValue(seatsIn([{ team: 'T1', onsiteCost: 500, defaultPeople: 2, missingPeople: 1 }]));
    render(<CostTab refreshKey={0} />);

    expect(await screen.findByText(/3 people are costed by default or have no cost/)).toBeInTheDocument();
  });

  it('names the default and no cost sources', async () => {
    fetchSeats.mockResolvedValue(seatsIn([{ team: 'T1', onsiteCost: 500, defaultPeople: 2, missingPeople: 1 }]));
    const user = userEvent.setup();
    render(<CostTab refreshKey={0} />);
    await screen.findByText(/USD 500 in/);

    expect(await tableOf(user, 'Where the cost figures come from in Nov 26')).toEqual([['Source', 'People'], ['Default (Senior Consultant)', '2'], ['No cost found', '1']]);
  });

  it('stacks only the six departments that cost the most, biggest first, and leaves the rest out', async () => {
    fetchSeats.mockResolvedValue(seatsIn([1, 2, 3, 4, 5, 6, 7].map((n) => ({ team: `T${n}`, departmentName: `D${n}`, onsiteCost: (8 - n) * 100 }))));
    const user = userEvent.setup();
    render(<CostTab refreshKey={0} />);
    await screen.findByText(/USD 2,800 in/);

    const table = await tableOf(user, 'Monthly allocated cost');
    expect(table[0]).toEqual(['Month', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6']);
    expect(table.find((row) => row[0] === 'Nov 26')).toEqual(['Nov 26', '700', '600', '500', '400', '300', '200']);
  });

  it('takes the team table from the focus month chosen in the slicer', async () => {
    const next = shiftMonth(month, 1);
    fetchSeats.mockResolvedValue([...seatsIn([{ team: 'T1', onsiteCost: 500 }]), ...seatsIn([{ team: 'T9', month: next, onsiteCost: 900 }])]);
    const user = userEvent.setup();
    render(<CostTab refreshKey={0} />);
    await screen.findByText(/USD 500 in/);

    await user.selectOptions(screen.getByLabelText('Focus month'), next);

    expect(await tableOf(user, 'Cost by team in Dec 26')).toEqual([['Team', 'USD'], ['T9', '900']]);
  });

  it('works out the cost of an hour per department as a ratio of sums', async () => {
    fetchSeats.mockResolvedValue(seatsIn([{ team: 'T1', departmentName: 'Design', onsiteCost: 1500, allocatedHours: 160 }, { team: 'T2', departmentName: 'Audit', offshoreCost: 300, allocatedHours: 80 }]));
    const user = userEvent.setup();
    render(<CostTab refreshKey={0} />);
    await screen.findByText(/USD 1,800 in/);

    await user.selectOptions(within(card('Cost for each allocated hour')).getByLabelText('One line per'), 'Department');
    await user.click(within(card('Cost for each allocated hour')).getByRole('button', { name: 'Show table' }));

    const table = cellsOf(within(card('Cost for each allocated hour')).getByRole('table'));
    expect(table[0]).toEqual(['Month', 'Design', 'Audit']);
    expect(table.find((row) => row[0] === 'Nov 26')).toEqual(['Nov 26', '9.38', '3.75']);
  });
});
