import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectPlan from './ProjectPlan';
import { PLAN_GROUPS, PLAN_OWNER, PLAN_WEEK_COUNT } from '../../data/projectPlan';

describe('ProjectPlan', () => {
  it('shows every group and activity exactly as in the locked plan', () => {
    render(<ProjectPlan />);

    PLAN_GROUPS.forEach((group) => {
      expect(screen.getByRole('button', { name: new RegExp(group.activity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeInTheDocument();
    });
    expect(screen.getAllByText('Establish SOP Document')).toHaveLength(3);
    expect(screen.getAllByText('Implement a KPI-driven governance framework for Measruing Utilization')).toHaveLength(3);
  });

  it('shows the owner banner and its overall percentage', () => {
    render(<ProjectPlan />);

    expect(screen.getByText(PLAN_OWNER.label)).toBeInTheDocument();
    expect(screen.getByText(`${PLAN_OWNER.poc}%`)).toBeInTheDocument();
  });

  it('has a month band and a column for each of the 65 weeks', () => {
    render(<ProjectPlan />);

    // July and Aug/Sep appear twice because the sheet runs for more than a year.
    expect(screen.getAllByRole('columnheader', { name: 'July' })).toHaveLength(2);
    expect(screen.getAllByRole('columnheader', { name: 'March' })).toHaveLength(1);
    expect(screen.getByText('Week 1')).toBeInTheDocument();
    expect(screen.getByText(`Week ${PLAN_WEEK_COUNT}`)).toBeInTheDocument();
    expect(screen.getAllByText('Week', { exact: false })).toHaveLength(PLAN_WEEK_COUNT);
  });

  it('shades exactly the weeks of an activity\'s bar', () => {
    render(<ProjectPlan />);

    const row = screen.getAllByText('Identify resources for the ODC from the existing account pools')[0].closest('tr');
    const shaded = within(row).getAllByTitle(/Completed: Week 1 to Week 4/);
    expect(shaded).toHaveLength(4);
  });

  it('lists the three status colours in a legend', () => {
    render(<ProjectPlan />);

    const legend = screen.getByRole('list', { name: 'Status colours' });
    expect(within(legend).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Completed',
      'In Progress',
      'Yet to Start',
    ]);
  });

  it('collapses and expands a group without changing the plan', async () => {
    const user = userEvent.setup();
    render(<ProjectPlan />);
    const toggle = screen.getByRole('button', { name: /Managed Services Project/ });
    expect(screen.getAllByText('Establish SOP Document')).toHaveLength(3);

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByText('Establish SOP Document')).toHaveLength(2);

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('Establish SOP Document')).toHaveLength(3);
  });
});
