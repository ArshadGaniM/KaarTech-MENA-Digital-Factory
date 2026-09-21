import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasterDataTable from './MasterDataTable';
import { useMasterDataTable } from '../../hooks/useMasterDataTable';
import { useEntityRelationships } from '../../hooks/useEntityRelationships';

vi.mock('../../hooks/useMasterDataTable');
vi.mock('../../hooks/useEntityRelationships');

const COLUMNS = [
  { key: 'code', label: 'Code' },
  { key: 'name', label: 'Name' },
];

describe('MasterDataTable', () => {
  it('shows a live, polite status region while loading', () => {
    useMasterDataTable.mockReturnValue({ data: null, isLoading: true, error: null, refetch: vi.fn() });

    render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Loading…');
  });

  it('shows an alert with the error message when loading fails', () => {
    useMasterDataTable.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Backend unreachable'),
      refetch: vi.fn(),
    });

    render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Backend unreachable');
  });

  it('renders column headers and row data on success', () => {
    useMasterDataTable.mockReturnValue({
      data: [{ id: '1', code: 'PR-1', name: 'Digital Factory' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    expect(screen.getByRole('columnheader', { name: 'Code' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'PR-1' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Digital Factory' })).toBeInTheDocument();
  });

  it('shows an empty-state message when there are zero rows', () => {
    useMasterDataTable.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() });

    render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    expect(screen.getByText(/No records yet/)).toBeInTheDocument();
  });

  it('renders an "Add <singularLabel>" button regardless of load state', () => {
    useMasterDataTable.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() });

    render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    expect(screen.getByRole('button', { name: 'Add Practice' })).toBeInTheDocument();
  });

  it('opens the Add-record modal when the button is clicked, and Cancel closes it without submitting or refetching', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    useMasterDataTable.mockReturnValue({ data: [], isLoading: false, error: null, refetch });
    useEntityRelationships.mockReturnValue({
      data: [{ route: 'practices', fields: [{ key: 'name', type: 'string', required: true }] }],
      isLoading: false,
      error: null,
    });

    render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    await user.click(screen.getByRole('button', { name: 'Add Practice' }));
    expect(screen.getByRole('dialog', { name: 'Add Practice' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(refetch).not.toHaveBeenCalled();
  });
});
