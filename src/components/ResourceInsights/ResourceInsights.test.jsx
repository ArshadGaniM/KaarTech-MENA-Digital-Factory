import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResourceInsights from './ResourceInsights';
import { useGroupSummary } from '../../hooks/useGroupSummary';

vi.mock('../../hooks/useGroupSummary');

const done = (groups, total = groups.reduce((sum, group) => sum + group.count, 0)) => ({
  data: { groups, total },
  isLoading: false,
  error: null,
});

const designations = (count) =>
  Array.from({ length: count }, (_, i) => ({ value: `Role ${i + 1}`, count: 100 - i }));

// Answers like the backend: the location donut honours a designation
// filter, the designation bars honour a location filter.
function mockBackend({ designationGroups = designations(3) } = {}) {
  useGroupSummary.mockImplementation((_route, groupBy, filters) => {
    if (groupBy === 'locationType') {
      return filters.designation
        ? done([{ value: 'Offshore', count: 40 }, { value: 'Onsite', count: 10 }])
        : done([{ value: 'Offshore', count: 700 }, { value: 'Onsite', count: 200 }, { value: null, count: 5 }]);
    }
    return done(filters.locationType === 'Offshore' ? designationGroups.slice(0, 2) : designationGroups);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBackend();
});

const renderInsights = (props = {}) => render(<ResourceInsights refreshKey={0} onNavigate={() => {}} {...props} />);

describe('ResourceInsights', () => {
  it('shows the onsite and offshore split and the designations', () => {
    renderInsights();

    expect(screen.getByRole('button', { name: /Offshore 700/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Role 1/ })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('905 resources match');
  });

  it('lets a donut pick narrow the designation bars, and shows a chip to undo it', async () => {
    const user = userEvent.setup();
    renderInsights();

    await user.click(screen.getByRole('button', { name: /Offshore 700/ }));

    expect(useGroupSummary).toHaveBeenLastCalledWith('resources', 'designation', { locationType: 'Offshore' }, 0);
    expect(screen.getByRole('button', { name: 'Remove filter Offshore' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('700 resources match');
    expect(screen.queryByRole('button', { name: /Role 3/ })).not.toBeInTheDocument();
  });

  it('lets a designation pick narrow the donut', async () => {
    const user = userEvent.setup();
    renderInsights();

    await user.click(screen.getByRole('button', { name: /Role 2/ }));

    expect(useGroupSummary).toHaveBeenCalledWith('resources', 'locationType', { designation: 'Role 2' }, 0);
    expect(screen.getByRole('button', { name: /^Role 2/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('50 resources match');
  });

  it('counts only resources matching both filters', async () => {
    const user = userEvent.setup();
    renderInsights();

    await user.click(screen.getByRole('button', { name: /Role 2/ }));
    await user.click(screen.getByRole('button', { name: /Offshore 40/ }));

    expect(screen.getByRole('status')).toHaveTextContent('40 resources match');
  });

  it('picking the same slice again removes the filter', async () => {
    const user = userEvent.setup();
    renderInsights();

    await user.click(screen.getByRole('button', { name: /Offshore 700/ }));
    await user.click(screen.getByRole('button', { name: /Offshore 700/ }));

    expect(screen.queryByRole('button', { name: /Remove filter/ })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('905 resources match');
  });

  it('clears every filter at once', async () => {
    const user = userEvent.setup();
    renderInsights();
    await user.click(screen.getByRole('button', { name: /Offshore 700/ }));
    await user.click(screen.getByRole('button', { name: /Role 1/ }));

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.queryByRole('button', { name: /Remove filter/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('removes one filter from its chip and keeps the other', async () => {
    const user = userEvent.setup();
    renderInsights();
    await user.click(screen.getByRole('button', { name: /Offshore 700/ }));
    await user.click(screen.getByRole('button', { name: /Role 1/ }));

    await user.click(screen.getByRole('button', { name: 'Remove filter Offshore' }));

    expect(screen.queryByRole('button', { name: 'Remove filter Offshore' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove filter Role 1' })).toBeInTheDocument();
  });

  it('lists rows with no value as "Not set" and cannot filter on them', () => {
    renderInsights();

    expect(screen.getByRole('button', { name: /Not set/ })).toBeDisabled();
  });

  it('shows the top eight designations and sums the rest into one row', () => {
    mockBackend({ designationGroups: designations(10) });

    renderInsights();

    const bars = screen.getByRole('heading', { name: 'Top designations' }).parentElement;
    expect(within(bars).getAllByRole('button')).toHaveLength(8);
    expect(within(bars).getByText('Other designations')).toBeInTheDocument();
    expect(within(bars).getByText('183')).toBeInTheDocument();
  });

  it('says so when no resources match', async () => {
    useGroupSummary.mockImplementation((_route, groupBy) => done(groupBy === 'locationType' ? [{ value: 'Onsite', count: 1 }] : []));

    renderInsights();

    expect(screen.getByText('No resources match.')).toBeInTheDocument();
  });

  it('passes the refresh key to both charts', () => {
    renderInsights({ refreshKey: 3 });

    expect(useGroupSummary).toHaveBeenCalledWith('resources', 'locationType', expect.any(Object), 3);
    expect(useGroupSummary).toHaveBeenCalledWith('resources', 'designation', expect.any(Object), 3);
  });

  it('shows a loading state until both charts have data', () => {
    useGroupSummary.mockReturnValue({ data: null, isLoading: true, error: null });

    renderInsights();

    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('shows an alert for the chart that failed and still draws the other', () => {
    useGroupSummary.mockImplementation((_route, groupBy) =>
      groupBy === 'locationType'
        ? { data: null, isLoading: false, error: new Error('Backend unreachable') }
        : done(designations(2))
    );

    renderInsights();

    expect(screen.getByRole('alert')).toHaveTextContent('Backend unreachable');
    expect(screen.getByRole('button', { name: /Role 1/ })).toBeInTheDocument();
  });

  it('keeps a chart on screen when its refresh fails, with an error and a retry', async () => {
    const user = userEvent.setup();
    useGroupSummary.mockImplementation((_route, groupBy) =>
      groupBy === 'locationType'
        ? { ...done([{ value: 'Offshore', count: 700 }]), error: new Error('Backend unreachable') }
        : done(designations(2))
    );
    renderInsights();

    expect(screen.getByRole('alert')).toHaveTextContent('Backend unreachable');
    expect(screen.getByRole('button', { name: /Offshore 700/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(useGroupSummary).toHaveBeenLastCalledWith('resources', 'designation', expect.any(Object), 1);
    expect(useGroupSummary).toHaveBeenCalledWith('resources', 'locationType', expect.any(Object), 1);
  });

  it('offers Try again when a chart has no data at all', () => {
    useGroupSummary.mockImplementation((_route, groupBy) =>
      groupBy === 'designation'
        ? { data: null, isLoading: false, error: new Error('Backend unreachable') }
        : done([{ value: 'Offshore', count: 1 }])
    );

    renderInsights();

    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('Loading…', { selector: 'p' })).not.toBeInTheDocument();
  });

  it('does not show a match count it cannot trust when a chart failed', () => {
    useGroupSummary.mockImplementation((_route, groupBy) =>
      groupBy === 'locationType'
        ? { data: null, isLoading: false, error: new Error('Backend unreachable') }
        : done(designations(2))
    );

    renderInsights();

    expect(screen.getByRole('status')).toHaveTextContent('Match count unavailable');
    expect(screen.getByRole('status')).not.toHaveTextContent('Loading');
  });

  it('does not show the previous match count while new numbers load', () => {
    const stale = done([{ value: 'Offshore', count: 700 }, { value: 'Onsite', count: 200 }]);
    useGroupSummary.mockImplementation((_route, groupBy) =>
      groupBy === 'locationType' ? { ...stale, isLoading: true } : done(designations(2))
    );

    renderInsights();

    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(screen.getByRole('status')).not.toHaveTextContent('900');
  });

  it('counts rows beyond the 100-group cut-off under Other designations', () => {
    useGroupSummary.mockImplementation((_route, groupBy) =>
      groupBy === 'locationType'
        ? done([{ value: 'Offshore', count: 1500 }])
        : done(designations(10), 1500)
    );

    renderInsights();

    // 1,500 resources in total, 772 in the eight bars shown.
    expect(screen.getByText('Other designations').parentElement).toHaveTextContent('728');
  });

  it('opens the Resources table from its link', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderInsights({ onNavigate });

    await user.click(screen.getByRole('button', { name: 'Open Resources table' }));

    expect(onNavigate).toHaveBeenCalledWith('resources');
  });
});
