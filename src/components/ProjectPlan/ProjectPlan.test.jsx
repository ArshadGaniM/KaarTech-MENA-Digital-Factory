import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectPlan from './ProjectPlan';
import { PLAN_GROUPS, PLAN_OWNER, PLAN_WEEK_COUNT } from '../../data/projectPlan';
import { fetchPlanActuals, savePlanActual, clearPlanActual } from '../../lib/projectPlanApi';

vi.mock('../../lib/projectPlanApi');

const TODAY = new Date(2026, 9, 31); // Week 18

beforeEach(() => {
  vi.clearAllMocks();
  fetchPlanActuals.mockResolvedValue({});
});

describe('ProjectPlan', () => {
  it('shows every group and activity exactly as in the locked plan', () => {
    render(<ProjectPlan today={TODAY} />);

    PLAN_GROUPS.forEach((group) => {
      expect(screen.getByRole('button', { name: new RegExp(group.activity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeInTheDocument();
    });
    expect(screen.getAllByText('Establish SOP Document')).toHaveLength(3);
    expect(screen.getAllByText('Implement a KPI-driven governance framework for Measruing Utilization')).toHaveLength(3);
  });

  it('shows the owner banner and its overall percentage', () => {
    render(<ProjectPlan today={TODAY} />);

    expect(screen.getByText(PLAN_OWNER.label)).toBeInTheDocument();
    expect(screen.getByText(`${PLAN_OWNER.poc}%`)).toBeInTheDocument();
  });

  it('has a month band and a column for each of the 65 weeks', () => {
    render(<ProjectPlan today={TODAY} />);

    // July and Aug/Sep appear twice because the sheet runs for more than a year.
    expect(screen.getAllByRole('columnheader', { name: 'July' })).toHaveLength(2);
    expect(screen.getAllByRole('columnheader', { name: 'March' })).toHaveLength(1);
    expect(screen.getByText('Week 1 · 1 Jul')).toBeInTheDocument();
    expect(screen.getByText(`Week ${PLAN_WEEK_COUNT} · 22 Sept`)).toBeInTheDocument();
    expect(screen.getAllByText(/^Week \d+ · /)).toHaveLength(PLAN_WEEK_COUNT);
  });

  it('shades exactly the weeks of an activity\'s bar', () => {
    render(<ProjectPlan today={TODAY} />);

    const row = screen.getAllByText('Identify resources for the ODC from the existing account pools')[0].closest('tr');
    const shaded = within(row).getAllByTitle(/Completed: Week 1 to Week 4/);
    expect(shaded).toHaveLength(4);
  });

  it('lists the three status colours in a legend', () => {
    render(<ProjectPlan today={TODAY} />);

    const legend = screen.getByRole('list', { name: 'Colour key' });
    expect(within(legend).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Completed',
      'In Progress',
      'Yet to Start',
      'Percent complete',
      'Actual',
      'Today',
    ]);
  });

  it('collapses and expands a group without changing the plan', async () => {
    const user = userEvent.setup();
    render(<ProjectPlan today={TODAY} />);
    const toggle = screen.getByRole('button', { name: /Managed Services Project/ });
    expect(screen.getAllByText('Establish SOP Document')).toHaveLength(3);

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByText('Establish SOP Document')).toHaveLength(2);

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('Establish SOP Document')).toHaveLength(3);
  });

  it('marks today\'s week and says where today is', () => {
    render(<ProjectPlan today={TODAY} />);

    expect(screen.getByRole('status')).toHaveTextContent('Today is in Week 18 (28 Oct 2026 to 3 Nov 2026).');
    expect(screen.getByTitle('28 Oct 2026 to 3 Nov 2026')).toBeInTheDocument();
  });

  it('says the plan starts on 1 July 2026 when today is before it', () => {
    render(<ProjectPlan today={new Date(2026, 5, 1)} />);

    expect(screen.getByRole('status')).toHaveTextContent('The plan starts on 1 Jul 2026.');
    expect(screen.getByRole('status')).toHaveTextContent('Nothing is behind plan.');
  });

  it('flags the rows that are behind plan in Week 18', () => {
    render(<ProjectPlan today={TODAY} />);

    // 2.0a (planned Weeks 14 to 17, 0%) and 2.0d (planned from Week 16, not started) are behind.
    expect(screen.getByRole('status')).toHaveTextContent(/rows? (is|are) behind plan/);
    expect(screen.getAllByText('Behind plan').length).toBeGreaterThanOrEqual(2);
  });

  it('filters the activities by status and keeps the groups', async () => {
    const user = userEvent.setup();
    render(<ProjectPlan today={TODAY} />);

    await user.click(screen.getByRole('button', { name: 'Completed' }));

    expect(screen.getByRole('button', { name: 'Completed' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText('Identify resources for the ODC from the existing account pools')).toHaveLength(1);
    expect(screen.queryByText('Establish SOP Document')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Development & Enhancement Projects/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Managed Services Project/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getAllByText('Establish SOP Document')).toHaveLength(3);
  });

  it('draws an actual bar under the planned one and judges by the actual percentage', async () => {
    fetchPlanActuals.mockResolvedValue({
      '2a': { activityKey: '2a', actualStartWeek: 14, actualEndWeek: 18, actualPoc: 100 },
    });
    render(<ProjectPlan today={TODAY} />);

    const row = screen.getAllByText('Identify resources for the ODC from the existing account pools')[1].closest('tr');
    await waitFor(() => expect(within(row).getAllByTitle('Actual: Week 14 to Week 18')).toHaveLength(5));
    expect(within(row).getByText('100%', { selector: 'span' })).toBeInTheDocument();
    expect(within(row).queryByText('Behind plan')).not.toBeInTheDocument();
  });

  it('records, edits and clears an actual without touching the plan', async () => {
    const user = userEvent.setup();
    savePlanActual.mockResolvedValue({});
    clearPlanActual.mockResolvedValue();
    fetchPlanActuals.mockResolvedValueOnce({}).mockResolvedValue({ '1e': { activityKey: '1e', actualStartWeek: 9, actualEndWeek: null, actualPoc: 30 } });
    render(<ProjectPlan today={TODAY} />);

    const row = screen.getAllByText('Adopt the existing projects and run them under the revised structure')[0].closest('tr');
    await user.click(within(row).getByRole('button', { name: 'Record actual' }));
    await user.type(screen.getByLabelText('Actual start week'), '9');
    await user.clear(screen.getByLabelText('Actual percent complete'));
    await user.type(screen.getByLabelText('Actual percent complete'), '30');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(savePlanActual).toHaveBeenCalledWith('1e', { actualStartWeek: 9, actualEndWeek: null, actualPoc: 30 }));
    await waitFor(() => expect(within(row).getByRole('button', { name: 'Edit actual' })).toBeInTheDocument());

    await user.click(within(row).getByRole('button', { name: 'Edit actual' }));
    await user.click(screen.getByRole('button', { name: 'Clear actual' }));
    await waitFor(() => expect(clearPlanActual).toHaveBeenCalledWith('1e'));
  });

  it('shows the backend\'s reason in the dialog when a save is refused', async () => {
    const user = userEvent.setup();
    savePlanActual.mockRejectedValue(Object.assign(new Error('Request failed validation.'), { details: { actualPoc: 'actualPoc must be a whole number from 0 to 100.' } }));
    render(<ProjectPlan today={TODAY} />);

    await user.click(screen.getAllByRole('button', { name: 'Record actual' })[0]);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('actualPoc must be a whole number from 0 to 100.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('says so when the actual progress cannot be loaded, and still shows the plan', async () => {
    fetchPlanActuals.mockRejectedValue(new Error('Backend unreachable'));
    render(<ProjectPlan today={TODAY} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The actual progress could not be loaded: Backend unreachable');
    expect(screen.getAllByText('Establish SOP Document')).toHaveLength(3);
  });
});
