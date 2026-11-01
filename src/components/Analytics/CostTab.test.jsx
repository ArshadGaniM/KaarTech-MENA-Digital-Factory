import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CostTab from './CostTab';
import { fetchCatalog, fetchSeats } from '../../lib/analyticsApi';
import { currentMonth, shiftMonth } from '../../lib/months';

vi.mock('../../lib/analyticsApi');

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

beforeEach(() => {
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
    expect(table.find((row) => row[0] === 'Analyst')).toEqual(['Analyst', '400', '0']);

    await user.selectOptions(within(card('Planned against actual cost')).getByLabelText('Location'), 'Onsite');
    expect(cellsOf(within(card('Planned against actual cost')).getByRole('table')).find((row) => row[0] === 'Consultant')).toEqual(['Consultant', '2000', '0']);
  });

  it('says so when no actual costs are recorded', async () => {
    fetchCatalog.mockResolvedValue(CATALOG.filter((row) => row.kind === 'plannedCost'));
    await renderTab();

    expect(screen.getByText('No actual costs are recorded yet, so every actual shows 0.')).toBeInTheDocument();
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
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[Number(month.slice(5)) - 1]} ${month.slice(2, 4)}`;
}
