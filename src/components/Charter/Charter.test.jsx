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
    expect(screen.getByText('BU / Operations / Sales Director')).toBeInTheDocument();
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
});
