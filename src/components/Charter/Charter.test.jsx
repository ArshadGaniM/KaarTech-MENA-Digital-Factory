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

    expect(roleOf('Mohammed Ibrahim S')).toBe('Initiative Co-owner');
    expect(roleOf('Srinivasan R')).toBe('Initiative Co-owner');
    expect(roleOf('Rushikesh Subhash Nikam')).toBe('Initiative Track Owner (Development & Enhancement Projects)');
    expect(roleOf('Surya M')).toBe('Initiative Track Owner (SAP Implementation & Rollout Projects)');
    expect(roleOf('Dinesh V')).toBe('Initiative Member');
    expect(roleOf('Shravan Balaji')).toBe('Initiative Member');
  });

  it('adds twelve empty track co-owner rows, one per vertical under each track', async () => {
    const user = userEvent.setup();
    render(<Charter />);

    await user.click(screen.getByRole('tab', { name: /Stakeholder Matrix/ }));
    const table = screen.getByRole('table', { name: 'Stakeholder matrix' });
    const open = within(table).getAllByRole('row').filter((row) => row.textContent.includes('Initiative Track Co-owner'));

    expect(open).toHaveLength(12);
    for (const row of open) expect(within(row).getAllByRole('cell')[0]).toBeEmptyDOMElement();
    expect(open[0]).toHaveTextContent('PlatinumInitiative Track Co-owner (Development & Enhancement Projects)');
    expect(open[11]).toHaveTextContent('A&DInitiative Track Co-owner (Managed Services Projects)');
  });

  it('shows the initiative owner and co-owners in the overview, beside the locked plan owner', () => {
    render(<Charter />);

    const glance = screen.getByRole('table', { name: 'Initiative at a glance' });
    expect(within(glance).getByText('BU / Operations / Sales Director')).toBeInTheDocument();
    expect(within(within(glance).getByText('Initiative owner').closest('tr')).getAllByRole('cell')[1]).toHaveTextContent('Arshad Gani M');
    expect(within(within(glance).getByText('Initiative co-owners').closest('tr')).getAllByRole('cell')[1]).toHaveTextContent('Mohammed Ibrahim S, Srinivasan R');
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
  });

  it('nests the org structure: sponsor, then owner and co-owners, then track owners, then their four co-owner seats', async () => {
    const user = userEvent.setup();
    render(<Charter />);

    await user.click(screen.getByRole('tab', { name: /Initiative Org Structure/ }));
    const chart = screen.getByRole('region', { name: 'Initiative org structure diagram' });
    const itemOf = (name) => within(chart).getByText(name).closest('li');

    expect(within(itemOf('Irfan Ahmed')).getByText('Arshad Gani M')).toBeInTheDocument();
    expect(within(itemOf('Irfan Ahmed')).getByText('Srinivasan R')).toBeInTheDocument();
    expect(within(itemOf('Arshad Gani M')).getByText('Surya M')).toBeInTheDocument();
    expect(within(itemOf('Arshad Gani M')).queryByText('Srinivasan R')).not.toBeInTheDocument();
    const faizan = within(chart).getByRole('list', { name: 'Co-owners of Managed Services Projects' });
    expect(within(faizan).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'PlatinumInitiative Track Co-owner',
      'ServicesInitiative Track Co-owner',
      'EOGInitiative Track Co-owner',
      'A&DInitiative Track Co-owner',
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
