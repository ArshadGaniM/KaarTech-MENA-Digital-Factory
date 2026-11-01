import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ForecastTab from './ForecastTab';
import { fetchDeployments, fetchSeats, fetchSnapshots } from '../../lib/analyticsApi';
import { currentMonth, shiftMonth } from '../../lib/months';

vi.mock('../../lib/analyticsApi');

const NOV = '2026-11';
const DEC = '2026-12';
const seat = (month, teamCode, over = {}) => ({
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
  ...over,
});
const SEATS = [
  seat(NOV, 'T1', { filled: true, allocatedHours: 160, utilizedHours: 80, onsiteCost: 1000 }),
  seat(NOV, 'T2'),
  seat(DEC, 'T1'),
  seat(DEC, 'T2'),
];
const deployment = (positionCode, end, over = {}) => ({ employeeId: 'E1', name: 'A', positionCode, positionName: 'Consultant', teamCode: 'T1', teamName: 'T1', departmentName: 'Design', allocationPercentage: 100, start: '2026-01-01', end, ...over });
const DEPLOYMENTS = [deployment('P1', '2026-11-30'), deployment('P9', '2026-11-20', { positionName: 'Module Lead' })];

const card = (name) => screen.getByRole('region', { name });
const cellsOf = (table) => within(table).getAllByRole('row').map((row) => Array.from(row.children, (cell) => cell.textContent));
const tableOf = async (user, name) => {
  await user.click(within(card(name)).getByRole('button', { name: 'Show table' }));
  return cellsOf(within(card(name)).getByRole('table'));
};
const renderTab = async () => {
  const user = userEvent.setup();
  render(<ForecastTab refreshKey={0} />);
  await screen.findByText(/Allocation is 50% this month/);
  return user;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 15, 12) });
  vi.clearAllMocks();
  fetchSeats.mockResolvedValue(SEATS);
  fetchDeployments.mockResolvedValue(DEPLOYMENTS);
  fetchSnapshots.mockResolvedValue([]);
});

afterEach(() => vi.useRealTimers());

describe('ForecastTab', () => {
  it('asks for the seats of the next twelve months and summarises booked allocation', async () => {
    await renderTab();

    expect(fetchSeats).toHaveBeenCalledWith(currentMonth(), shiftMonth(currentMonth(), 12));
    expect(screen.getByText(/0% in Dec 26/)).toBeInTheDocument();
  });

  it('lists vacant hours for the bench', async () => {
    const user = await renderTab();

    expect(await tableOf(user, 'Available hours and bench')).toEqual([
      ['Month', 'Available hours', 'Allocated hours', 'Vacant hours'],
      ['Nov 26', '320', '160', '160'],
      ['Dec 26', '320', '0', '320'],
    ]);
  });

  it('counts a seat deployment ending in 15 days under 30 days and ignores other positions', async () => {
    const user = await renderTab();

    expect(await tableOf(user, 'Deployments ending soon')).toEqual([
      ['Window', 'Design'],
      ['Within 30 days', '1'],
      ['Within 60 days', '0'],
      ['Within 90 days', '0'],
      ['Within 180 days', '0'],
    ]);
  });

  it('shows what a three month extension adds to December', async () => {
    const user = await renderTab();
    await user.click(within(card('What if deployments were extended')).getByRole('button', { name: 'Show table' }));

    expect(cellsOf(within(card('Booked against extended')).getByRole('table')).slice(0, 3)).toEqual([
      ['Month', 'Booked %', 'With extension %', 'Extra hours'],
      ['Nov 26', '50', '50', '0'],
      ['Dec 26', '0', '50', '160'],
    ]);
  });

  it('changes nothing when the extension is set to none', async () => {
    const user = await renderTab();
    await user.selectOptions(screen.getByLabelText('Extend by'), '0');

    expect(cellsOf(within(card('Booked against extended')).getByRole('table'))[2]).toEqual(['Dec 26', '0', '0', '0']);
  });

  it('groups deployments ending soon by seat type', async () => {
    const user = await renderTab();
    await user.selectOptions(screen.getByLabelText('Group by'), 'positionName');

    expect((await tableOf(user, 'Deployments ending soon'))[0]).toEqual(['Window', 'Consultant']);
  });

  it('plots saved months next to booked months', async () => {
    fetchSnapshots.mockResolvedValue([
      { month: '2026-10', availableHours: 320, allocatedHours: 160 },
      { month: '2026-10', availableHours: 160, allocatedHours: 160 },
    ]);
    const user = await renderTab();

    expect(await tableOf(user, 'Saved months and booked months')).toEqual([
      ['Month', 'Saved allocation %', 'Booked allocation %'],
      ['Oct 26', '66.7', '–'],
      ['Nov 26', '–', '50'],
      ['Dec 26', '–', '0'],
    ]);
  });

  it('shows an error with Try again when deployments cannot load', async () => {
    fetchDeployments.mockRejectedValueOnce(new Error('down'));
    render(<ForecastTab refreshKey={0} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the forecast: down');
  });

  it('still shows the forecast when only the saved months fail to load', async () => {
    fetchSnapshots.mockRejectedValue(new Error('no snapshots'));
    await renderTab();

    expect(card('Saved months and booked months')).toBeInTheDocument();
  });
});
