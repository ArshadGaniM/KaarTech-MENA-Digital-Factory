import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HealthTab from './HealthTab';
import { fetchHealth } from '../../lib/analyticsApi';

vi.mock('../../lib/analyticsApi');

const ROWS = [
  { kind: 'count', table: 'resources', live: 2739, deleted: 1 },
  { kind: 'count', table: 'practices', live: 10, deleted: 3 },
  { kind: 'count', table: 'teams', live: 91, deleted: 0 },
  { kind: 'week', table: 'resources', week: '2026-10-19', added: 1651 },
  { kind: 'week', table: 'teams', week: '2026-10-19', added: 91 },
  { kind: 'week', table: 'resources', week: '2026-09-14', added: 1088 },
  { kind: 'blank', table: 'resources', field: 'region', live: 2739, blank: 1 },
  { kind: 'blank', table: 'resources', field: 'org_chart', live: 2739, blank: 2739 },
  { kind: 'blank', table: 'resources', field: 'designation', live: 2739, blank: 0 },
];

const card = (name) => screen.getByRole('region', { name });
const cellsOf = (table) => within(table).getAllByRole('row').map((row) => Array.from(row.children, (cell) => cell.textContent));
const tableOf = async (user, name) => {
  await user.click(within(card(name)).getByRole('button', { name: 'Show table' }));
  return cellsOf(within(card(name)).getByRole('table'));
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchHealth.mockResolvedValue(ROWS);
});

describe('HealthTab', () => {
  it('shows an error with Try again when the data cannot load', async () => {
    fetchHealth.mockRejectedValueOnce(new Error('down'));
    const user = userEvent.setup();
    render(<HealthTab refreshKey={0} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the data health: down');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: 'Live and deleted rows per table' })).toBeInTheDocument();
  });

  it('lists live and deleted rows per table, most live rows first, and can order by deleted rows', async () => {
    const user = userEvent.setup();
    render(<HealthTab refreshKey={0} />);
    await screen.findByRole('region', { name: 'Live and deleted rows per table' });

    expect(await tableOf(user, 'Live and deleted rows per table')).toEqual([['Table', 'Live', 'Deleted'], ['resources', '2739', '1'], ['teams', '91', '0'], ['practices', '10', '3']]);

    await user.selectOptions(within(card('Live and deleted rows per table')).getByLabelText('Order by'), 'Deleted rows');
    expect(cellsOf(within(card('Live and deleted rows per table')).getByRole('table'))[1]).toEqual(['practices', '10', '3']);
  });

  it('adds up the rows created each week across tables, or for one table', async () => {
    const user = userEvent.setup();
    render(<HealthTab refreshKey={0} />);
    await screen.findByRole('region', { name: 'Rows added each week' });

    expect(await tableOf(user, 'Rows added each week')).toEqual([['Week starting', 'Rows added'], ['2026-09-14', '1088'], ['2026-10-19', '1742']]);

    await user.selectOptions(within(card('Rows added each week')).getByLabelText('Table'), 'teams');
    expect(cellsOf(within(card('Rows added each week')).getByRole('table')).slice(1)).toEqual([['2026-10-19', '91']]);
  });

  it('shows how completely resources are filled in, least filled first', async () => {
    const user = userEvent.setup();
    render(<HealthTab refreshKey={0} />);
    await screen.findByRole('region', { name: 'How completely resources are filled in' });

    expect(await tableOf(user, 'How completely resources are filled in')).toEqual([['Field', 'Filled %'], ['org_chart', '0'], ['designation', '100'], ['region', '100']]);

    await user.selectOptions(within(card('How completely resources are filled in')).getByLabelText('Show'), 'Most filled first');
    expect(cellsOf(within(card('How completely resources are filled in')).getByRole('table'))[3]).toEqual(['org_chart', '0']);
  });
});
