import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ControlCenter from './ControlCenter';
import { useTableCounts } from '../../hooks/useTableCounts';

vi.mock('../../hooks/useTableCounts');

const rows = [
  { route: 'resources', label: 'Resources', count: 12, error: null },
  { route: 'teams', label: 'Teams', count: 0, error: null },
  { route: 'projects', label: 'Projects', count: null, error: new Error('boom') },
];

describe('ControlCenter', () => {
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
    expect(within(tile('Healthy tables')).getByText('1')).toBeInTheDocument();
    expect(within(tile('Tables with no records')).getByText('1')).toBeInTheDocument();
    expect(within(tile('Unreachable tables')).getByText('1')).toBeInTheDocument();
    expect(within(tile('Total records')).getByText('12')).toBeInTheDocument();
  });

  it('labels each table row with its status', () => {
    useTableCounts.mockReturnValue({ data: rows, isLoading: false, error: null });
    render(<ControlCenter onNavigate={() => {}} />);

    expect(within(screen.getByRole('row', { name: /Resources/ })).getByText('Healthy')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Teams/ })).getByText('No records')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Projects/ })).getByText('Unreachable')).toBeInTheDocument();
  });

  it('navigates to a table when its Open button is clicked', async () => {
    const onNavigate = vi.fn();
    useTableCounts.mockReturnValue({ data: rows, isLoading: false, error: null });
    render(<ControlCenter onNavigate={onNavigate} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open Teams' }));

    expect(onNavigate).toHaveBeenCalledWith('teams');
  });
});
