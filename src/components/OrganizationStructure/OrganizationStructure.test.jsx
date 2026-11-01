import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OrganizationStructure from './OrganizationStructure';

const live = { markedDeleted: 'No' };
const ROWS = {
  departments: [
    { code: 'DEPT-009', name: 'Configuration Services', floorNumber: 9, ...live },
    { code: 'DEPT-006', name: 'Assessment Services', floorNumber: 13, ...live },
  ],
  teams: [
    { code: 'TEAM-001', name: 'TEAM-001', departmentCode: 'DEPT-009', ...live },
    { code: 'TEAM-002', name: 'TEAM-002', departmentCode: 'DEPT-009', ...live },
  ],
  positions: [
    { code: 'POS-1', teamCode: 'TEAM-001', name: 'Module Lead', competencies: 'FICO', ...live },
    { code: 'POS-2', teamCode: 'TEAM-001', name: 'Lead Consultant', competencies: 'FICO', ...live },
    { code: 'POS-3', teamCode: 'TEAM-001', name: 'Consultant', competencies: 'FICO', ...live },
    { code: 'POS-4', teamCode: 'TEAM-001', name: 'Consultant', competencies: 'FICO', ...live },
    { code: 'POS-5', teamCode: 'TEAM-001', name: 'Enterprise Architect', competencies: 'FICO', ...live },
    { code: 'POS-6', teamCode: 'TEAM-002', name: 'Module Lead', competencies: null, ...live },
  ],
  competencies: [{ name: 'FICO', practiceId: 'PRAC-001', ...live }],
  practices: [{ code: 'PRAC-001', name: 'Finance', ...live }],
  'resource-deployment': [{ positionId: 'POS-1', employeeId: 7, employeeName: 'Asha', ...live }],
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
  it('shows the Delivery Manager and only the Project Managers that have a team', async () => {
    render(<OrganizationStructure />);

    expect(await screen.findByText('ODC Delivery Manager')).toBeInTheDocument();
    expect(screen.getByText('Total seats').parentElement).toHaveTextContent('Total seats 6');
    expect(screen.getByText('ODC Project Manager 3')).toBeInTheDocument();
    expect(screen.queryByText('ODC Project Manager 1')).not.toBeInTheDocument();
  });

  it('expands down to the shared Module Lead and the team with its role counts', async () => {
    const user = userEvent.setup();
    render(<OrganizationStructure />);
    await screen.findByText('ODC Delivery Manager');

    await user.click(screen.getByRole('button', { name: 'Expand all' }));

    expect(screen.getByText('Configuration Services')).toBeVisible();
    expect(screen.getByText('Finance')).toBeVisible();
    expect(screen.getByText('Asha')).toBeVisible();
    const team = screen.getByText('TEAM-001').closest('li');
    expect(within(team).getByText('Consultants').nextSibling).toHaveTextContent('2');
    expect(within(team).getByText('Other').nextSibling).toHaveTextContent('1');
  });

  it('leaves out a department with no teams and fills a missing Module Lead with TBD', async () => {
    const user = userEvent.setup();
    render(<OrganizationStructure />);
    await screen.findByText('ODC Delivery Manager');

    await user.click(screen.getByRole('button', { name: 'Expand all' }));

    expect(screen.queryByText('Assessment Services')).not.toBeInTheDocument();
    expect(screen.getByText('No practice')).toBeVisible();
    expect(screen.getByText('Module Lead seat empty')).toBeVisible();
  });

  it('collapses everything again', async () => {
    const user = userEvent.setup();
    render(<OrganizationStructure />);
    await screen.findByText('ODC Delivery Manager');

    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    await user.click(screen.getByRole('button', { name: 'Collapse all' }));

    expect(screen.getByText('Configuration Services')).not.toBeVisible();
  });

  it('shows an error when loading fails', async () => {
    stubFetch(500);
    render(<OrganizationStructure />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the organization structure');
  });
});
