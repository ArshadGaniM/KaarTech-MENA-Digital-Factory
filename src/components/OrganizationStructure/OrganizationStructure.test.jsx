import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OrganizationStructure from './OrganizationStructure';
import { currentMonth } from '../../lib/months';

// The real popup is tested with the Control Center. Here it only has to be opened with the right props.
vi.mock('../ControlCenter/TeamDialog', () => ({
  default: ({ code, month, updatedAt, pageError, onClose }) => (
    <div role="dialog" aria-label={`popup ${code}`}>
      <span>{`${month} ${updatedAt instanceof Date ? 'date' : 'no date'} ${pageError ? 'error' : 'ok'}`}</span>
      <button type="button" onClick={onClose}>close popup</button>
    </div>
  ),
}));

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
    expect(within(band).getByText('Mohammed Ibrahim S')).toBeInTheDocument();
    expect(within(band).getByText('MI')).toBeInTheDocument();
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

  it('shows the department detail below the cards with practices, the shared Module Lead and team cards', async () => {
    const user = await renderLoaded();
    await user.click(screen.getByRole('button', { name: /Manager 3 Name TBD/ }));

    await user.click(screen.getByRole('button', { name: /Configuration Services/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Configuration Services/ })).toHaveAttribute('aria-pressed', 'true');
    const detail = screen.getByRole('region', { name: 'Configuration Services detail' });
    expect(within(detail).getByText('Finance')).toBeInTheDocument();
    expect(within(detail).getByText('Asha Rao')).toBeInTheDocument();
    expect(within(detail).getAllByText('Module Lead, 1 team')).toHaveLength(2);
    expect(within(detail).getByText('No practice')).toBeInTheDocument();
    const team = within(detail).getByText('TEAM-001').closest('li');
    expect(within(team).getByText('1 of 5 seats filled')).toBeInTheDocument();
    expect(within(team).getByText('Consultants').nextSibling).toHaveTextContent('2');
    expect(within(team).getByText('Other').nextSibling).toHaveTextContent('1');
  });

  it('opens the same team popup as the Control Center from a team card, on the current month, and closes it', async () => {
    const user = await renderLoaded();
    await user.click(screen.getByRole('button', { name: /Manager 3 Name TBD/ }));
    await user.click(screen.getByRole('button', { name: /Configuration Services/ }));

    await user.click(screen.getByRole('button', { name: 'TEAM-001, TEAM-001. Open details' }));

    const popup = screen.getByRole('dialog', { name: 'popup TEAM-001' });
    expect(popup).toHaveTextContent(`${currentMonth()} date ok`);
    await user.click(within(popup).getByRole('button', { name: 'close popup' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the popup when the card itself is clicked, not only its name', async () => {
    const user = await renderLoaded();
    await user.click(screen.getByRole('button', { name: /Manager 3 Name TBD/ }));
    await user.click(screen.getByRole('button', { name: /Configuration Services/ }));

    await user.click(screen.getByText('1 of 5 seats filled'));

    expect(screen.getByRole('dialog', { name: 'popup TEAM-001' })).toBeInTheDocument();
  });

  it('opens a different team in the popup when another card is clicked after closing', async () => {
    const user = await renderLoaded();
    await user.click(screen.getByRole('button', { name: /Manager 3 Name TBD/ }));
    await user.click(screen.getByRole('button', { name: /Configuration Services/ }));
    await user.click(screen.getByRole('button', { name: 'TEAM-001, TEAM-001. Open details' }));
    await user.click(screen.getByRole('button', { name: 'close popup' }));

    await user.click(screen.getByRole('button', { name: 'TEAM-002, TEAM-002. Open details' }));

    expect(screen.getByRole('dialog', { name: 'popup TEAM-002' })).toBeInTheDocument();
  });

  it('offers three views, Cards, Layers and Tree, and shows the Tree as a hierarchy that opens the team popup', async () => {
    const user = await renderLoaded();
    const views = within(screen.getByRole('group', { name: 'View' })).getAllByRole('button');
    expect(views.map((button) => button.textContent)).toEqual(['Cards', 'Layers', 'Tree']);

    await user.click(screen.getByRole('button', { name: 'Tree' }));
    expect(screen.getByRole('button', { name: 'Tree' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('list', { name: 'Organization tree' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    await user.click(screen.getByRole('button', { name: 'TEAM-001, TEAM-001. Open details' }));
    expect(screen.getByRole('dialog', { name: 'popup TEAM-001' })).toBeInTheDocument();
  });

  it('marks a Module Lead seat that nobody holds as empty under TBD', async () => {
    const user = await renderLoaded();
    await user.click(screen.getByRole('button', { name: /Manager 3 Name TBD/ }));
    await user.click(screen.getByRole('button', { name: /Configuration Services/ }));

    const detail = screen.getByRole('region', { name: 'Configuration Services detail' });
    expect(within(detail).getByText('Seat empty')).toBeInTheDocument();
    expect(within(detail).getByText('TBD', { selector: 'b' })).toBeInTheDocument();
  });

  it('does not reopen the old detail when the search text is cleared', async () => {
    const user = await renderLoaded();
    await user.click(screen.getByRole('button', { name: /Manager 3 Name TBD/ }));
    await user.click(screen.getByRole('button', { name: /Configuration Services/ }));
    expect(screen.getByRole('region', { name: 'Configuration Services detail' })).toBeInTheDocument();

    const box = screen.getByRole('searchbox', { name: 'Find a department' });
    await user.type(box, 'config');
    await user.clear(box);

    expect(screen.queryByRole('region', { name: /detail$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Configuration Services/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches the detail to another department and closes it when the same one is picked again', async () => {
    const user = await renderLoaded();
    await user.type(screen.getByRole('searchbox', { name: 'Find a department' }), 'services');
    const config = screen.getByRole('button', { name: /Configuration Services/ });
    const design = screen.getByRole('button', { name: /Design Services/ });

    await user.click(config);
    expect(screen.getByRole('region', { name: 'Configuration Services detail' })).toBeInTheDocument();
    await user.click(design);
    expect(screen.queryByRole('region', { name: 'Configuration Services detail' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Design Services detail' })).toBeInTheDocument();
    expect(config).toHaveAttribute('aria-pressed', 'false');
    expect(design).toHaveAttribute('aria-pressed', 'true');

    await user.click(design);
    expect(screen.queryByRole('region', { name: /detail$/ })).not.toBeInTheDocument();
    expect(design).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens and closes the detail from the keyboard and keeps focus on the card', async () => {
    const user = await renderLoaded();
    const tile = screen.getByRole('button', { name: /Design Services/ });
    tile.focus();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('region', { name: 'Design Services detail' })).toBeInTheDocument();
    expect(tile).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.queryByRole('region', { name: 'Design Services detail' })).not.toBeInTheDocument();
    expect(tile).toHaveFocus();
  });

  it('scrolls the opened detail into view', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    try {
      const user = await renderLoaded();
      await user.click(screen.getByRole('button', { name: /Design Services/ }));
      expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    } finally {
      delete Element.prototype.scrollIntoView;
    }
  });

  it('clears the department detail when another manager is picked', async () => {
    const user = await renderLoaded();
    await user.click(screen.getByRole('button', { name: /Design Services/ }));
    expect(screen.getByRole('region', { name: 'Design Services detail' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Manager 3 Name TBD/ }));

    expect(screen.queryByRole('region', { name: /detail$/ })).not.toBeInTheDocument();
  });

  it('hides the departments and their detail when the selected manager is picked again', async () => {
    const user = await renderLoaded();
    await user.click(screen.getByRole('button', { name: /Design Services/ }));
    const manager2 = screen.getByRole('button', { name: /Manager 2 Name TBD/ });
    expect(manager2).toHaveAttribute('aria-pressed', 'true');

    await user.click(manager2);

    expect(manager2).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: /Design Services/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /detail$/ })).not.toBeInTheDocument();
    expect(screen.getByText('Select a project manager to see its departments.')).toBeInTheDocument();

    await user.click(manager2);
    expect(screen.getByRole('button', { name: /Design Services/ })).toHaveAttribute('aria-pressed', 'false');
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

describe('OrganizationStructure tree view', () => {
  const openTree = async () => {
    const user = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Layers' }));
    return user;
  };
  const NAMES = { 2: 'Name TBD', 3: 'Name TBD' };
  const pickManager = (user, number) => user.click(screen.getByRole('button', { name: new RegExp(`Layer 2 ODC Project Manager ${number} ${NAMES[number]}`) }));

  it('starts on Cards and switches to a tree headed by the Delivery Manager and the managers', async () => {
    const user = await openTree();

    expect(screen.getByRole('button', { name: 'Layers' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/Layer 1/)).toHaveTextContent('ODC Delivery Manager');
    expect(screen.queryByRole('region', { name: 'ODC Delivery Manager' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'ODC Project Managers' })).getAllByRole('button')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Cards' }));
    expect(screen.getByRole('region', { name: 'ODC Delivery Manager' })).toBeInTheDocument();
  });

  it('shows the picked manager down to practices, Module Leads and teams, with No practice and TBD where they apply', async () => {
    const user = await openTree();
    await pickManager(user, 3);

    expect(screen.getByRole('button', { name: /Department Configuration Services/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /Practice Finance/ })).toHaveAttribute('aria-expanded', 'true');
    const financeTeams = screen.getByRole('list', { name: 'Teams of Asha Rao' });
    expect(within(financeTeams).getByText('TEAM-001')).toHaveTextContent('1/5');
    const unfilled = screen.getByRole('list', { name: 'Teams of the unfilled Module Lead seat' });
    expect(within(unfilled).getByText('TEAM-002')).toHaveTextContent('0/1');
    expect(screen.getByRole('button', { name: /Practice No practice/ })).toBeInTheDocument();
    expect(screen.getByText('TBD', { selector: 'strong' })).toBeInTheDocument();
  });

  it('collapses and expands one department, and every level at once', async () => {
    const user = await openTree();
    await pickManager(user, 3);
    const department = screen.getByRole('button', { name: /Department Configuration Services/ });

    await user.click(department);
    expect(department).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /Practice Finance/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getByRole('button', { name: /Practice Finance/ })).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.queryByRole('button', { name: /Practice Finance/ })).not.toBeInTheDocument();
  });

  it('starts a newly picked manager from the default and keeps the pick when switching views', async () => {
    const user = await openTree();
    await pickManager(user, 3);
    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    await pickManager(user, 2);
    expect(screen.getByRole('button', { name: /Department Design Services/ })).toHaveAttribute('aria-expanded', 'true');

    await pickManager(user, 3);
    expect(screen.getByRole('button', { name: /Department Configuration Services/ })).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: 'Cards' }));
    expect(screen.getByRole('heading', { name: 'ODC Project Manager 3: departments' })).toBeInTheDocument();
  });

  it('has no side pop-up for a department in the tree', async () => {
    const user = await openTree();
    await pickManager(user, 3);

    expect(screen.queryByRole('button', { name: 'Open Configuration Services' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows initials for a deployed Module Lead and TBD only for an unfilled seat', async () => {
    const user = await openTree();
    await pickManager(user, 3);

    const filled = screen.getByRole('list', { name: 'Teams of Asha Rao' }).closest('div');
    expect(within(filled).getByText('AR')).toBeInTheDocument();
    expect(within(filled).queryByText('TBD')).not.toBeInTheDocument();
    const unfilled = screen.getByRole('list', { name: 'Teams of the unfilled Module Lead seat' }).closest('div');
    expect(within(unfilled).getAllByText('TBD')).toHaveLength(2);
  });

  it('closes and reopens a practice without touching its department', async () => {
    const user = await openTree();
    await pickManager(user, 3);
    const practice = screen.getByRole('button', { name: /Practice Finance/ });

    await user.click(practice);
    expect(practice).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list', { name: 'Teams of Asha Rao' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Department Configuration Services/ })).toHaveAttribute('aria-expanded', 'true');

    await user.click(practice);
    expect(screen.getByRole('list', { name: 'Teams of Asha Rao' })).toBeInTheDocument();
  });

  it('keeps the open departments when the manager already shown is picked again', async () => {
    const user = await openTree();
    await pickManager(user, 3);
    await user.click(screen.getByRole('button', { name: /Practice Finance/ }));

    await pickManager(user, 3);

    expect(screen.getByRole('button', { name: /Practice Finance/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('names the controlled list only while it is open', async () => {
    const user = await openTree();
    await pickManager(user, 3);
    const department = screen.getByRole('button', { name: /Department Configuration Services/ });
    expect(department).toHaveAttribute('aria-controls', 'tree-DEPT-009');
    expect(document.getElementById('tree-DEPT-009')).not.toBeNull();

    await user.click(department);

    expect(department).not.toHaveAttribute('aria-controls');
  });

  it('marks a team with someone deployed differently from an empty one, and colours each practice', async () => {
    const user = await openTree();
    await pickManager(user, 3);

    expect(screen.getByText('TEAM-001').closest('li').className).toMatch(/treeTeamFilled/);
    expect(screen.getByText('TEAM-002').closest('li').className).not.toMatch(/treeTeamFilled/);
    expect(screen.getByRole('button', { name: /Practice Finance/ }).querySelector('i')).toHaveStyle({ background: 'var(--color-practice-1)' });
    expect(screen.getByRole('button', { name: /Practice No practice/ }).querySelector('i')).toHaveStyle({ background: 'var(--color-practice-none)' });
  });

  it('opens and closes a department from the keyboard and keeps focus on it', async () => {
    const user = await openTree();
    await pickManager(user, 3);
    const department = screen.getByRole('button', { name: /Department Configuration Services/ });
    department.focus();

    await user.keyboard('{Enter}');
    expect(department).toHaveAttribute('aria-expanded', 'false');
    expect(department).toHaveFocus();

    await user.keyboard(' ');
    expect(department).toHaveAttribute('aria-expanded', 'true');
    expect(department).toHaveFocus();
  });
});

