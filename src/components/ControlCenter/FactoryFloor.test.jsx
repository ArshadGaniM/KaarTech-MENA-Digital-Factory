import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import FactoryFloor from './FactoryFloor';

const team = (code, competencies, practiceName = null) => ({
  code,
  name: `Team ${code}`,
  competencies,
  practiceName,
  memberCount: 1,
  seatCount: 2,
  vacantSeatCount: 1,
  availableHours: 320,
  allocatedHours: 160,
  utilizedHours: 160,
  utilizationPercent: 100,
  status: 'full',
});

const renderFloor = (teams) =>
  render(
    <ol>
      <FactoryFloor name="Development" level={3} teams={teams} onOpenTeam={() => {}} />
    </ol>
  );

describe('FactoryFloor', () => {
  it('shows the department name, floor number and team count', () => {
    renderFloor([team('T-1', ['FICO']), team('T-2', ['FICO'])]);
    expect(screen.getByRole('heading', { name: 'Development' })).toBeInTheDocument();
    expect(screen.getByText('F3')).toBeInTheDocument();
    expect(screen.getByText('2 teams')).toBeInTheDocument();
  });

  it('uses the singular for one team', () => {
    renderFloor([team('T-1', ['FICO'])]);
    expect(screen.getByText('1 team')).toBeInTheDocument();
  });

  it('says so when a floor has no teams', () => {
    renderFloor([]);
    expect(screen.getByText('No teams yet')).toBeInTheDocument();
    expect(screen.getByText('0 teams')).toBeInTheDocument();
  });

  it('groups consecutive teams of one practice, in the order they arrive, and puts teams without one in their own group', () => {
    renderFloor([
      team('T-1', ['FICO'], 'Finance'),
      team('T-2', ['FM'], 'Finance'),
      team('T-3', ['MM'], 'Logistics Buy Side'),
      team('T-4', []),
    ]);

    const headings = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent);
    expect(headings).toEqual(['Finance', 'Logistics Buy Side', 'No practice']);
    expect(screen.getByRole('list', { name: 'Development, Finance teams' }).children).toHaveLength(2);
  });

  it('keeps the order of the teams inside a practice as sent, so the soonest-free team stays first', () => {
    renderFloor([team('T-9', ['FICO'], 'Finance'), team('T-2', ['FICO'], 'Finance'), team('T-5', ['FICO'], 'Finance')]);
    const cards = screen.getByRole('list', { name: 'Development, Finance teams' }).children;
    expect([...cards].map((li) => li.textContent.match(/T-\d/)[0])).toEqual(['T-9', 'T-2', 'T-5']);
  });

  it('does not group by competency any more: two competencies of one practice share a group', () => {
    renderFloor([team('T-1', ['FICO'], 'Finance'), team('T-2', ['FM'], 'Finance')]);
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(1);
  });
});
