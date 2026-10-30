import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from './Dashboard';
import { useTableCounts } from '../../hooks/useTableCounts';

vi.mock('../../hooks/useTableCounts');

const counts = (overrides = {}) => {
  const base = {
    resources: 2756,
    projects: 12,
    teams: 8,
    'delivery-centers': 3,
    practices: 0,
    positions: 40,
    ...overrides,
  };
  return Object.entries(base).map(([route, count]) => ({
    route,
    label: route.replace(/(^|-)(\w)/g, (_, sep, c) => (sep ? ' ' : '') + c.toUpperCase()),
    count,
    error: null,
  }));
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Dashboard', () => {
  it('shows a polite status region while loading', () => {
    useTableCounts.mockReturnValue({ data: null, isLoading: true, error: null });

    render(<Dashboard onNavigate={() => {}} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('shows an alert when the counts cannot be loaded at all', () => {
    useTableCounts.mockReturnValue({ data: null, isLoading: false, error: new Error('Backend unreachable') });

    render(<Dashboard onNavigate={() => {}} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Backend unreachable');
  });

  it('renders the featured tiles with formatted counts', () => {
    useTableCounts.mockReturnValue({ data: counts(), isLoading: false, error: null });

    render(<Dashboard onNavigate={() => {}} />);

    const overview = screen.getByRole('region', { name: 'Overview' });
    expect(within(overview).getByRole('button', { name: /Resources/ })).toHaveTextContent('2,756');
    expect(within(overview).getByRole('button', { name: /Projects/ })).toHaveTextContent('12');
  });

  it('ranks the records-by-table bars from largest to smallest', () => {
    useTableCounts.mockReturnValue({ data: counts(), isLoading: false, error: null });

    render(<Dashboard onNavigate={() => {}} />);

    const panel = screen.getByRole('region', { name: 'Records by table' });
    const labels = within(panel).getAllByRole('button').map((button) => button.textContent);
    expect(labels[0]).toMatch(/Resources/);
    expect(labels[labels.length - 1]).toMatch(/Practices/);
    expect(panel).toHaveTextContent('2,819 active records across 6 tables');
  });

  it('lists empty tables under "Needs data"', () => {
    useTableCounts.mockReturnValue({ data: counts(), isLoading: false, error: null });

    render(<Dashboard onNavigate={() => {}} />);

    const panel = screen.getByRole('region', { name: 'Needs data' });
    expect(within(panel).getByRole('button', { name: 'Practices' })).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Resources' })).not.toBeInTheDocument();
  });

  it('says so when no table is empty', () => {
    useTableCounts.mockReturnValue({ data: counts({ practices: 5 }), isLoading: false, error: null });

    render(<Dashboard onNavigate={() => {}} />);

    expect(screen.getByText('Every table has at least one record.')).toBeInTheDocument();
  });

  it('navigates to a table when its tile, bar, or empty-state link is clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    useTableCounts.mockReturnValue({ data: counts(), isLoading: false, error: null });

    render(<Dashboard onNavigate={onNavigate} />);

    await user.click(within(screen.getByRole('region', { name: 'Overview' })).getByRole('button', { name: /Teams/ }));
    await user.click(within(screen.getByRole('region', { name: 'Records by table' })).getByRole('button', { name: /Positions/ }));
    await user.click(within(screen.getByRole('region', { name: 'Needs data' })).getByRole('button', { name: 'Practices' }));

    expect(onNavigate.mock.calls.map(([route]) => route)).toEqual(['teams', 'positions', 'practices']);
  });

  it('keeps working when one table fails: shows a dash, names it in an alert, and leaves it out of the totals', () => {
    const data = counts().map((table) =>
      table.route === 'teams' ? { ...table, count: null, error: new Error('boom') } : table
    );
    useTableCounts.mockReturnValue({ data, isLoading: false, error: null });

    render(<Dashboard onNavigate={() => {}} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load counts for: Teams.');
    expect(within(screen.getByRole('region', { name: 'Overview' })).getByRole('button', { name: /Teams/ })).toHaveTextContent('—');
    expect(screen.getByRole('region', { name: 'Records by table' })).toHaveTextContent('across 5 tables');
  });
});
