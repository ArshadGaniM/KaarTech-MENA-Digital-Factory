import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import OrgHierarchy from './OrgHierarchy';

const structure = {
  deliveryManager: { title: 'ODC Delivery Manager', name: 'Mohammed Ibrahim S' },
  totalSeats: 7,
  filledSeats: 1,
  projectManagers: [
    {
      id: 'pm-5',
      title: 'ODC Project Manager 5',
      name: 'Yasam Panidhar',
      seats: 7,
      filled: 1,
      departments: [
        {
          code: 'DEPT-004',
          name: 'Quality Assurance & Testing Services',
          floorNumber: 7,
          seats: 7,
          filled: 1,
          teamCount: 1,
          practices: [
            {
              key: 'DEPT-004/NO-PRACTICE',
              code: 'NO-PRACTICE',
              name: 'No practice',
              seats: 7,
              filled: 1,
              teamCount: 1,
              moduleLeads: [{ key: 'DEPT-004/NO-PRACTICE/unallocated', name: 'TBD', isUnallocated: true, teams: [{ code: 'TEAM-085', name: 'TEAM-085', seats: 7, filled: 1 }] }],
            },
          ],
        },
      ],
    },
  ],
};

const setup = () => {
  const onOpenTeam = vi.fn();
  render(<OrgHierarchy structure={structure} onOpenTeam={onOpenTeam} />);
  return { user: userEvent.setup(), onOpenTeam };
};
const tree = () => screen.getByRole('list', { name: 'Organization tree' });

describe('OrgHierarchy', () => {
  it('starts with the Delivery Manager and the Project Managers showing, nothing below them', () => {
    setup();
    expect(within(tree()).getByRole('button', { name: /ODC Delivery Manager/ })).toHaveAttribute('aria-expanded', 'true');
    const manager = within(tree()).getByRole('button', { name: /ODC Project Manager 5/ });
    expect(manager).toHaveTextContent('Yasam Panidhar');
    expect(manager).toHaveTextContent('1/7 seats · 1 department');
    expect(manager).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Quality Assurance & Testing Services')).not.toBeInTheDocument();
  });

  it('opens and closes one branch with the box, level by level, down to the team', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /ODC Project Manager 5/ }));
    await user.click(screen.getByRole('button', { name: /Quality Assurance & Testing Services/ }));
    await user.click(screen.getByRole('button', { name: /No practice/ }));
    await user.click(screen.getByRole('button', { name: /Module Lead TBD/ }));
    expect(screen.getByRole('button', { name: 'TEAM-085, TEAM-085. Open details' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ODC Project Manager 5/ }));
    expect(screen.queryByText('Quality Assurance & Testing Services')).not.toBeInTheDocument();
  });

  it('shows every level at once with Expand all and goes back to two levels with Collapse all', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getByText('Quality Assurance & Testing Services')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'TEAM-085, TEAM-085. Open details' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.queryByText('Quality Assurance & Testing Services')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ODC Project Manager 5/ })).toBeInTheDocument();
  });

  it('opens the team popup from a team box', async () => {
    const { user, onOpenTeam } = setup();
    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    await user.click(screen.getByRole('button', { name: 'TEAM-085, TEAM-085. Open details' }));
    expect(onOpenTeam).toHaveBeenCalledWith('TEAM-085');
  });

  it('cannot open or close a box with nothing under it, such as a team', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getByRole('button', { name: 'TEAM-085, TEAM-085. Open details' })).not.toHaveAttribute('aria-expanded');
  });
});
