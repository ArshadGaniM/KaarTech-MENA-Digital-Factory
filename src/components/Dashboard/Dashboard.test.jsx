import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from './Dashboard';
import { useTableCounts } from '../../hooks/useTableCounts';
import { useGroupSummary } from '../../hooks/useGroupSummary';
import { useAllocationSummary } from '../../hooks/useAllocationSummary';

vi.mock('../../hooks/useTableCounts');
vi.mock('../../hooks/useGroupSummary');
vi.mock('../../hooks/useAllocationSummary');

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
  useGroupSummary.mockReturnValue({ data: { groups: [], total: 0 }, isLoading: false, error: null });
  useAllocationSummary.mockReturnValue({
    data: { buckets: ['full', 'partial', 'none', 'over'].map((key) => ({ key, count: 0 })), positions: [] },
    isLoading: false,
    error: null,
  });
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

  it('does not claim every table has records when some failed to load', () => {
    const data = counts({ practices: 5 }).map((table) =>
      table.route === 'teams' ? { ...table, count: null, error: new Error('boom') } : table
    );
    useTableCounts.mockReturnValue({ data, isLoading: false, error: null });

    render(<Dashboard onNavigate={() => {}} />);

    expect(screen.queryByText('Every table has at least one record.')).not.toBeInTheDocument();
    expect(screen.getByText('No empty tables among those that loaded.')).toBeInTheDocument();
  });

  it('shows one alert and no healthy-looking panels when every table failed', () => {
    const data = counts().map((table) => ({ ...table, count: null, error: new Error('boom') }));
    useTableCounts.mockReturnValue({ data, isLoading: false, error: null });

    render(<Dashboard onNavigate={() => {}} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load counts for any table');
    expect(screen.queryByRole('region', { name: 'Needs data' })).not.toBeInTheDocument();
    expect(screen.queryByText(/active records across/)).not.toBeInTheDocument();
  });

  it('leaves a failed table out of "Needs data"', () => {
    const data = counts().map((table) =>
      table.route === 'practices' ? { ...table, count: null, error: new Error('boom') } : table
    );
    useTableCounts.mockReturnValue({ data, isLoading: false, error: null });

    render(<Dashboard onNavigate={() => {}} />);

    expect(within(screen.getByRole('region', { name: 'Needs data' })).queryByRole('button', { name: 'Practices' })).not.toBeInTheDocument();
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

  it('refetches every count when Refresh is clicked', async () => {
    const user = userEvent.setup();
    useTableCounts.mockReturnValue({ data: counts(), isLoading: false, error: null });

    render(<Dashboard onNavigate={() => {}} />);
    expect(useTableCounts).toHaveBeenLastCalledWith(0);

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(useTableCounts).toHaveBeenLastCalledWith(1);
  });

  it('keeps the numbers on screen and disables Refresh while a refresh is in flight', () => {
    useTableCounts.mockReturnValue({ data: counts(), isLoading: true, error: null });

    render(<Dashboard onNavigate={() => {}} />);

    expect(screen.getByRole('button', { name: 'Refreshing…' })).toBeDisabled();
    expect(within(screen.getByRole('region', { name: 'Overview' })).getByRole('button', { name: /Resources/ })).toHaveTextContent('2,756');
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('shows when the numbers were last updated', () => {
    useTableCounts.mockReturnValue({ data: counts(), isLoading: false, error: null });

    render(<Dashboard onNavigate={() => {}} />);

    expect(screen.getByText(/^Updated \d{1,2}:\d{2}/)).toBeInTheDocument();
  });

  it('shows the Resources insights panel and passes the refresh key down', () => {
    useTableCounts.mockReturnValue({ data: counts(), isLoading: false, error: null });

    render(<Dashboard onNavigate={() => {}} />);

    expect(screen.getByRole('region', { name: 'Resources' })).toBeInTheDocument();
    expect(useGroupSummary).toHaveBeenCalledWith('resources', 'locationType', expect.any(Object), 0);
  });

  it('offers Try again when the first load fails, and refetches on click', async () => {
    const user = userEvent.setup();
    useTableCounts.mockReturnValue({ data: null, isLoading: false, error: new Error('Backend unreachable') });

    render(<Dashboard onNavigate={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Backend unreachable');

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(useTableCounts).toHaveBeenLastCalledWith(1);
  });

  it('offers Try again when every table failed', () => {
    const data = counts().map((table) => ({ ...table, count: null, error: new Error('boom') }));
    useTableCounts.mockReturnValue({ data, isLoading: false, error: null });

    render(<Dashboard onNavigate={() => {}} />);

    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('keeps the page, its filters and the Refresh button when a refresh fails', () => {
    useTableCounts.mockReturnValue({ data: counts(), isLoading: false, error: new Error('Backend unreachable') });

    render(<Dashboard onNavigate={() => {}} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not refresh: Backend unreachable');
    expect(screen.getByRole('region', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Resources' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled();
  });

  it('shows the Allocation panel under Resources and passes the refresh key to it', async () => {
    const user = userEvent.setup();
    useTableCounts.mockReturnValue({ data: counts(), isLoading: false, error: null });

    render(<Dashboard onNavigate={() => {}} />);

    expect(screen.getByRole('region', { name: 'Allocation' })).toBeInTheDocument();
    expect(useAllocationSummary).toHaveBeenLastCalledWith({ bucket: null, position: null }, 0);

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(useAllocationSummary).toHaveBeenLastCalledWith({ bucket: null, position: null }, 1);
  });
});
