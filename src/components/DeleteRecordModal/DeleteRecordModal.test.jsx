import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeleteRecordModal from './DeleteRecordModal';
import { useEntityRelationships } from '../../hooks/useEntityRelationships';
import { deleteRecord, fetchAllMasterDataTableRows } from '../../lib/masterDataApi';

vi.mock('../../hooks/useEntityRelationships');
vi.mock('../../lib/masterDataApi');

beforeEach(() => {
  vi.clearAllMocks();
  // FEAT-18: the modal now fetches its own full dataset (every active
  // row, across all pages) rather than trusting the table's currently
  // visible page — a record to delete by code/ID could be on any page.
  fetchAllMasterDataTableRows.mockResolvedValue([]);
});

describe('DeleteRecordModal', () => {
  it('shows a loading status while the field descriptor is still loading', () => {
    useEntityRelationships.mockReturnValue({ data: null, isLoading: true, error: null });

    render(<DeleteRecordModal route="practices" singularLabel="Practice" onClose={vi.fn()} onDeleted={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('shows a loading status while the full dataset is still being fetched', () => {
    useEntityRelationships.mockReturnValue({
      data: [{ route: 'practices', identity: { type: 'auto-generated', field: 'code' } }],
      isLoading: false,
      error: null,
    });
    fetchAllMasterDataTableRows.mockReturnValue(new Promise(() => {})); // never resolves

    render(<DeleteRecordModal route="practices" singularLabel="Practice" onClose={vi.fn()} onDeleted={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('shows an alert if the field descriptor fails to load', async () => {
    useEntityRelationships.mockReturnValue({ data: null, isLoading: false, error: new Error('Backend down') });

    render(<DeleteRecordModal route="practices" singularLabel="Practice" onClose={vi.fn()} onDeleted={vi.fn()} />);

    // The combined loading state also waits on the modal's own
    // fetchAllMasterDataTableRows call, which resolves a tick after
    // render — even though the entity-relationships error is already
    // known synchronously.
    expect(await screen.findByRole('alert')).toHaveTextContent('Backend down');
  });

  it('shows an alert if fetching the full dataset fails', async () => {
    useEntityRelationships.mockReturnValue({
      data: [{ route: 'practices', identity: { type: 'auto-generated', field: 'code' } }],
      isLoading: false,
      error: null,
    });
    fetchAllMasterDataTableRows.mockRejectedValue(new Error('Table unreachable'));

    render(<DeleteRecordModal route="practices" singularLabel="Practice" onClose={vi.fn()} onDeleted={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Table unreachable');
  });

  it('labels the input "Code" for an auto-generated identity', async () => {
    useEntityRelationships.mockReturnValue({
      data: [{ route: 'practices', identity: { type: 'auto-generated', field: 'code' } }],
      isLoading: false,
      error: null,
    });

    render(<DeleteRecordModal route="practices" singularLabel="Practice" onClose={vi.fn()} onDeleted={vi.fn()} />);

    expect(await screen.findByLabelText('Code')).toBeInTheDocument();
  });

  it('labels the input with the identity field name for a caller-supplied-unique identity', async () => {
    useEntityRelationships.mockReturnValue({
      data: [{ route: 'projects', identity: { type: 'caller-supplied-unique', field: 'projectId' } }],
      isLoading: false,
      error: null,
    });

    render(<DeleteRecordModal route="projects" singularLabel="Project" onClose={vi.fn()} onDeleted={vi.fn()} />);

    expect(await screen.findByLabelText('projectId')).toBeInTheDocument();
  });

  it('labels the input "Record ID" and matches on the internal id for a table with no business identity', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    useEntityRelationships.mockReturnValue({
      data: [{ route: 'resource-cost', identity: { type: 'none' } }],
      isLoading: false,
      error: null,
    });
    fetchAllMasterDataTableRows.mockResolvedValue([{ id: 'abc-123', markedDeleted: 'No' }]);
    deleteRecord.mockResolvedValue();

    render(<DeleteRecordModal route="resource-cost" singularLabel="Resource Cost" onClose={vi.fn()} onDeleted={onDeleted} />);

    expect(await screen.findByLabelText('Record ID')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Record ID'), 'abc-123');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteRecord).toHaveBeenCalledWith('resource-cost', 'abc-123'));
    expect(onDeleted).toHaveBeenCalled();
  });

  // FEAT-18: the whole point of fetching independently — a record on page
  // 3 of a paginated table must still be findable from this modal.
  it('finds a match that would not be on the table\'s current (first) page', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    useEntityRelationships.mockReturnValue({
      data: [{ route: 'resources', identity: { type: 'caller-supplied-unique', field: 'employeeId' } }],
      isLoading: false,
      error: null,
    });
    fetchAllMasterDataTableRows.mockResolvedValue([{ id: 'row-900', employeeId: 3900, markedDeleted: 'No' }]);
    deleteRecord.mockResolvedValue();

    render(<DeleteRecordModal route="resources" singularLabel="Resource" onClose={vi.fn()} onDeleted={onDeleted} />);

    await user.type(await screen.findByLabelText('employeeId'), '3900');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteRecord).toHaveBeenCalledWith('resources', 'row-900'));
    expect(onDeleted).toHaveBeenCalled();
    expect(fetchAllMasterDataTableRows).toHaveBeenCalledWith('resources');
  });

  it('matches case-insensitively and trims whitespace, deleting by the row\'s internal id', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    useEntityRelationships.mockReturnValue({
      data: [{ route: 'practices', identity: { type: 'auto-generated', field: 'code' } }],
      isLoading: false,
      error: null,
    });
    fetchAllMasterDataTableRows.mockResolvedValue([{ id: 'row-1', code: 'PRAC-001', markedDeleted: 'No' }]);
    deleteRecord.mockResolvedValue();

    render(<DeleteRecordModal route="practices" singularLabel="Practice" onClose={vi.fn()} onDeleted={onDeleted} />);

    await user.type(await screen.findByLabelText('Code'), '  prac-001  ');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteRecord).toHaveBeenCalledWith('practices', 'row-1'));
    expect(onDeleted).toHaveBeenCalled();
  });

  it('shows an error and does not call deleteRecord when no active record matches', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    useEntityRelationships.mockReturnValue({
      data: [{ route: 'practices', identity: { type: 'auto-generated', field: 'code' } }],
      isLoading: false,
      error: null,
    });
    fetchAllMasterDataTableRows.mockResolvedValue([{ id: 'row-1', code: 'PRAC-001', markedDeleted: 'No' }]);

    render(<DeleteRecordModal route="practices" singularLabel="Practice" onClose={vi.fn()} onDeleted={onDeleted} />);

    await user.type(await screen.findByLabelText('Code'), 'DOES-NOT-EXIST');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/No active practice found with Code "DOES-NOT-EXIST"/)).toBeInTheDocument();
    expect(deleteRecord).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('excludes a soft-deleted row from matching even when its code matches', async () => {
    const user = userEvent.setup();
    useEntityRelationships.mockReturnValue({
      data: [{ route: 'practices', identity: { type: 'auto-generated', field: 'code' } }],
      isLoading: false,
      error: null,
    });
    fetchAllMasterDataTableRows.mockResolvedValue([{ id: 'row-1', code: 'PRAC-001', markedDeleted: 'Yes' }]);

    render(<DeleteRecordModal route="practices" singularLabel="Practice" onClose={vi.fn()} onDeleted={vi.fn()} />);

    await user.type(await screen.findByLabelText('Code'), 'PRAC-001');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/No active practice found/)).toBeInTheDocument();
    expect(deleteRecord).not.toHaveBeenCalled();
  });

  it('shows the backend error message and keeps the modal open when the delete call fails', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    useEntityRelationships.mockReturnValue({
      data: [{ route: 'practices', identity: { type: 'auto-generated', field: 'code' } }],
      isLoading: false,
      error: null,
    });
    fetchAllMasterDataTableRows.mockResolvedValue([{ id: 'row-1', code: 'PRAC-001', markedDeleted: 'No' }]);
    deleteRecord.mockRejectedValue(new Error('Server exploded'));

    render(<DeleteRecordModal route="practices" singularLabel="Practice" onClose={vi.fn()} onDeleted={onDeleted} />);

    await user.type(await screen.findByLabelText('Code'), 'PRAC-001');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Server exploded')).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('closes without deleting when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    useEntityRelationships.mockReturnValue({
      data: [{ route: 'practices', identity: { type: 'auto-generated', field: 'code' } }],
      isLoading: false,
      error: null,
    });

    render(<DeleteRecordModal route="practices" singularLabel="Practice" onClose={onClose} onDeleted={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(deleteRecord).not.toHaveBeenCalled();
  });
});
