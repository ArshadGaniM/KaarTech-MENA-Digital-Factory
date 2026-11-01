import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Charter from './Charter';
import { SECTIONS } from './charterSections';
import { fetchPlanActuals } from '../../lib/initiativePlanApi';
import { fetchServices } from '../../lib/servicesApi';
import { PLAN_GROUPS } from '../../data/initiativePlan';

vi.mock('../../lib/initiativePlanApi');
vi.mock('../../lib/servicesApi');

const SERVICES = [
  { code: 'DEPT-001', title: 'Digital/AI Transformation Consulting Services', description: '' },
  { code: 'DEPT-002', title: 'Design Services', description: '' },
  { code: 'DEPT-013', title: 'L3 Operational Support Services', description: '' },
];

beforeEach(() => {
  vi.clearAllMocks();
  fetchServices.mockResolvedValue(SERVICES);
});

describe('Charter', () => {
  it('lists its headings in order, with the Initiative Plan as one of them', () => {
    render(<Charter />);

    const tabs = within(screen.getByRole('tablist', { name: 'Charter headings' })).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent.replace(/^\d+/, ''))).toEqual(SECTIONS.map((section) => section.title));
    expect(SECTIONS.map((section) => section.title)).toContain('Initiative Plan');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
  });

  it('shows the matching content when a heading is clicked', async () => {
    const user = userEvent.setup();
    render(<Charter />);

    await user.click(screen.getByRole('tab', { name: /Stakeholder Matrix/ }));

    expect(screen.getByRole('tab', { name: /Stakeholder Matrix/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('table', { name: 'Stakeholder matrix' })).toBeInTheDocument();
  });

  it('lists 30 stakeholders with name, designation and initiative role, in the owner\'s order', async () => {
    const user = userEvent.setup();
    render(<Charter />);

    await user.click(screen.getByRole('tab', { name: /Stakeholder Matrix/ }));
    const table = screen.getByRole('table', { name: 'Stakeholder matrix' });
    const rows = within(table).getAllByRole('row');

    expect(within(rows[0]).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Name', 'Designation', 'Initiative role']);
    expect(rows).toHaveLength(1 + 30);
    const cells = (row) => within(row).getAllByRole('cell').map((cell) => cell.textContent);
    expect(cells(rows[1])).toEqual(['Irfan Ahmed', 'COO MENA', 'Initiative Sponsor']);
    expect(cells(rows[2])).toEqual(['Arshad Gani M', 'Delivery Manager - Onsite, Platinum, MENA', 'Initiative Owner']);
    expect(cells(rows[18])).toEqual(['Faizan R', 'Group Project Manager, Managed Services Projects, Platinum, MENA', 'Initiative Track Owner (Managed Services Projects)']);
  });

  it('gives each person the role the owner named', async () => {
    const user = userEvent.setup();
    render(<Charter />);

    await user.click(screen.getByRole('tab', { name: /Stakeholder Matrix/ }));
    const table = screen.getByRole('table', { name: 'Stakeholder matrix' });
    const roleOf = (name) => within(within(table).getByRole('cell', { name }).closest('tr')).getAllByRole('cell')[2].textContent;

    expect(roleOf('Arshad Gani M')).toBe('Initiative Owner');
    expect(roleOf('Mohammed Ibrahim S')).toBe('Initiative Owner');
    expect(roleOf('Srinivasan R')).toBe('Initiative Owner');
    expect(roleOf('Rushikesh Subhash Nikam')).toBe('Initiative Track Owner (Development & Enhancement Projects)');
    expect(roleOf('Surya M')).toBe('Initiative Track Owner (SAP Implementation & Rollout Projects)');
    expect(roleOf('Dinesh V')).toBe('Initiative Member');
    expect(roleOf('Shravan Balaji')).toBe('Initiative Member');
  });

  it('has no Initiative Co-owner role left, only three Initiative Owners', async () => {
    const user = userEvent.setup();
    render(<Charter />);

    await user.click(screen.getByRole('tab', { name: /Stakeholder Matrix/ }));
    const table = screen.getByRole('table', { name: 'Stakeholder matrix' });
    const roles = within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[2].textContent);

    expect(roles.filter((role) => role === 'Initiative Owner')).toHaveLength(3);
    expect(roles.filter((role) => /^Initiative Co-owner/.test(role))).toHaveLength(0);
  });

  it('adds twelve empty track co-owner rows, one per vertical under each track, with the vertical in the role', async () => {
    const user = userEvent.setup();
    render(<Charter />);

    await user.click(screen.getByRole('tab', { name: /Stakeholder Matrix/ }));
    const table = screen.getByRole('table', { name: 'Stakeholder matrix' });
    const open = within(table).getAllByRole('row').filter((row) => row.textContent.includes('Initiative Track Co-owner'));

    expect(open).toHaveLength(12);
    for (const row of open) {
      const cells = within(row).getAllByRole('cell');
      expect(cells[0]).toBeEmptyDOMElement();
      expect(cells[1]).toBeEmptyDOMElement();
    }
    const roleOfRow = (row) => within(row).getAllByRole('cell')[2].textContent;
    expect(roleOfRow(open[0])).toBe('Initiative Track Co-owner (Development & Enhancement Projects in Platinum Vertical)');
    expect(roleOfRow(open[1])).toBe('Initiative Track Co-owner (Development & Enhancement Projects in Services Vertical)');
    expect(roleOfRow(open[2])).toBe('Initiative Track Co-owner (Development & Enhancement Projects in EOG Vertical)');
    expect(roleOfRow(open[3])).toBe('Initiative Track Co-owner (Development & Enhancement Projects in A&D Vertical)');
    expect(roleOfRow(open[4])).toBe('Initiative Track Co-owner (SAP Implementation & Rollout Projects in Platinum Vertical)');
    expect(roleOfRow(open[11])).toBe('Initiative Track Co-owner (Managed Services Projects in A&D Vertical)');
    expect(new Set(open.map(roleOfRow)).size).toBe(12);
  });

  it('shows the three initiative owners in one overview line, beside the locked plan owner', () => {
    render(<Charter />);

    const glance = screen.getByRole('table', { name: 'Initiative at a glance' });
    expect(within(glance).getByText('BU / Operations / Sales Director')).toBeInTheDocument();
    expect(within(within(glance).getByText('Initiative owners').closest('tr')).getAllByRole('cell')[1]).toHaveTextContent('Arshad Gani M, Mohammed Ibrahim S, Srinivasan R');
    expect(within(glance).queryByText('Initiative owner')).not.toBeInTheDocument();
    expect(within(glance).queryByText('Initiative co-owners')).not.toBeInTheDocument();
    expect(within(glance).queryByText(/Irfan/)).not.toBeInTheDocument();
  });

  it('draws the org structure right after the stakeholder matrix, without the members', async () => {
    const user = userEvent.setup();
    render(<Charter />);
    const titles = SECTIONS.map((section) => section.title);
    expect(titles.indexOf('Initiative Org Structure')).toBe(titles.indexOf('Stakeholder Matrix') + 1);

    await user.click(screen.getByRole('tab', { name: /Initiative Org Structure/ }));
    const chart = screen.getByRole('region', { name: 'Initiative org structure diagram' });

    for (const name of ['Irfan Ahmed', 'Arshad Gani M', 'Mohammed Ibrahim S', 'Srinivasan R', 'Rushikesh Subhash Nikam', 'Surya M', 'Faizan R']) {
      expect(within(chart).getByText(name)).toBeInTheDocument();
    }
    expect(within(chart).queryByText('Dinesh V')).not.toBeInTheDocument();
    expect(within(chart).queryByText('Initiative Member')).not.toBeInTheDocument();
    expect(within(chart).getAllByText('Initiative Track Co-owner')).toHaveLength(12);
    expect(within(chart).getAllByText('Initiative Owner')).toHaveLength(3);
    expect(within(chart).queryByText('Initiative Co-owner')).not.toBeInTheDocument();
  });

  it('lists the owners under the sponsor and the track owners in a separate list after them, not inside any owner', async () => {
    const user = userEvent.setup();
    render(<Charter />);

    await user.click(screen.getByRole('tab', { name: /Initiative Org Structure/ }));
    const chart = screen.getByRole('region', { name: 'Initiative org structure diagram' });
    const itemOf = (name) => within(chart).getByText(name).closest('li');

    const owners = within(chart).getByRole('list', { name: 'Initiative owners' });
    expect(within(owners).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Arshad Gani MInitiative Owner',
      'Mohammed Ibrahim SInitiative Owner',
      'Srinivasan RInitiative Owner',
    ]);
    expect(within(itemOf('Irfan Ahmed')).getByRole('list', { name: 'Initiative owners' })).toBe(owners);

    // The track owners are not inside any one owner: they hang from the owners together.
    const tracks = within(chart).getByRole('list', { name: 'Track owners, reporting to the initiative owners together' });
    for (const name of ['Rushikesh Subhash Nikam', 'Surya M', 'Faizan R']) {
      expect(within(tracks).getByText(name)).toBeInTheDocument();
      expect(within(owners).queryByText(name)).not.toBeInTheDocument();
    }
    expect(owners.compareDocumentPosition(tracks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(itemOf('Irfan Ahmed')).not.toContainElement(tracks);
  });

  it('gives each track owner four open co-owner boxes, named by vertical', async () => {
    const user = userEvent.setup();
    render(<Charter />);

    await user.click(screen.getByRole('tab', { name: /Initiative Org Structure/ }));
    const chart = screen.getByRole('region', { name: 'Initiative org structure diagram' });

    const faizan = within(chart).getByRole('list', { name: 'Co-owners of Managed Services Projects' });
    expect(within(faizan).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Platinum VerticalInitiative Track Co-owner',
      'Services VerticalInitiative Track Co-owner',
      'EOG VerticalInitiative Track Co-owner',
      'A&D VerticalInitiative Track Co-owner',
    ]);
  });

  it('shows the locked plan, read-only, under the Initiative Plan heading', async () => {
    fetchPlanActuals.mockResolvedValue({});
    const user = userEvent.setup();
    render(<Charter />);

    await user.click(screen.getByRole('tab', { name: /Initiative Plan/ }));

    expect(screen.getAllByText('Establish SOP Document')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /actual/i })).not.toBeInTheDocument();
  });

  it('derives the scope and deliverable dates from the plan', async () => {
    const user = userEvent.setup();
    render(<Charter />);

    await user.click(screen.getByRole('tab', { name: /Scope/ }));
    const scope = screen.getByRole('table', { name: 'Streams in scope' });
    expect(within(scope).getByText('Weeks 27 to 65')).toBeInTheDocument();
    expect(within(scope).getByText('30 Dec 2026 to 28 Sept 2027')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Deliverables/ }));
    const milestones = screen.getByRole('table', { name: 'Milestones' });
    expect(within(milestones).getAllByRole('row')).toHaveLength(1 + 3 * 4);
  });

  it('says "To be confirmed" for what the owner has not given, instead of inventing it', async () => {
    const user = userEvent.setup();
    render(<Charter />);

    await user.click(screen.getByRole('tab', { name: /Governance/ }));

    const open = screen.getByRole('table', { name: 'Governance details still open' });
    expect(within(open).getAllByText('To be confirmed')).toHaveLength(3);
  });

  it('shows every heading without an error', async () => {
    fetchPlanActuals.mockResolvedValue({});
    const user = userEvent.setup();
    render(<Charter />);

    for (const section of SECTIONS) {
      await user.click(screen.getByRole('tab', { name: new RegExp(section.title) }));
      expect(screen.getByRole('heading', { level: 3, name: section.title })).toBeInTheDocument();
    }
  });

  it('moves between headings with the arrow keys, Home and End, and wraps round', async () => {
    const user = userEvent.setup();
    render(<Charter />);
    await user.tab();
    expect(screen.getByRole('tab', { name: /Overview/ })).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('tab', { name: /Objectives/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Objectives/ })).toHaveFocus();

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /Assumptions/ })).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('tab', { name: /Overview/ })).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('tab', { name: /Assumptions/ })).toHaveFocus();
  });

  describe('Deliverables and Milestones', () => {
    const open = async () => {
      const user = userEvent.setup();
      render(<Charter />);
      await user.click(screen.getByRole('tab', { name: /Deliverables and Milestones/ }));
      return user;
    };
    const cellsOf = (row) => within(row).getAllByRole('cell').map((cell) => cell.textContent);

    it('shows the milestones with Stream, Milestone, Due date and Status, and no week column', async () => {
      await open();
      const table = screen.getByRole('table', { name: 'Milestones' });

      expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Stream', 'Milestone', 'Due date', 'Status']);
      const rows = within(table).getAllByRole('row').slice(1);
      expect(cellsOf(rows[0])).toEqual(['Development & Enhancement Projects', 'KPI governance framework for utilization', '8 Dec 2026', 'Yet to Start']);
      expect(table).not.toHaveTextContent(/Week \d/);
    });

    it('gives each milestone the status of its step in the plan', async () => {
      await open();
      const rows = within(screen.getByRole('table', { name: 'Milestones' })).getAllByRole('row').slice(1);
      const expected = PLAN_GROUPS.flatMap((group) => ['f', 'g', 'h', 'i'].map((slNo) => group.items.find((item) => item.slNo === slNo).status));

      expect(rows.map((row) => cellsOf(row)[3])).toEqual(expected);
    });

    it('follows the plan when a step has another status, never a fixed one', async () => {
      const original = PLAN_GROUPS[0].items.find((item) => item.slNo === 'g');
      expect(['Yet to Start', 'In Progress', 'Completed']).toContain(original.status);
      await open();
      const row = within(screen.getByRole('table', { name: 'Milestones' })).getAllByRole('row')[2];

      expect(cellsOf(row)[1]).toBe('SOP document');
      expect(cellsOf(row)[3]).toBe(original.status);
    });

    it('lists a deliverables table below the milestones, with Owner, Due date and Status', async () => {
      await open();
      const milestones = screen.getByRole('table', { name: 'Milestones' });
      const deliverables = await screen.findByRole('table', { name: 'Deliverables' });

      expect(milestones.compareDocumentPosition(deliverables) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(within(deliverables).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Deliverable name', 'Owner', 'Due date', 'Status']);
    });

    it('has one SOP document row per service, in the services order, due 31 Dec 2026, with the owner given for it, Yet to Start', async () => {
      await open();
      const deliverables = await screen.findByRole('table', { name: 'Deliverables' });
      await within(deliverables).findByText('SOP document: Design Services');
      const rows = within(deliverables).getAllByRole('row').slice(1).map(cellsOf);

      expect(rows.slice(0, 3)).toEqual([
        ['SOP document: Digital/AI Transformation Consulting Services', 'Surya M', '31 Dec 2026', 'Yet to Start'],
        ['SOP document: Design Services', 'Surya M', '31 Dec 2026', 'Yet to Start'],
        ['SOP document: L3 Operational Support Services', 'Faizan R', '31 Dec 2026', 'Yet to Start'],
      ]);
    });

    it('says so when there are no services, instead of leaving the SOP rows out without a word', async () => {
      fetchServices.mockResolvedValue([]);
      await open();

      expect(await screen.findByText(/No services are listed yet/)).toBeInTheDocument();
      expect(within(screen.getByRole('table', { name: 'Deliverables' })).getAllByRole('row')).toHaveLength(1 + 3);
    });

    it('says it is loading the SOP rows while the services are on their way', async () => {
      fetchServices.mockReturnValue(new Promise(() => {}));
      await open();

      expect(screen.getByRole('status')).toHaveTextContent('Loading the SOP documents');
    });

    it('adds a deliverable row when a service is added, with the owner To be confirmed until one is given', async () => {
      fetchServices.mockResolvedValue([...SERVICES, { code: 'DEPT-099', title: 'New Services', description: '' }]);
      await open();

      const row = (await screen.findByText('SOP document: New Services')).closest('tr');
      expect(cellsOf(row)).toEqual(['SOP document: New Services', 'To be confirmed', '31 Dec 2026', 'Yet to Start']);
    });

    it('has one rollout strategy row per track, due 28 Feb 2027, after the SOP rows', async () => {
      await open();
      const deliverables = await screen.findByRole('table', { name: 'Deliverables' });
      await within(deliverables).findByText('SOP document: Design Services');
      const rows = within(deliverables).getAllByRole('row').slice(1).map(cellsOf);
      const rollout = rows.filter((row) => row[0].startsWith('Rollout strategy document'));

      expect(rollout).toEqual([
        ['Rollout strategy document for all MENA projects (Development & Enhancement Projects)', 'Rushikesh Subhash Nikam', '28 Feb 2027', 'Yet to Start'],
        ['Rollout strategy document for all MENA projects (SAP Implementation & Rollout Projects)', 'Surya M', '28 Feb 2027', 'Yet to Start'],
        ['Rollout strategy document for all MENA projects (Managed Services Project)', 'Faizan R', '28 Feb 2027', 'Yet to Start'],
      ]);
      expect(rows.slice(-3).map((row) => row[0])).toEqual(rollout.map((row) => row[0]));
    });

    it('says so, and can try again, when the services cannot be loaded, while the milestones and rollout rows still show', async () => {
      fetchServices.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(SERVICES);
      const user = await open();

      expect(await screen.findByRole('alert')).toHaveTextContent('could not be listed');
      expect(within(screen.getByRole('table', { name: 'Deliverables' })).getAllByRole('row')).toHaveLength(1 + 3);

      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('SOP document: Design Services')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
