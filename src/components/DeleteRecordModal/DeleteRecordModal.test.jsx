import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeleteRecordModal from './DeleteRecordModal';
import { useEntityRelationships } from '../../hooks/useEntityRelationships';
import { deleteRecord } from '../../lib/masterDataApi';

vi.mock('../../hooks/useEntityRelationships');
vi.mock('../../lib/masterDataApi');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DeleteRecordModal', () => {
  it('shows a loading status while the field descriptor is still loading', () => {
    useEntityRelationships.mockReturnValue({ data: null, isLoading: true, error: null });

    render(
      <DeleteRecordModal route="practices" singularLabel="Practice" data={[]} onClose={vi.fn()} onDeleted={vi.fn()} />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('shows an alert if the field descriptor fails to load', () => {
    useEntityRelationships.mockReturnValue({ data: null, isLoading: false, error: new Error('Backend down') });

    render(
      <DeleteRecordModal route="practices" singularLabel="Practice" data={[]} onClose={vi.fn()} onDeleted={vi.fn()} />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Backend down');
  });

  it('labels the input "Code" for an auto-generated identity', () => {
    useEntityRelationships.mockReturnValue({
      data: [{ route: 'practices', identity: { type: 'auto-generated', field: 'code' } }],
      isLoading: false,
      error: null,
    });

    render(
      <DeleteRecordModal route="practices" singularLabel="Practice" data={[]} onClose={vi.fn()} onDeleted={vi.fn()} />
    );

    expect(screen.getByLabelText('Code')).toBeInTheDocument();
  });

  it('labels the input with the identity field name for a caller-supplied-unique identity', () => {
    useEntityRelationships.mockReturnValue({
      data: [{ route: 'projects', identity: { type: 'caller-supplied-unique', field: 'projectId' } }],
      isLoading: false,
      error: null,
    });

    render(
      <DeleteRecordModal route="projects" singularLabel="Project" data={[]} onClose={vi.fn()} onDeleted={vi.fn()} />
    );

    expect(screen.getByLabelText('projectId')).toBeInTheDocument();
  });

  it('labels the input "Record ID" and matches on the internal id for a table with no business identity', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    useEntityRelationships.mockReturnValue({
      data: [{ route: 'resource-cost', identity: { type: 'none' } }],
      isLoading: false,
      error: null,
    });
    deleteRecord.mockResolvedValue();

    render(
      <DeleteRecordModal
        route="resource-cost"
        singularLabel="Resource Cost"
        data={[{ id: 'abc-123', markedDeleted: 'No' }]}
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />
    );

    expect(screen.getByLabelText('Record ID')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Record ID'), 'abc-123');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteRecord).toHaveBeenCalledWith('resource-cost', 'abc-123'));
    expect(onDeleted).toHaveBeenCalled();
  });

  it('matches case-insensitively and trims whitespace, deleting by the row\'s internal id', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    useEntityRelationships.mockReturnValue({
      data: [{ route: 'practices', identity: { type: 'auto-generated', field: 'code' } }],
      isLoading: false,
      error: null,
    });
    deleteRecord.mockResolvedValue();

    render(
      <DeleteRecordModal
        route="practices"
        singularLabel="Practice"
        data={[{ id: 'row-1', code: 'PRAC-001', markedDeleted: 'No' }]}
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />
    );

    await user.type(screen.getByLabelText('Code'), '  prac-001  ');
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

    render(
      <DeleteRecordModal
        route="practices"
        singularLabel="Practice"
        data={[{ id: 'row-1', code: 'PRAC-001', markedDeleted: 'No' }]}
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />
    );

    await user.type(screen.getByLabelText('Code'), 'DOES-NOT-EXIST');
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

    render(
      <DeleteRecordModal
        route="practices"
        singularLabel="Practice"
        data={[{ id: 'row-1', code: 'PRAC-001', markedDeleted: 'Yes' }]}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText('Code'), 'PRAC-001');
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
    deleteRecord.mockRejectedValue(new Error('Server exploded'));

    render(
      <DeleteRecordModal
        route="practices"
        singularLabel="Practice"
        data={[{ id: 'row-1', code: 'PRAC-001', markedDeleted: 'No' }]}
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />
    );

    await user.type(screen.getByLabelText('Code'), 'PRAC-001');
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

    render(
      <DeleteRecordModal route="practices" singularLabel="Practice" data={[]} onClose={onClose} onDeleted={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(deleteRecord).not.toHaveBeenCalled();
  });
});
