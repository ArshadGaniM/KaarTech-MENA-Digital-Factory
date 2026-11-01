import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AllocationInsights from './AllocationInsights';
import { useAllocationSummary } from '../../hooks/useAllocationSummary';

vi.mock('../../hooks/useAllocationSummary');

const buckets = (counts = {}) =>
  ['full', 'partial', 'none', 'over'].map((key) => ({ key, count: counts[key] ?? 0 }));
const done = (data) => ({ data, isLoading: false, error: null });

// Answers like the backend: buckets honour a position filter, positions honour a bucket filter.
function mockBackend() {
  useAllocationSummary.mockImplementation((filters) =>
    done({
      buckets: filters.position ? buckets({ full: 27 }) : buckets({ full: 98, partial: 5, none: 2653 }),
      positions: filters.bucket === 'none' ? [] : [{ value: 'Consultant', count: 71 }, { value: 'Lead Consultant', count: 27 }],
    })
  );
}

const renderPanel = (props = {}) => render(<AllocationInsights refreshKey={0} onNavigate={() => {}} {...props} />);

beforeEach(() => {
  vi.clearAllMocks();
  mockBackend();
});

describe('AllocationInsights', () => {
  it('shows how fully people are deployed, with counts and shares', () => {
    renderPanel();

    expect(screen.getByRole('button', { name: /Fully allocated 98 \(4%\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Partly allocated 5 \(0%\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Not deployed 2,653 \(96%\)/ })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('2,756 resources match');
  });

  it('hides Over-allocated while it is zero, since the allocation rule should make it impossible', () => {
    renderPanel();

    expect(screen.queryByRole('button', { name: /Over-allocated/ })).not.toBeInTheDocument();
  });

  it('shows Over-allocated when some resource breaks the rule', () => {
    useAllocationSummary.mockReturnValue(done({ buckets: buckets({ full: 1, over: 2 }), positions: [] }));

    renderPanel();

    expect(screen.getByRole('button', { name: /Over-allocated 2/ })).toBeInTheDocument();
  });

  it('lists the positions people are deployed to', () => {
    renderPanel();

    expect(screen.getByRole('button', { name: /Consultant 71/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lead Consultant 27/ })).toBeInTheDocument();
  });

  it('narrows the positions to an allocation pick, and counts that allocation', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /Fully allocated/ }));

    expect(useAllocationSummary).toHaveBeenLastCalledWith({ bucket: 'full', position: null }, 0);
    expect(screen.getByRole('button', { name: 'Remove filter Fully allocated' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('98 resources match');
  });

  it('narrows the buckets to a position pick', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /Lead Consultant/ }));

    expect(useAllocationSummary).toHaveBeenLastCalledWith({ bucket: null, position: 'Lead Consultant' }, 0);
    expect(screen.getByRole('button', { name: /^Lead Consultant/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('27 resources match');
  });

  it('counts only resources matching both picks', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /Lead Consultant/ }));
    await user.click(screen.getByRole('button', { name: /Fully allocated/ }));

    expect(screen.getByRole('status')).toHaveTextContent('27 resources match');
  });

  it('removes a pick again by picking it a second time, and clears everything at once', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /^Fully allocated/ }));
    await user.click(screen.getByRole('button', { name: /^Fully allocated/ }));
    expect(screen.queryByRole('button', { name: /Remove filter/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Fully allocated/ }));
    await user.click(screen.getByRole('button', { name: /^Lead Consultant/ }));
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(useAllocationSummary).toHaveBeenLastCalledWith({ bucket: null, position: null }, 0);
  });

  it('says why there are no positions for people who are not deployed', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /Not deployed/ }));

    expect(screen.getByText('People who are not deployed have no position.')).toBeInTheDocument();
  });

  it('says so when no deployments match', () => {
    useAllocationSummary.mockReturnValue(done({ buckets: buckets({ full: 1 }), positions: [] }));

    renderPanel();

    expect(screen.getByText('No deployments match.')).toBeInTheDocument();
  });

  it('cannot pick an allocation that nobody is in', async () => {
    const user = userEvent.setup();
    useAllocationSummary.mockReturnValue(done({ buckets: buckets({ full: 98, none: 2658 }), positions: [{ value: 'Consultant', count: 98 }] }));
    renderPanel();

    const partly = screen.getByRole('button', { name: /^Partly allocated/ });
    expect(partly).toBeDisabled();
    await user.click(partly);

    expect(useAllocationSummary).not.toHaveBeenCalledWith({ bucket: 'partial', position: null }, 0);
    expect(screen.queryByRole('button', { name: /Remove filter/ })).not.toBeInTheDocument();
  });

  it('keeps a picked allocation enabled even when its count drops to zero, so it can be un-picked', async () => {
    const user = userEvent.setup();
    useAllocationSummary.mockImplementation((filters) =>
      done({ buckets: buckets({ full: 98, partial: filters.position ? 0 : 5 }), positions: [{ value: 'Consultant', count: 98 }] })
    );
    renderPanel();

    await user.click(screen.getByRole('button', { name: /^Partly allocated/ }));
    await user.click(screen.getByRole('button', { name: /^Consultant/ }));

    const partly = screen.getByRole('button', { name: /^Partly allocated 0/ });
    expect(partly).toBeEnabled();
    await user.click(partly);
    expect(screen.queryByRole('button', { name: 'Remove filter Partly allocated' })).not.toBeInTheDocument();
  });

  it('shows only the top ten positions', () => {
    useAllocationSummary.mockReturnValue(
      done({ buckets: buckets({ full: 1 }), positions: Array.from({ length: 14 }, (_, i) => ({ value: `Position ${i + 1}`, count: 14 - i })) })
    );

    renderPanel();

    const card = screen.getByRole('heading', { name: 'Positions people are deployed to' }).parentElement;
    expect(within(card).getAllByRole('button')).toHaveLength(10);
    expect(within(card).getByText('Showing the top 10 of 14 positions.')).toBeInTheDocument();
  });

  it('says there may be more when the backend sent its full 50 positions', () => {
    useAllocationSummary.mockReturnValue(
      done({ buckets: buckets({ full: 1 }), positions: Array.from({ length: 50 }, (_, i) => ({ value: `Position ${i + 1}`, count: 50 - i })) })
    );

    renderPanel();

    expect(screen.getByText('Showing the top 10 of 50+ positions.')).toBeInTheDocument();
  });

  it('shows no cut-off note when every position fits', () => {
    renderPanel();

    expect(screen.queryByText(/Showing the top/)).not.toBeInTheDocument();
  });

  it('hides data that belongs to other filters when its fetch fails, instead of labelling it with the new filter', () => {
    useAllocationSummary.mockReturnValue({ data: null, isLoading: false, error: new Error('boom') });

    renderPanel();

    expect(screen.queryByRole('button', { name: /Fully allocated/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(2);
  });

  it('passes the refresh key through, and bumps it on Try again', async () => {
    const user = userEvent.setup();
    useAllocationSummary.mockReturnValue({ data: null, isLoading: false, error: new Error('Backend unreachable') });
    renderPanel({ refreshKey: 3 });

    expect(useAllocationSummary).toHaveBeenLastCalledWith({ bucket: null, position: null }, 3);
    await user.click(screen.getAllByRole('button', { name: 'Try again' })[0]);

    expect(useAllocationSummary).toHaveBeenLastCalledWith({ bucket: null, position: null }, 4);
  });

  it('shows Loading until the first result, with no match count', () => {
    useAllocationSummary.mockReturnValue({ data: null, isLoading: true, error: null });

    renderPanel();

    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('does not show the previous filter count while new numbers load', () => {
    useAllocationSummary.mockReturnValue({ data: { buckets: buckets({ full: 98 }), positions: [] }, isLoading: true, error: null });

    renderPanel();

    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(screen.getByRole('status')).not.toHaveTextContent('98');
  });

  it('shows an alert in both cards and an unavailable count when the request fails', () => {
    useAllocationSummary.mockReturnValue({ data: null, isLoading: false, error: new Error('Backend unreachable') });

    renderPanel();

    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('Match count unavailable');
  });

  it('keeps the charts and shows the error when a refresh fails', () => {
    useAllocationSummary.mockReturnValue({ data: { buckets: buckets({ full: 98 }), positions: [{ value: 'Consultant', count: 98 }] }, isLoading: false, error: new Error('boom') });

    renderPanel();

    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('boom');
    expect(screen.getByRole('button', { name: /Fully allocated 98/ })).toBeInTheDocument();
  });

  it('opens the Resource Deployment table from its link', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderPanel({ onNavigate });

    await user.click(screen.getByRole('button', { name: 'Open Resource Deployment table' }));

    expect(onNavigate).toHaveBeenCalledWith('resource-deployment');
  });
});
