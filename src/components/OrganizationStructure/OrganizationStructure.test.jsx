import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OrganizationStructure from './OrganizationStructure';

const ROWS = {
  departments: [
    { code: 'DEPT-001', name: 'Design Services', floorNumber: 10, markedDeleted: 'No' },
    { code: 'DEPT-002', name: 'Audit Services', floorNumber: 11, markedDeleted: 'No' },
  ],
  teams: [{ code: 'TEAM-001', name: 'TEAM-001', departmentCode: 'DEPT-001', markedDeleted: 'No' }],
  positions: [
    { name: 'Module Lead', teamCode: 'TEAM-001', competencies: 'FICO', markedDeleted: 'No' },
    { name: 'Lead Consultant', teamCode: 'TEAM-001', competencies: 'FICO', markedDeleted: 'No' },
    { name: 'Consultant', teamCode: 'TEAM-001', competencies: 'FICO', markedDeleted: 'No' },
    { name: 'Consultant', teamCode: 'TEAM-001', competencies: 'FICO', markedDeleted: 'No' },
  ],
};

function stubFetch(status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      const route = new URL(url).pathname.split('/').pop();
      const rows = ROWS[route] ?? [];
      return Promise.resolve({
        ok: status === 200,
        status,
        json: () =>
          Promise.resolve(status === 200 ? { data: rows, total: rows.length } : { error: { message: 'boom' } }),
      });
    })
  );
}

beforeEach(() => stubFetch());
afterEach(() => vi.unstubAllGlobals());

describe('OrganizationStructure', () => {
  it('shows total seats and a seat badge per department', async () => {
    render(<OrganizationStructure />);

    expect(await screen.findByText('Design Services')).toBeInTheDocument();
    expect(screen.getByText('Total seats').parentElement).toHaveTextContent('Total seats 4');
    expect(screen.getAllByLabelText('4 seats')).toHaveLength(2);
    expect(screen.getByLabelText('0 seats')).toBeInTheDocument();
  });

  it('expands a department to show teams with the Module Lead seat unallocated', async () => {
    const user = userEvent.setup();
    render(<OrganizationStructure />);

    await user.click(await screen.findByText('Design Services'));

    const team = screen.getByText('TEAM-001').closest('li');
    expect(within(team).getByText('unallocated')).toBeInTheDocument();
    expect(within(team).getByText('Consultants').nextSibling).toHaveTextContent('2');
  });

  it('expands and collapses every department with the toolbar buttons', async () => {
    const user = userEvent.setup();
    render(<OrganizationStructure />);
    await screen.findByText('Design Services');

    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getByText('No teams yet.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.getByText('No teams yet.')).not.toBeVisible();
  });

  it('shows an error when loading fails', async () => {
    stubFetch(500);
    render(<OrganizationStructure />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the organization structure');
  });
});
