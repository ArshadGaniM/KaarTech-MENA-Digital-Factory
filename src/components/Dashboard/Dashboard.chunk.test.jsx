import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from './Dashboard';
import { useTableCounts } from '../../hooks/useTableCounts';

vi.mock('../../hooks/useTableCounts');
vi.mock('../../hooks/useGroupSummary', () => ({ useGroupSummary: () => ({ data: { groups: [], total: 0 }, isLoading: false, error: null }) }));
vi.mock('../../hooks/useAllocationSummary', () => ({
  useAllocationSummary: () => ({ data: { buckets: [], positions: [] }, isLoading: false, error: null }),
}));
// The charts file cannot be fetched, as after a deploy that replaced it.
vi.mock('../Analytics', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

describe('Dashboard when the charts file is gone', () => {
  it('shows a message with a reload button instead of a blank page', async () => {
    useTableCounts.mockReturnValue({ data: ['resources', 'projects', 'teams', 'delivery-centers'].map((route) => ({ route, label: route, count: 1, error: null })), isLoading: false, error: null });
    render(<Dashboard onNavigate={() => {}} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Workforce' }));

    expect(await screen.findByText(/The charts could not be loaded/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument();
  });
});
