import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ControlCenter from './ControlCenter';
import { useTableCounts } from '../../hooks/useTableCounts';

vi.mock('../../hooks/useTableCounts');

const failure = () => new Error('boom');
const rows = [
  { route: 'resources', label: 'Resources', count: 1234, error: null },
  { route: 'practices', label: 'Practices', count: 6, error: null },
  { route: 'teams', label: 'Teams', count: 0, error: null },
  { route: 'projects', label: 'Projects', count: null, error: failure() },
  { route: 'roles', label: 'Roles', count: null, error: failure() },
  { route: 'skills', label: 'Skills', count: null, error: failure() },
  // A failed table with a stale zero count must still read as unreachable.
  { route: 'tools', label: 'Tools', count: 0, error: failure() },
];

describe('ControlCenter', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows a polite status region while loading', () => {
    useTableCounts.mockReturnValue({ data: null, isLoading: true, error: null });
    render(<ControlCenter onNavigate={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('shows an alert when loading fails', () => {
    useTableCounts.mockReturnValue({ data: null, isLoading: false, error: new Error('Backend unreachable') });
    render(<ControlCenter onNavigate={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Backend unreachable');
  });

  it('summarises healthy, empty and unreachable tables', () => {
    useTableCounts.mockReturnValue({ data: rows, isLoading: false, error: null });
    render(<ControlCenter onNavigate={() => {}} />);

    const tile = (label) => screen.getByText(label).closest('li');
    expect(within(tile('Healthy tables')).getByText('2')).toBeInTheDocument();
    expect(within(tile('Tables with no records')).getByText('1')).toBeInTheDocument();
    expect(within(tile('Unreachable tables')).getByText('4')).toBeInTheDocument();
    expect(within(tile('Total records (excludes 4 unreachable)')).getByText('1,240')).toBeInTheDocument();
  });

  it('labels each table row with its status', () => {
    useTableCounts.mockReturnValue({ data: rows, isLoading: false, error: null });
    render(<ControlCenter onNavigate={() => {}} />);

    expect(within(screen.getByRole('row', { name: /Resources/ })).getByText('Healthy')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Teams/ })).getByText('No records')).toBeInTheDocument();
    const projects = screen.getByRole('row', { name: /Projects/ });
    expect(within(projects).getByText('Unreachable')).toBeInTheDocument();
    expect(within(projects).getByText('—')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Tools/ })).getByText('Unreachable')).toBeInTheDocument();
  });

  it('formats record counts with a thousands separator', () => {
    useTableCounts.mockReturnValue({ data: rows, isLoading: false, error: null });
    render(<ControlCenter onNavigate={() => {}} />);

    expect(within(screen.getByRole('row', { name: /Resources/ })).getByText('1,234')).toBeInTheDocument();
  });

  it('raises an alert when some tables are unreachable and keeps the plain total label otherwise', () => {
    useTableCounts.mockReturnValue({ data: rows, isLoading: false, error: null });
    const { unmount } = render(<ControlCenter onNavigate={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('4 of 7 tables could not be reached.');
    unmount();

    useTableCounts.mockReturnValue({ data: rows.slice(0, 3), isLoading: false, error: null });
    render(<ControlCenter onNavigate={() => {}} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Total records')).toBeInTheDocument();
  });

  it('navigates to a table when its Open button is clicked', async () => {
    const onNavigate = vi.fn();
    useTableCounts.mockReturnValue({ data: rows, isLoading: false, error: null });
    render(<ControlCenter onNavigate={onNavigate} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open Teams' }));

    expect(onNavigate).toHaveBeenCalledWith('teams');
  });
});
