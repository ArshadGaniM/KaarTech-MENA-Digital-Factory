import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddRecordModal from './AddRecordModal';
import { useEntityRelationships } from '../../hooks/useEntityRelationships';
import { createRecord, fetchMasterDataTable } from '../../lib/masterDataApi';

vi.mock('../../hooks/useEntityRelationships');
vi.mock('../../lib/masterDataApi');

const LABELS = {
  projectId: 'Project ID',
  projectProfitCenterCode: 'Profit Center Code',
  projectAssignmentStartDate: 'Project Assignment Start Date',
  locationType: 'Onshore/Offshore',
  name: 'Name',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AddRecordModal', () => {
  it('shows a loading status while the field descriptor is still loading', () => {
    useEntityRelationships.mockReturnValue({ data: null, isLoading: true, error: null });

    render(
      <AddRecordModal route="projects" singularLabel="Project" labelByKey={LABELS} onClose={vi.fn()} onCreated={vi.fn()} />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading form…');
  });

  it('shows an alert if the field descriptor fails to load', () => {
    useEntityRelationships.mockReturnValue({ data: null, isLoading: false, error: new Error('Backend down') });

    render(
      <AddRecordModal route="projects" singularLabel="Project" labelByKey={LABELS} onClose={vi.fn()} onCreated={vi.fn()} />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Backend down');
  });

  it('renders a plain manual field as a text input, excluding auto-generated/lookup fields (they are never in table.fields)', () => {
    useEntityRelationships.mockReturnValue({
      data: [
        {
          route: 'projects',
          identity: { type: 'caller-supplied-unique', field: 'projectId' },
          fields: [
            { key: 'projectId', type: 'string', required: true },
            { key: 'projectProfitCenterCode', type: 'string', required: true },
          ],
        },
      ],
      isLoading: false,
      error: null,
    });

    render(
      <AddRecordModal route="projects" singularLabel="Project" labelByKey={LABELS} onClose={vi.fn()} onCreated={vi.fn()} />
    );

    expect(screen.getByLabelText('Project ID *')).toBeInTheDocument();
    expect(screen.getByLabelText('Profit Center Code *')).toBeInTheDocument();
  });

  it('renders an enum field as a select with the field-defined values, not a free-text input', () => {
    useEntityRelationships.mockReturnValue({
      data: [
        {
          route: 'delivery-centers',
          identity: { type: 'auto-generated', field: 'code' },
          fields: [{ key: 'locationType', type: 'enum', required: true, values: ['onshore', 'offshore'] }],
        },
      ],
      isLoading: false,
      error: null,
    });

    render(
      <AddRecordModal
        route="delivery-centers"
        singularLabel="Delivery Center"
        labelByKey={LABELS}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    );

    const select = screen.getByLabelText('Onshore/Offshore *');
    expect(select.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'onshore' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'offshore' })).toBeInTheDocument();
  });

  it('renders a references field as a pick-list populated from the referenced table, using its identity value', async () => {
    useEntityRelationships.mockReturnValue({
      data: [
        {
          route: 'project-assignments',
          identity: { type: 'none' },
          fields: [{ key: 'projectId', type: 'string', required: true, references: { table: 'projects', route: 'projects' } }],
        },
        { route: 'projects', identity: { type: 'caller-supplied-unique', field: 'projectId' } },
      ],
      isLoading: false,
      error: null,
    });
    fetchMasterDataTable.mockResolvedValue([
      { id: '1', projectId: 'PRJ-1001', projectName: 'Digital Factory Rollout', markedDeleted: 'No' },
      { id: '2', projectId: 'PRJ-2002', projectName: 'Old Project', markedDeleted: 'Yes' },
    ]);

    render(
      <AddRecordModal
        route="project-assignments"
        singularLabel="Project Assignment"
        labelByKey={LABELS}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    );

    await waitFor(() => expect(fetchMasterDataTable).toHaveBeenCalledWith('projects'));
    expect(await screen.findByRole('option', { name: 'PRJ-1001 — Digital Factory Rollout' })).toBeInTheDocument();
    // Soft-deleted rows are excluded from the pick-list — you shouldn't be
    // able to assign a project that's been marked deleted.
    expect(screen.queryByRole('option', { name: /PRJ-2002/ })).not.toBeInTheDocument();
  });

  it('submits only the non-empty fields, converts a number field, and calls onCreated on success', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    useEntityRelationships.mockReturnValue({
      data: [
        {
          route: 'resource-cost',
          identity: { type: 'none' },
          fields: [
            { key: 'employeeId', type: 'number', required: true },
            { key: 'offshoreCost', type: 'number', required: false },
          ],
        },
      ],
      isLoading: false,
      error: null,
    });
    createRecord.mockResolvedValue({ id: '1' });

    render(
      <AddRecordModal
        route="resource-cost"
        singularLabel="Resource Cost"
        labelByKey={{ employeeId: 'Employee ID', offshoreCost: 'Offshore Cost' }}
        onClose={vi.fn()}
        onCreated={onCreated}
      />
    );

    await user.type(screen.getByLabelText('Employee ID *'), '42');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(createRecord).toHaveBeenCalledWith('resource-cost', { employeeId: 42 }));
    expect(onCreated).toHaveBeenCalled();
  });

  it('shows per-field validation errors from a 422 response without closing the modal', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    useEntityRelationships.mockReturnValue({
      data: [
        {
          route: 'projects',
          identity: { type: 'caller-supplied-unique', field: 'projectId' },
          fields: [{ key: 'projectId', type: 'string', required: true }],
        },
      ],
      isLoading: false,
      error: null,
    });
    const validationError = new Error('Request failed validation.');
    validationError.details = { projectId: 'projectId must be unique — this value is already in use.' };
    createRecord.mockRejectedValue(validationError);

    render(
      <AddRecordModal route="projects" singularLabel="Project" labelByKey={LABELS} onClose={vi.fn()} onCreated={onCreated} />
    );

    await user.type(screen.getByLabelText('Project ID *'), 'PRJ-1001');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('projectId must be unique — this value is already in use.')).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
