import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OrganizationStructure from './OrganizationStructure';

const live = { markedDeleted: 'No' };
const ROWS = {
  departments: [
    { code: 'DEPT-009', name: 'Configuration Services', floorNumber: 9, ...live },
    { code: 'DEPT-002', name: 'Design Services', floorNumber: 10, ...live },
    { code: 'DEPT-006', name: 'Assessment Services', floorNumber: 13, ...live },
  ],
  teams: [
    { code: 'TEAM-001', name: 'TEAM-001', departmentCode: 'DEPT-009', ...live },
    { code: 'TEAM-002', name: 'TEAM-002', departmentCode: 'DEPT-009', ...live },
    { code: 'TEAM-003', name: 'TEAM-003', departmentCode: 'DEPT-002', ...live },
  ],
  positions: [
    { code: 'POS-1', teamCode: 'TEAM-001', name: 'Module Lead', competencies: 'FICO', ...live },
    { code: 'POS-2', teamCode: 'TEAM-001', name: 'Lead Consultant', competencies: 'FICO', ...live },
    { code: 'POS-3', teamCode: 'TEAM-001', name: 'Consultant', competencies: 'FICO', ...live },
    { code: 'POS-4', teamCode: 'TEAM-001', name: 'Consultant', competencies: 'FICO', ...live },
    { code: 'POS-5', teamCode: 'TEAM-001', name: 'Enterprise Architect', competencies: 'FICO', ...live },
    { code: 'POS-6', teamCode: 'TEAM-002', name: 'Module Lead', competencies: null, ...live },
    { code: 'POS-7', teamCode: 'TEAM-003', name: 'Consultant', competencies: null, ...live },
  ],
  competencies: [{ name: 'FICO', practiceId: 'PRAC-001', ...live }],
  practices: [{ code: 'PRAC-001', name: 'Finance', ...live }],
  'resource-deployment': [{ positionId: 'POS-1', employeeId: 7, employeeName: 'Asha Rao', ...live }],
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

async function renderLoaded() {
  const user = userEvent.setup();
  render(<OrganizationStructure />);
  await screen.findByText('ODC Delivery Manager');
  return user;
}

beforeEach(() => stubFetch());
afterEach(() => vi.unstubAllGlobals());

describe('OrganizationStructure', () => {
  it('shows the Delivery Manager band with seats, departments and teams', async () => {
    await renderLoaded();

    const band = screen.getByRole('region', { name: 'ODC Delivery Manager' });
    expect(within(band).getByText('Name TBD')).toBeInTheDocument();
    expect(within(band).getByText('Seats in total, 1 filled').nextSibling).toHaveTextContent('7');
    expect(within(band).getByText('Departments').nextSibling).toHaveTextContent('2');
    expect(within(band).getByText('Teams').nextSibling).toHaveTextContent('3');
  });

  it('shows only the managers that have a team, with their seats', async () => {
    await renderLoaded();

    const manager3 = screen.getByRole('button', { name: /Manager 3 Name TBD/ });
    expect(manager3).toHaveTextContent('6 seats');
    expect(manager3).toHaveTextContent('Configuration');
    expect(screen.queryByRole('button', { name: /Manager 1 Name TBD/ })).not.toBeInTheDocument();
  });

  it('starts on the first manager and switches departments when another manager is picked', async () => {
    const user = await renderLoaded();

    expect(screen.getByRole('heading', { name: 'ODC Project Manager 2: departments' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Design Services/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Manager 3 Name TBD/ }));

    expect(screen.getByRole('heading', { name: 'ODC Project Manager 3: departments' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Configuration Services/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Design Services/ })).not.toBeInTheDocument();
  });

  it('picks a manager from the seat share bar', async () => {
    const user = await renderLoaded();

    await user.click(screen.getByRole('button', { name: 'ODC Project Manager 3, 6 seats' }));

    expect(screen.getByRole('button', { name: 'ODC Project Manager 3, 6 seats' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/ODC Project Manager 3 holds 86% of 7 seats/)).toBeInTheDocument();
  });

  it('finds a department under any manager and says so when nothing matches', async () => {
    const user = await renderLoaded();

    await user.type(screen.getByRole('searchbox', { name: 'Find a department' }), 'config');
    expect(screen.getByRole('heading', { name: 'Departments matching "config"' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Configuration Services/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Design Services/ })).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Find a department' }));
    await user.type(screen.getByRole('searchbox', { name: 'Find a department' }), 'zzz');
    expect(screen.getByText('No department matches. Try another word.')).toBeInTheDocument();
  });

  it('opens the department drawer with practices, the shared Module Lead and team cards', async () => {
    const user = await renderLoaded();
    await user.click(screen.getByRole('button', { name: /Manager 3 Name TBD/ }));

    await user.click(screen.getByRole('button', { name: /Configuration Services/ }));

    const drawer = screen.getByRole('dialog', { name: 'Configuration Services' });
    expect(within(drawer).getByText('Finance')).toBeInTheDocument();
    expect(within(drawer).getByText('Asha Rao')).toBeInTheDocument();
    expect(within(drawer).getByText('No practice')).toBeInTheDocument();
    const team = within(drawer).getByText('TEAM-001').closest('li');
    expect(within(team).getByText('1 of 5 seats filled')).toBeInTheDocument();
    expect(within(team).getByText('Consultants').nextSibling).toHaveTextContent('2');
    expect(within(team).getByText('Other').nextSibling).toHaveTextContent('1');
  });

  it('marks a Module Lead seat that nobody holds as empty under TBD', async () => {
    const user = await renderLoaded();
    await user.click(screen.getByRole('button', { name: /Manager 3 Name TBD/ }));
    await user.click(screen.getByRole('button', { name: /Configuration Services/ }));

    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByText('Seat empty')).toBeInTheDocument();
    expect(within(drawer).getByText('TBD', { selector: 'b' })).toBeInTheDocument();
  });

  it('closes the drawer with the Close button, Escape or the backdrop, and returns focus to the tile', async () => {
    const user = await renderLoaded();
    const tile = screen.getByRole('button', { name: /Design Services/ });

    await user.click(tile);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(tile).toHaveFocus();

    await user.click(tile);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(tile);
    await user.click(screen.getByRole('button', { name: 'Close department detail' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(tile).toHaveFocus();
  });

  it('returns focus to the tile after Escape', async () => {
    const user = await renderLoaded();
    const tile = screen.getByRole('button', { name: /Design Services/ });

    await user.click(tile);
    await user.keyboard('{Escape}');

    expect(tile).toHaveFocus();
  });

  it('keeps Tab inside the open drawer', async () => {
    const user = await renderLoaded();
    await user.click(screen.getByRole('button', { name: /Design Services/ }));
    const drawer = screen.getByRole('dialog');
    const controls = within(drawer).getAllByRole('button').concat(Array.from(drawer.querySelectorAll('summary')));
    expect(controls.length).toBeGreaterThan(1);

    for (let step = 0; step < controls.length + 2; step += 1) {
      await user.tab();
      expect(drawer).toContainElement(document.activeElement);
    }
    await user.tab({ shift: true });
    expect(drawer).toContainElement(document.activeElement);
  });

  it('finds a department whatever the case and ignores whitespace-only input', async () => {
    const user = await renderLoaded();
    const box = screen.getByRole('searchbox', { name: 'Find a department' });

    await user.type(box, '  DESIGN ');
    expect(screen.getByRole('heading', { name: 'Departments matching "DESIGN"' })).toBeInTheDocument();

    await user.clear(box);
    await user.type(box, '   ');
    expect(screen.getByRole('heading', { name: 'ODC Project Manager 2: departments' })).toBeInTheDocument();
  });

  it('uses singular words for a single seat, team or practice', async () => {
    await renderLoaded();

    const tile = screen.getByRole('button', { name: /Design Services/ });
    expect(tile).toHaveTextContent('1seat1team1practice');
  });

  it('shows a loading message until the data arrives', () => {
    render(<OrganizationStructure />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('leaves out a department with no teams', async () => {
    const user = await renderLoaded();
    await user.type(screen.getByRole('searchbox', { name: 'Find a department' }), 'assessment');

    expect(screen.getByText('No department matches. Try another word.')).toBeInTheDocument();
  });

  it('shows an error when loading fails', async () => {
    stubFetch(500);
    render(<OrganizationStructure />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the organization structure');
  });
});
