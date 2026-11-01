import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Charter from './Charter';
import { SECTIONS } from './charterSections';
import { fetchPlanActuals } from '../../lib/initiativePlanApi';

vi.mock('../../lib/initiativePlanApi');

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

  it('draws the sponsor, then the three owners side by side, then the three track owners under all of them', async () => {
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
    const deliverables = screen.getByRole('table', { name: 'Deliverables and milestones' });
    expect(within(deliverables).getAllByRole('row')).toHaveLength(1 + 3 * 4);
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
});
