import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasterDataTable from './MasterDataTable';
import { useMasterDataTable } from '../../hooks/useMasterDataTable';
import { useEntityRelationships } from '../../hooks/useEntityRelationships';
import { deleteRecord } from '../../lib/masterDataApi';

vi.mock('../../hooks/useMasterDataTable');
vi.mock('../../hooks/useEntityRelationships');
vi.mock('../../lib/masterDataApi', async () => {
  const actual = await vi.importActual('../../lib/masterDataApi');
  return { ...actual, deleteRecord: vi.fn() };
});

beforeEach(() => {
  vi.clearAllMocks();
});

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

  it('renders a "Delete <singularLabel>" toolbar button and opens the delete-by-code popup', async () => {
    const user = userEvent.setup();
    useMasterDataTable.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() });
    useEntityRelationships.mockReturnValue({
      data: [{ route: 'practices', identity: { type: 'auto-generated', field: 'code' } }],
      isLoading: false,
      error: null,
    });

    render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    await user.click(screen.getByRole('button', { name: 'Delete Practice' }));
    expect(screen.getByRole('dialog', { name: 'Delete Practice' })).toBeInTheDocument();
  });

  it('tracks two concurrent row deletes independently, without one finishing clearing the other\'s in-flight state', async () => {
    const user = userEvent.setup();
    let resolveRowA;
    const rowAPromise = new Promise((resolve) => {
      resolveRowA = resolve;
    });
    useMasterDataTable.mockReturnValue({
      data: [
        { id: 'row-a', code: 'PR-A', name: 'Row A', markedDeleted: 'No' },
        { id: 'row-b', code: 'PR-B', name: 'Row B', markedDeleted: 'No' },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    deleteRecord.mockImplementation((_route, id) => (id === 'row-a' ? rowAPromise : Promise.resolve()));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    const [deleteA, deleteB] = screen.getAllByRole('button', { name: /^(Delete|Deleting…)$/ });
    await user.click(deleteA);
    // Row A's delete is still in flight (rowAPromise unresolved) — its
    // button should show the in-flight state while row B's is untouched.
    expect(deleteA).toHaveTextContent('Deleting…');
    expect(deleteB).toHaveTextContent('Delete');

    await user.click(deleteB);
    await waitFor(() => expect(deleteRecord).toHaveBeenCalledWith('practices', 'row-b'));
    // Row B resolved and cleared its own in-flight state — row A, still
    // pending, must not have been cleared by row B's `finally`.
    expect(deleteA).toHaveTextContent('Deleting…');
    expect(deleteB).toHaveTextContent('Delete');

    resolveRowA();
    await waitFor(() => expect(deleteA).toHaveTextContent('Delete'));
  });

  it('renders a per-row Delete action, and soft-deletes that exact row after confirmation', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    useMasterDataTable.mockReturnValue({
      data: [{ id: 'row-1', code: 'PR-1', name: 'Digital Factory', markedDeleted: 'No' }],
      isLoading: false,
      error: null,
      refetch,
    });
    deleteRecord.mockResolvedValue();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(deleteRecord).toHaveBeenCalledWith('practices', 'row-1'));
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it('does not delete the row when the confirmation is declined', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    useMasterDataTable.mockReturnValue({
      data: [{ id: 'row-1', code: 'PR-1', name: 'Digital Factory', markedDeleted: 'No' }],
      isLoading: false,
      error: null,
      refetch,
    });
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(deleteRecord).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
  });

  it('shows "Deleted" instead of a Delete button for an already soft-deleted row', () => {
    useMasterDataTable.mockReturnValue({
      data: [{ id: 'row-1', code: 'PR-1', name: 'Digital Factory', markedDeleted: 'Yes' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    expect(screen.getByText('Deleted')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('shows an alert with the backend error and keeps the row if the row-level delete fails', async () => {
    const user = userEvent.setup();
    useMasterDataTable.mockReturnValue({
      data: [{ id: 'row-1', code: 'PR-1', name: 'Digital Factory', markedDeleted: 'No' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    deleteRecord.mockRejectedValue(new Error('Network down'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
  });
});
