import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecordFormModal from './RecordFormModal';
import { useEntityRelationships } from '../../hooks/useEntityRelationships';
import { createRecord, updateRecord, fetchAllMasterDataTableRows } from '../../lib/masterDataApi';

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

describe('RecordFormModal', () => {
  it('shows a loading status while the field descriptor is still loading', () => {
    useEntityRelationships.mockReturnValue({ data: null, isLoading: true, error: null });

    render(
      <RecordFormModal route="projects" singularLabel="Project" labelByKey={LABELS} onClose={vi.fn()} onSaved={vi.fn()} />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading form…');
  });

  it('renders a whole-number field with a step of 1 and its minimum', () => {
    useEntityRelationships.mockReturnValue({
      data: [
        {
          route: 'departments',
          identity: { type: 'auto-generated' },
          fields: [
            { key: 'name', type: 'string', required: true },
            { key: 'floorNumber', type: 'number', required: true, integer: true, min: 1, max: 1000 },
          ],
        },
      ],
      isLoading: false,
      error: null,
    });

    render(
      <RecordFormModal
        route="departments"
        singularLabel="Department"
        labelByKey={{ name: 'Department Name', floorNumber: 'Floor Number' }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    const floor = screen.getByLabelText(/Floor Number/);
    expect(floor).toHaveAttribute('type', 'number');
    expect(floor).toHaveAttribute('step', '1');
    expect(floor).toHaveAttribute('min', '1');
    expect(floor).toHaveAttribute('max', '1000');
    expect(floor).toBeRequired();
  });

  it('shows an alert if the field descriptor fails to load', () => {
    useEntityRelationships.mockReturnValue({ data: null, isLoading: false, error: new Error('Backend down') });

    render(
      <RecordFormModal route="projects" singularLabel="Project" labelByKey={LABELS} onClose={vi.fn()} onSaved={vi.fn()} />
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
      <RecordFormModal route="projects" singularLabel="Project" labelByKey={LABELS} onClose={vi.fn()} onSaved={vi.fn()} />
    );

    expect(screen.getByLabelText('Project ID *')).toBeInTheDocument();
    expect(screen.getByLabelText('Profit Center Code *')).toBeInTheDocument();
  });

  it('renders a date field as a date input and a number field as a number input', () => {
    useEntityRelationships.mockReturnValue({
      data: [
        {
          route: 'project-assignments',
          identity: { type: 'none' },
          fields: [
            { key: 'projectAssignmentStartDate', type: 'date', required: true },
            { key: 'employeeId', type: 'number', required: false },
          ],
        },
      ],
      isLoading: false,
      error: null,
    });

    render(
      <RecordFormModal
        route="project-assignments"
        singularLabel="Project Assignment"
        labelByKey={{ ...LABELS, employeeId: 'Employee ID' }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Project Assignment Start Date *')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Employee ID')).toHaveAttribute('type', 'number');
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
      <RecordFormModal
        route="delivery-centers"
        singularLabel="Delivery Center"
        labelByKey={LABELS}
        onClose={vi.fn()}
        onSaved={vi.fn()}
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
    fetchAllMasterDataTableRows.mockResolvedValue([
      { id: '1', projectId: 'PRJ-1001', projectName: 'Digital Factory Rollout', markedDeleted: 'No' },
      { id: '2', projectId: 'PRJ-2002', projectName: 'Old Project', markedDeleted: 'Yes' },
    ]);

    render(
      <RecordFormModal
        route="project-assignments"
        singularLabel="Project Assignment"
        labelByKey={LABELS}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    await waitFor(() => expect(fetchAllMasterDataTableRows).toHaveBeenCalledWith('projects'));
    expect(await screen.findByRole('option', { name: 'PRJ-1001 — Digital Factory Rollout' })).toBeInTheDocument();
    // Soft-deleted rows are excluded from the pick-list — you shouldn't be
    // able to assign a project that's been marked deleted.
    expect(screen.queryByRole('option', { name: /PRJ-2002/ })).not.toBeInTheDocument();
  });

  it('submits only the non-empty fields, converts a number field, and calls onSaved on success', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
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
      <RecordFormModal
        route="resource-cost"
        singularLabel="Resource Cost"
        labelByKey={{ employeeId: 'Employee ID', offshoreCost: 'Offshore Cost' }}
        onClose={vi.fn()}
        onSaved={onSaved}
      />
    );

    await user.type(screen.getByLabelText('Employee ID *'), '42');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(createRecord).toHaveBeenCalledWith('resource-cost', { employeeId: 42 }));
    expect(onSaved).toHaveBeenCalled();
  });

  it('shows per-field validation errors from a 422 response without closing the modal', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
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
      <RecordFormModal route="projects" singularLabel="Project" labelByKey={LABELS} onClose={vi.fn()} onSaved={onSaved} />
    );

    await user.type(screen.getByLabelText('Project ID *'), 'PRJ-1001');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('projectId must be unique — this value is already in use.')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  // FEAT-19: edit mode — same form, prefilled from `record`, saved via PATCH.
  it('leaves a caller-supplied identity field editable when adding (it is only locked on edit)', async () => {
    const user = userEvent.setup();
    createRecord.mockResolvedValue({ id: 'new' });
    useEntityRelationships.mockReturnValue({
      data: [
        {
          route: 'resources',
          identity: { type: 'caller-supplied-unique', field: 'employeeId' },
          fields: [
            { key: 'employeeId', type: 'number', required: true },
            { key: 'name', type: 'string', required: true },
          ],
        },
      ],
      isLoading: false,
      error: null,
    });
    render(
      <RecordFormModal
        route="resources"
        singularLabel="Resource"
        labelByKey={{ employeeId: 'Employee ID', name: 'Name' }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Add Resource' })).toBeInTheDocument();
    expect(screen.getByLabelText('Employee ID *')).toBeEnabled();
    await user.type(screen.getByLabelText('Employee ID *'), '42');
    await user.type(screen.getByLabelText('Name *'), 'Sam');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(createRecord).toHaveBeenCalledWith('resources', { employeeId: 42, name: 'Sam' }));
    expect(updateRecord).not.toHaveBeenCalled();
  });

  describe('edit mode', () => {
    const PROJECT_ASSIGNMENT_ENTITY = {
      route: 'project-assignments',
      identity: { type: 'none' },
      fields: [
        { key: 'projectId', type: 'string', required: true, references: { table: 'projects', route: 'projects' } },
        { key: 'projectAssignmentStartDate', type: 'date', required: true },
        { key: 'projectAssignmentEndDate', type: 'date', required: false },
      ],
    };
    const RESOURCE_ENTITY = {
      route: 'resources',
      identity: { type: 'caller-supplied-unique', field: 'employeeId' },
      fields: [
        { key: 'employeeId', type: 'number', required: true },
        { key: 'name', type: 'string', required: true },
        { key: 'region', type: 'string', required: false },
        { key: 'locationType', type: 'enum', required: true, values: ['Onsite', 'Offshore'] },
      ],
    };
    const RESOURCE_RECORD = {
      id: 'row-1',
      employeeId: 3749,
      name: 'Hari Balaji V',
      region: 'MENA',
      locationType: 'Offshore',
    };
    const RESOURCE_LABELS = { employeeId: 'Employee ID', name: 'Name', region: 'Region', locationType: 'Location Type' };

    function renderResourceEdit(props = {}) {
      useEntityRelationships.mockReturnValue({ data: [RESOURCE_ENTITY], isLoading: false, error: null });
      return render(
        <RecordFormModal
          route="resources"
          singularLabel="Resource"
          labelByKey={RESOURCE_LABELS}
          record={RESOURCE_RECORD}
          onClose={vi.fn()}
          onSaved={vi.fn()}
          {...props}
        />
      );
    }

    it('is titled "Edit <label>", prefilled from the record, and offers Save instead of Add', () => {
      renderResourceEdit();

      expect(screen.getByRole('dialog', { name: 'Edit Resource' })).toBeInTheDocument();
      expect(screen.getByLabelText('Name *')).toHaveValue('Hari Balaji V');
      expect(screen.getByLabelText('Region')).toHaveValue('MENA');
      expect(screen.getByLabelText('Location Type *')).toHaveValue('Offshore');
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
    });

    it('locks a caller-supplied identity field (other tables reference it) but not the rest', () => {
      renderResourceEdit();

      expect(screen.getByLabelText('Employee ID *')).toBeDisabled();
      expect(screen.getByLabelText('Name *')).toBeEnabled();
    });

    it('PATCHes only the fields that changed, by the record\'s own id, then calls onSaved', async () => {
      const user = userEvent.setup();
      const onSaved = vi.fn();
      updateRecord.mockResolvedValue({ id: 'row-1' });
      renderResourceEdit({ onSaved });

      await user.clear(screen.getByLabelText('Name *'));
      await user.type(screen.getByLabelText('Name *'), 'Hari B');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(updateRecord).toHaveBeenCalledWith('resources', 'row-1', { name: 'Hari B' }));
      expect(createRecord).not.toHaveBeenCalled();
      expect(onSaved).toHaveBeenCalled();
    });

    it('sends an explicit null for an optional field the user emptied, so it can really be cleared', async () => {
      const user = userEvent.setup();
      updateRecord.mockResolvedValue({ id: 'row-1' });
      renderResourceEdit();

      await user.clear(screen.getByLabelText('Region'));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(updateRecord).toHaveBeenCalledWith('resources', 'row-1', { region: null }));
    });

    it('closes without any request when nothing was changed', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSaved = vi.fn();
      renderResourceEdit({ onClose, onSaved });

      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(updateRecord).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
      expect(onSaved).not.toHaveBeenCalled();
    });

    it('shows per-field validation errors from a 422 and stays open', async () => {
      const user = userEvent.setup();
      const onSaved = vi.fn();
      const err = new Error('Request failed validation.');
      err.details = { name: 'name is too long.' };
      updateRecord.mockRejectedValue(err);
      renderResourceEdit({ onSaved });

      await user.type(screen.getByLabelText('Name *'), 'x');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByText('name is too long.')).toBeInTheDocument();
      expect(onSaved).not.toHaveBeenCalled();
    });

    const COSTED_ENTITY = {
      route: 'resource-cost',
      identity: { type: 'none' },
      fields: [
        { key: 'offshoreCost', type: 'number', required: false },
        { key: 'onsiteCost', type: 'number', required: false },
      ],
    };

    function renderCostEdit(props = {}) {
      useEntityRelationships.mockReturnValue({ data: [COSTED_ENTITY], isLoading: false, error: null });
      return render(
        <RecordFormModal
          route="resource-cost"
          singularLabel="Resource Cost"
          labelByKey={{ offshoreCost: 'Offshore Cost', onsiteCost: 'Onsite Cost' }}
          record={{ id: 'rc-1', offshoreCost: 500, onsiteCost: null }}
          onClose={vi.fn()}
          onSaved={vi.fn()}
          {...props}
        />
      );
    }

    it('sends an edited number field as a number, not a string', async () => {
      const user = userEvent.setup();
      updateRecord.mockResolvedValue({ id: 'rc-1' });
      renderCostEdit();

      expect(screen.getByLabelText('Offshore Cost')).toHaveValue(500);
      expect(screen.getByLabelText('Onsite Cost')).toHaveValue(null);
      await user.type(screen.getByLabelText('Onsite Cost'), '750');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(updateRecord).toHaveBeenCalledWith('resource-cost', 'rc-1', { onsiteCost: 750 }));
    });

    it('sends null when a number field with a value is emptied', async () => {
      const user = userEvent.setup();
      updateRecord.mockResolvedValue({ id: 'rc-1' });
      renderCostEdit();

      await user.clear(screen.getByLabelText('Offshore Cost'));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(updateRecord).toHaveBeenCalledWith('resource-cost', 'rc-1', { offshoreCost: null }));
    });

    it('treats retyping a number field to its existing value as no change', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderCostEdit({ onClose });

      await user.clear(screen.getByLabelText('Offshore Cost'));
      await user.type(screen.getByLabelText('Offshore Cost'), '500');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(updateRecord).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('sends a changed enum selection', async () => {
      const user = userEvent.setup();
      updateRecord.mockResolvedValue({ id: 'row-1' });
      renderResourceEdit();

      await user.selectOptions(screen.getByLabelText('Location Type *'), 'Onsite');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(updateRecord).toHaveBeenCalledWith('resources', 'row-1', { locationType: 'Onsite' }));
    });

    it('shows a non-field error from a failed save as an alert and re-enables Save', async () => {
      const user = userEvent.setup();
      updateRecord.mockRejectedValue(new Error('Backend unreachable'));
      renderResourceEdit();

      await user.type(screen.getByLabelText('Name *'), 'x');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Backend unreachable');
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('prefills a date field as YYYY-MM-DD even though the API returns a full ISO timestamp', () => {
      useEntityRelationships.mockReturnValue({ data: [PROJECT_ASSIGNMENT_ENTITY], isLoading: false, error: null });
      fetchAllMasterDataTableRows.mockResolvedValue([]);

      render(
        <RecordFormModal
          route="project-assignments"
          singularLabel="Project Assignment"
          labelByKey={LABELS}
          record={{ id: 'pa-1', projectId: 'PRJ-1', projectAssignmentStartDate: '2026-03-01T00:00:00.000Z' }}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Project Assignment Start Date *')).toHaveValue('2026-03-01');
    });

    it('preselects the record\'s current foreign-key value in the pick-list', async () => {
      useEntityRelationships.mockReturnValue({
        data: [PROJECT_ASSIGNMENT_ENTITY, { route: 'projects', identity: { type: 'caller-supplied-unique', field: 'projectId' } }],
        isLoading: false,
        error: null,
      });
      fetchAllMasterDataTableRows.mockResolvedValue([
        { id: '1', projectId: 'PRJ-1001', projectName: 'Rollout', markedDeleted: 'No' },
        { id: '2', projectId: 'PRJ-2002', projectName: 'Other', markedDeleted: 'No' },
      ]);

      render(
        <RecordFormModal
          route="project-assignments"
          singularLabel="Project Assignment"
          labelByKey={LABELS}
          record={{ id: 'pa-1', projectId: 'PRJ-2002', projectAssignmentStartDate: '2026-03-01' }}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      );

      await screen.findByRole('option', { name: 'PRJ-2002 — Other' });
      expect(screen.getByLabelText('Project ID *')).toHaveValue('PRJ-2002');
    });
  });
});
