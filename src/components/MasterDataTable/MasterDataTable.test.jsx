import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MasterDataTable from './MasterDataTable';
import { useMasterDataTable } from '../../hooks/useMasterDataTable';

vi.mock('../../hooks/useMasterDataTable');

const COLUMNS = [
  { key: 'code', label: 'Code' },
  { key: 'name', label: 'Name' },
];

describe('MasterDataTable', () => {
  it('shows a live, polite status region while loading', () => {
    useMasterDataTable.mockReturnValue({ data: null, isLoading: true, error: null });

    render(<MasterDataTable route="practices" columns={COLUMNS} />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Loading…');
  });

  it('shows an alert with the error message when loading fails', () => {
    useMasterDataTable.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Backend unreachable'),
    });

    render(<MasterDataTable route="practices" columns={COLUMNS} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Backend unreachable');
  });

  it('renders column headers and row data on success', () => {
    useMasterDataTable.mockReturnValue({
      data: [{ id: '1', code: 'PR-1', name: 'Digital Factory' }],
      isLoading: false,
      error: null,
    });

    render(<MasterDataTable route="practices" columns={COLUMNS} />);

    expect(screen.getByRole('columnheader', { name: 'Code' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'PR-1' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Digital Factory' })).toBeInTheDocument();
  });

  it('shows an empty-state message when there are zero rows', () => {
    useMasterDataTable.mockReturnValue({ data: [], isLoading: false, error: null });

    render(<MasterDataTable route="practices" columns={COLUMNS} />);

    expect(screen.getByText(/No records yet/)).toBeInTheDocument();
  });
});
