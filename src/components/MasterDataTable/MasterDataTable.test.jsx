import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasterDataTable from './MasterDataTable';
import { useMasterDataTable } from '../../hooks/useMasterDataTable';
import { useEntityRelationships } from '../../hooks/useEntityRelationships';
import { deleteRecord } from '../../lib/masterDataApi';

vi.mock('../../hooks/useMasterDataTable');
vi.mock('../../hooks/useEntityRelationships');
vi.mock('../../lib/masterDataApi', async () => {
  const actual = await vi.importActual('../../lib/masterDataApi');
  return { ...actual, deleteRecord: vi.fn(), fetchAllMasterDataTableRows: vi.fn().mockResolvedValue([]) };
});

beforeEach(() => {
  vi.clearAllMocks();
});

const COLUMNS = [
  { key: 'code', label: 'Code' },
  { key: 'name', label: 'Name' },
];

// A thin wrapper so every test only has to say what's unusual about its
// page — page/totalPages/setPage default to "a single, first page" since
// most tests aren't about pagination at all.
function mockTable({ data, total, page = 1, totalPages = 1, isLoading = false, error = null, refetch = vi.fn(), setPage = vi.fn() }) {
  useMasterDataTable.mockReturnValue({
    data,
    total: total ?? (data ? data.length : 0),
    page,
    totalPages,
    setPage,
    isLoading,
    error,
    refetch,
  });
}

describe('MasterDataTable', () => {
  it('shows a live, polite status region while loading', () => {
    mockTable({ data: null, isLoading: true });

    render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Loading…');
  });

  it('shows an alert with the error message when loading fails', () => {
    mockTable({ data: null, error: new Error('Backend unreachable') });

    render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Backend unreachable');
  });

  it('renders column headers and row data on success', () => {
    mockTable({ data: [{ id: '1', code: 'PR-1', name: 'Digital Factory' }] });

    render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    expect(screen.getByRole('columnheader', { name: 'Code' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'PR-1' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Digital Factory' })).toBeInTheDocument();
  });

  it('shows an empty-state message when there are zero rows', () => {
    mockTable({ data: [] });

    render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    expect(screen.getByText(/No records yet/)).toBeInTheDocument();
  });

  it('renders an "Add <singularLabel>" button regardless of load state', () => {
    mockTable({ data: [] });

    render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    expect(screen.getByRole('button', { name: 'Add Practice' })).toBeInTheDocument();
  });

  it('opens the Add-record modal when the button is clicked, and Cancel closes it without submitting or refetching', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockTable({ data: [], refetch });
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
    mockTable({ data: [] });
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
    mockTable({
      data: [
        { id: 'row-a', code: 'PR-A', name: 'Row A', markedDeleted: 'No' },
        { id: 'row-b', code: 'PR-B', name: 'Row B', markedDeleted: 'No' },
      ],
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
    mockTable({ data: [{ id: 'row-1', code: 'PR-1', name: 'Digital Factory', markedDeleted: 'No' }], refetch });
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
    mockTable({ data: [{ id: 'row-1', code: 'PR-1', name: 'Digital Factory', markedDeleted: 'No' }], refetch });
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(deleteRecord).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
  });

  it('shows "Deleted" instead of a Delete button for an already soft-deleted row', () => {
    mockTable({ data: [{ id: 'row-1', code: 'PR-1', name: 'Digital Factory', markedDeleted: 'Yes' }] });

    render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    expect(screen.getByText('Deleted')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('shows an alert with the backend error and keeps the row if the row-level delete fails', async () => {
    const user = userEvent.setup();
    mockTable({ data: [{ id: 'row-1', code: 'PR-1', name: 'Digital Factory', markedDeleted: 'No' }] });
    deleteRecord.mockRejectedValue(new Error('Network down'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
  });
});

// FEAT-18: offset-based pagination (CLAUDE.md §10) — every table page
// fetches 20 rows at a time; these controls are how the user moves
// between pages of a table like Resources (2,756 rows).
describe('MasterDataTable pagination', () => {
  it('shows the current page, total pages, and total row count', () => {
    mockTable({ data: [{ id: '1', code: 'PR-1', name: 'A' }], total: 45, page: 2, totalPages: 3 });

    render(<MasterDataTable route="resources" columns={COLUMNS} singularLabel="Resource" />);

    expect(screen.getByText('Page 2 of 3 (45 total)')).toBeInTheDocument();
  });

  it('disables Previous on the first page and Next on the last page', () => {
    mockTable({ data: [{ id: '1', code: 'PR-1', name: 'A' }], total: 3, page: 1, totalPages: 1 });

    render(<MasterDataTable route="resources" columns={COLUMNS} singularLabel="Resource" />);

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('clicking Next calls setPage with page + 1', async () => {
    const user = userEvent.setup();
    const setPage = vi.fn();
    mockTable({ data: [{ id: '1', code: 'PR-1', name: 'A' }], total: 45, page: 1, totalPages: 3, setPage });

    render(<MasterDataTable route="resources" columns={COLUMNS} singularLabel="Resource" />);

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(setPage).toHaveBeenCalledWith(2);
  });

  it('clicking Previous calls setPage with page - 1', async () => {
    const user = userEvent.setup();
    const setPage = vi.fn();
    mockTable({ data: [{ id: '1', code: 'PR-1', name: 'A' }], total: 45, page: 2, totalPages: 3, setPage });

    render(<MasterDataTable route="resources" columns={COLUMNS} singularLabel="Resource" />);

    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(setPage).toHaveBeenCalledWith(1);
  });
});

// FEAT-18: drag-to-resize column widths, generic across every table since
// they all render through this one component.
describe('MasterDataTable column resize', () => {
  it('renders a resize handle for every data column but not for Actions', () => {
    mockTable({ data: [{ id: '1', code: 'PR-1', name: 'A' }] });

    const { container } = render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    // One handle per data column (Code, Name) — Actions has none.
    expect(container.querySelectorAll('[class*="resizeHandle"]')).toHaveLength(COLUMNS.length);
  });

  it('dragging a handle widens the dragged column\'s <col> without affecting the other', () => {
    mockTable({ data: [{ id: '1', code: 'PR-1', name: 'A' }] });

    const { container } = render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    const cols = container.querySelectorAll('col');
    const codeCol = cols[0];
    const nameCol = cols[1];
    const codeWidthBefore = codeCol.style.width;
    const nameWidthBefore = nameCol.style.width;

    const handle = container.querySelectorAll('[class*="resizeHandle"]')[0];
    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 160 });
    fireEvent.mouseUp(document);

    expect(parseInt(codeCol.style.width, 10)).toBe(parseInt(codeWidthBefore, 10) + 60);
    expect(nameCol.style.width).toBe(nameWidthBefore);
  });

  it('does not shrink a column below the minimum width', () => {
    mockTable({ data: [{ id: '1', code: 'PR-1', name: 'A' }] });

    const { container } = render(<MasterDataTable route="practices" columns={COLUMNS} singularLabel="Practice" />);

    const handle = container.querySelectorAll('[class*="resizeHandle"]')[0];
    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: -5000 }); // drag far past any sane lower bound
    fireEvent.mouseUp(document);

    const codeCol = container.querySelectorAll('col')[0];
    expect(parseInt(codeCol.style.width, 10)).toBeGreaterThanOrEqual(72);
  });
});
