import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlanTab from './PlanTab';
import { fetchPlanActuals } from '../../lib/initiativePlanApi';

vi.mock('../../lib/initiativePlanApi');

const card = (name) => screen.getByRole('region', { name });
const cellsOf = (table) => within(table).getAllByRole('row').map((row) => Array.from(row.children, (cell) => cell.textContent));
const tableOf = async (user, name) => {
  await user.click(within(card(name)).getByRole('button', { name: 'Show table' }));
  return cellsOf(within(card(name)).getByRole('table'));
};
const renderTab = async () => {
  const user = userEvent.setup();
  render(<PlanTab refreshKey={0} />);
  await screen.findByRole('region', { name: 'Activities by status' });
  return user;
};

beforeEach(() => {
  vi.clearAllMocks();
  // Week 1 begins on 1 July 2026, so 15 November 2026 is week 20.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 15, 12) });
  fetchPlanActuals.mockResolvedValue({});
});

afterEach(() => vi.useRealTimers());

describe('PlanTab', () => {
  it('shows an error with Try again when the progress cannot load', async () => {
    fetchPlanActuals.mockRejectedValueOnce(new Error('down'));
    render(<PlanTab refreshKey={0} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the plan progress: down');
  });

  it('counts the activities in each status for one group', async () => {
    const user = await renderTab();
    await user.selectOptions(within(card('Activities by status')).getByLabelText('Group'), '1.0');

    expect(await tableOf(user, 'Activities by status')).toEqual([['Status', 'Activities'], ['Completed', '4'], ['In Progress', '1'], ['Yet to Start', '4']]);
  });

  it('lists the activities behind plan in the current week, with the weeks they are late', async () => {
    await renderTab();

    const table = cellsOf(within(card('Activities behind plan')).getByRole('table'));
    expect(table[0]).toEqual(['Activity', 'Planned end week', 'Status', 'Complete %', 'Weeks late']);
    const secondA = table.find((row) => row[0].startsWith('2a '));
    expect(secondA.slice(1)).toEqual(['17', 'In Progress', '0', '3']);
    expect(table.find((row) => row[0].startsWith('1f '))[4]).toBe('0');
    expect(table.find((row) => row[0].startsWith('1a '))).toBeUndefined();
  });

  it('leaves out an activity once its recorded progress reaches 100', async () => {
    fetchPlanActuals.mockResolvedValue({ '2a': { activityKey: '2a', actualStartWeek: 14, actualEndWeek: 17, actualPoc: 100 } });
    await renderTab();

    const table = cellsOf(within(card('Activities behind plan')).getByRole('table'));
    expect(table.find((row) => row[0].startsWith('2a '))).toBeUndefined();
  });

  it('shows the sheet figure and the recorded figure for each group', async () => {
    fetchPlanActuals.mockResolvedValue({ '1.0': { activityKey: '1.0', actualStartWeek: 1, actualEndWeek: 20, actualPoc: 55 } });
    const user = await renderTab();

    const table = await tableOf(user, 'Percent complete by group');
    expect(table[1].slice(1)).toEqual(['18', '55']);
    expect(table[2].slice(1)).toEqual(['0', '–']);
  });

  it('shows weeks planned against weeks taken, and 0 for an activity with no recorded dates', async () => {
    fetchPlanActuals.mockResolvedValue({ '1e': { activityKey: '1e', actualStartWeek: 9, actualEndWeek: 14, actualPoc: 50 } });
    const user = await renderTab();
    await user.selectOptions(within(card('Weeks planned against weeks taken')).getByLabelText('Group'), '1.0');

    const table = await tableOf(user, 'Weeks planned against weeks taken');
    expect(table.find((row) => row[0].startsWith('1e '))).toEqual([expect.stringContaining('Adopt the existing projects'), '13', '6']);
    expect(table.find((row) => row[0].startsWith('1a '))[2]).toBe('0');
  });

  it('plots planned progress for all 65 weeks and the recorded progress only for the current week', async () => {
    const user = await renderTab();

    const table = await tableOf(user, 'Plan progress by week');
    expect(table).toHaveLength(66);
    expect(table[1]).toEqual(['W1', expect.any(String), '–']);
    expect(table[20][2]).not.toBe('–');
    expect(table[21][2]).toBe('–');
    expect(Number(table[65][1])).toBeGreaterThan(Number(table[1][1]));
  });

  it('says the plan has not started and shows no recorded point before week 1', async () => {
    vi.setSystemTime(new Date(2026, 5, 30, 12));
    const user = await renderTab();

    expect(screen.getAllByText('The plan has not started yet.')).toHaveLength(2);
    expect(within(card('Activities behind plan')).getByText('Nothing to show for the current slicers.')).toBeInTheDocument();
    expect((await tableOf(user, 'Plan progress by week')).slice(1).every((row) => row[2] === '–')).toBe(true);
  });

  it('starts counting on 1 July, and moves to week 2 after seven days', async () => {
    vi.setSystemTime(new Date(2026, 6, 7, 12));
    const user = await renderTab();
    expect(screen.getByText(/This is week 1\./)).toBeInTheDocument();
    expect((await tableOf(user, 'Plan progress by week'))[1][2]).not.toBe('–');
  });

  it('flips to week 2 on 8 July', async () => {
    vi.setSystemTime(new Date(2026, 6, 8, 12));
    await renderTab();

    expect(screen.getByText(/This is week 2\./)).toBeInTheDocument();
  });

  it('says the plan has ended and shows no recorded point after week 65', async () => {
    vi.setSystemTime(new Date(2027, 8, 30, 12));
    const user = await renderTab();

    expect(screen.getByText(/The plan ended in week 65\. This is week 66/)).toBeInTheDocument();
    expect((await tableOf(user, 'Plan progress by week')).slice(1).every((row) => row[2] === '–')).toBe(true);
  });

  it('reaches 100 percent planned progress in the last week and starts low', async () => {
    const user = await renderTab();

    const table = await tableOf(user, 'Plan progress by week');
    expect(table[65][1]).toBe('100');
    expect(Number(table[1][1])).toBeLessThan(20);
  });

  it('shows 0 weeks taken when only the start week is recorded', async () => {
    fetchPlanActuals.mockResolvedValue({ '1e': { activityKey: '1e', actualStartWeek: 9, actualEndWeek: null, actualPoc: 10 } });
    const user = await renderTab();
    await user.selectOptions(within(card('Weeks planned against weeks taken')).getByLabelText('Group'), '1.0');

    expect((await tableOf(user, 'Weeks planned against weeks taken')).find((row) => row[0].startsWith('1e '))[2]).toBe('0');
  });
});

