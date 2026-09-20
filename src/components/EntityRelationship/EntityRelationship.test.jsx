import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EntityRelationship from './EntityRelationship';
import { useEntityRelationships } from '../../hooks/useEntityRelationships';

vi.mock('../../hooks/useEntityRelationships');

describe('EntityRelationship', () => {
  it('shows a live, polite status region while loading', () => {
    useEntityRelationships.mockReturnValue({ data: null, isLoading: true, error: null });

    render(<EntityRelationship />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Loading…');
  });

  it('shows an alert with the error message when loading fails', () => {
    useEntityRelationships.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Backend unreachable'),
    });

    render(<EntityRelationship />);

    expect(screen.getByRole('alert')).toHaveTextContent('Backend unreachable');
  });

  it('renders an auto-generated identity and its FK relationships', () => {
    useEntityRelationships.mockReturnValue({
      data: [
        {
          route: 'teams',
          tableName: 'teams',
          resourceName: 'team',
          identity: { type: 'auto-generated', field: 'code' },
          relationships: [{ field: 'departmentCode', referencesTable: 'departments', referencesColumn: 'code' }],
          lookups: [{ key: 'departmentName', sourceTable: 'departments', via: null }],
        },
      ],
      isLoading: false,
      error: null,
    });

    render(<EntityRelationship />);

    expect(screen.getByRole('heading', { name: 'Teams' })).toBeInTheDocument();
    expect(screen.getByText(/Auto-generated code \(code\)/)).toBeInTheDocument();
    expect(screen.getByText('departmentCode')).toBeInTheDocument();
    expect(screen.getByText('departmentName')).toBeInTheDocument();
  });

  it('renders a caller-supplied-unique identity and distinguishes a chained lookup from a direct one', () => {
    useEntityRelationships.mockReturnValue({
      data: [
        {
          route: 'project-assignments',
          tableName: 'project_assignments',
          resourceName: 'project_assignment',
          identity: { type: 'none' },
          relationships: [
            { field: 'projectId', referencesTable: 'projects', referencesColumn: 'project_id' },
            { field: 'teamId', referencesTable: 'teams', referencesColumn: 'code' },
          ],
          lookups: [
            { key: 'teamName', sourceTable: 'teams', via: null },
            { key: 'departmentName', sourceTable: 'departments', via: 'teams' },
          ],
        },
      ],
      isLoading: false,
      error: null,
    });

    render(<EntityRelationship />);

    expect(screen.getByText('No single identity field')).toBeInTheDocument();
    // The list item's text is split across a <code> element and plain text
    // nodes, so match on the item's combined textContent rather than a
    // single-node getByText.
    const chainedItem = screen.getByText('departmentName').closest('li');
    expect(chainedItem).toHaveTextContent('departmentName from Departments (via Teams)');
  });

  it('falls back to the raw route string when a route has no label mapping', () => {
    useEntityRelationships.mockReturnValue({
      data: [
        {
          route: 'some-future-table',
          tableName: 'some_future_table',
          resourceName: 'some_future_table',
          identity: { type: 'none' },
          relationships: [],
          lookups: [],
        },
      ],
      isLoading: false,
      error: null,
    });

    render(<EntityRelationship />);

    expect(screen.getByRole('heading', { name: 'some-future-table' })).toBeInTheDocument();
  });

  it('shows a no-relationships message for a table with no references or lookups', () => {
    useEntityRelationships.mockReturnValue({
      data: [
        {
          route: 'practices',
          tableName: 'practices',
          resourceName: 'practice',
          identity: { type: 'auto-generated', field: 'code' },
          relationships: [],
          lookups: [],
        },
      ],
      isLoading: false,
      error: null,
    });

    render(<EntityRelationship />);

    expect(screen.getByText('No relationships to other tables.')).toBeInTheDocument();
  });
});
