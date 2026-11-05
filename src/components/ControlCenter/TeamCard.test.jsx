import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TeamCard from './TeamCard';

const base = {
  code: 'TEAM-007',
  name: 'Gamma',
  competencies: ['FICO', 'MM', 'SD', 'PP', 'QM'],
  memberCount: 1,
  seatCount: 4,
  vacantSeatCount: 3,
  availableHours: 640,
  allocatedHours: 160,
  utilizedHours: 160,
  utilizationPercent: 100,
  status: 'full',
};

const renderCard = (team = base, onOpen = () => {}) =>
  render(
    <ul>
      <TeamCard team={team} onOpen={onOpen} />
    </ul>
  );

describe('TeamCard', () => {
  it('shows the name, code, members, seats, the three hour figures and the utilization', () => {
    renderCard();
    const card = screen.getByRole('button', { name: /Gamma, TEAM-007/ });
    expect(card).toHaveTextContent('Gamma');
    expect(card).toHaveTextContent('TEAM-007');
    expect(card).toHaveTextContent('1 member');
    expect(card).toHaveTextContent('4 seats, 3 vacant');
    expect(card).toHaveTextContent('Available640h');
    expect(card).toHaveTextContent('Allocated160h');
    expect(card).toHaveTextContent('Utilized160h');
    expect(card).toHaveTextContent('100%');
  });

  it('keeps the competencies on one line and counts the rest', () => {
    renderCard();
    expect(screen.getByText('FICO')).toBeInTheDocument();
    expect(screen.getByText('MM')).toBeInTheDocument();
    expect(screen.queryByText('PP')).not.toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('lists every competency in a tooltip the card points to, so it shows on hover and keyboard focus', () => {
    renderCard();
    const card = screen.getByRole('button', { name: /Gamma, TEAM-007/ });
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('FICO, MM, SD, PP, QM');
    expect(card).toHaveAttribute('aria-describedby', tip.id);
  });

  it('shows every competency and no "+N" or tooltip when they all fit', () => {
    renderCard({ ...base, competencies: ['FICO', 'MM'] });
    expect(screen.getByText('FICO')).toBeInTheDocument();
    expect(screen.getByText('MM')).toBeInTheDocument();
    expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gamma, TEAM-007/ })).not.toHaveAttribute('aria-describedby');
  });

  it('always shows at least the first competency, even a long one, and counts the rest', () => {
    renderCard({ ...base, competencies: ['A very long competency name indeed', 'MM'] });
    expect(screen.getByText('A very long competency name indeed')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('says so when a team has no competency', () => {
    renderCard({ ...base, competencies: [] });
    expect(screen.getByText('No competency')).toBeInTheDocument();
  });

  it.each([
    ['full', 'Fully utilized'],
    ['partial', 'Partly utilized'],
    ['unused', 'Not utilized'],
    ['unstaffed', 'No one deployed'],
  ])('names the %s state in words, not only by color', (status, label) => {
    renderCard({ ...base, status });
    expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
  });

  it('opens the team on click', async () => {
    const onOpen = vi.fn();
    renderCard(base, onOpen);
    await userEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledWith('TEAM-007');
  });

  it('shows the assignment end date and the Allocated Team Monthly Cost', () => {
    renderCard({ ...base, assignmentEndDate: '2026-12-05', allocatedTeamCost: 2375 });
    const card = screen.getByRole('button', { name: /Gamma, TEAM-007/ });
    expect(card).toHaveTextContent('Assignment ends5 Dec 2026');
    expect(card).toHaveTextContent('Allocated Team Monthly Cost$2,375.00');
  });

  it('says there is no current assignment, and shows a zero cost, for a team without one', () => {
    renderCard({ ...base, assignmentEndDate: null, allocatedTeamCost: 0 });
    const card = screen.getByRole('button', { name: /Gamma, TEAM-007/ });
    expect(card).toHaveTextContent('No current assignment');
    expect(card).toHaveTextContent('Allocated Team Monthly Cost$0.00');
  });

  it('says how many people were costed at the default rate, and says nothing when none were', () => {
    renderCard({ ...base, defaultedCostCount: 2 });
    expect(screen.getByRole('button', { name: /Gamma, TEAM-007/ })).toHaveTextContent('2 at the default rate');
  });

  it('does not mention the default rate when nobody was costed that way', () => {
    renderCard({ ...base, defaultedCostCount: 0 });
    expect(screen.getByRole('button', { name: /Gamma, TEAM-007/ })).not.toHaveTextContent('default rate');
  });
});
