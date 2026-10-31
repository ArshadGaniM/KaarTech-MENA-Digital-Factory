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

  it('shows three competencies and counts the rest', () => {
    renderCard();
    expect(screen.getByText('FICO')).toBeInTheDocument();
    expect(screen.getByText('SD')).toBeInTheDocument();
    expect(screen.queryByText('PP')).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
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
});
