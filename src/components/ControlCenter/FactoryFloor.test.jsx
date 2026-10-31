import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import FactoryFloor from './FactoryFloor';

const team = (code, competencies) => ({
  code,
  name: `Team ${code}`,
  competencies,
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

  it('groups consecutive teams of one competency and puts teams without one in their own group', () => {
    renderFloor([team('T-1', ['ABAP']), team('T-2', ['ABAP']), team('T-3', ['FICO']), team('T-4', [])]);

    expect(screen.getByRole('heading', { name: 'ABAP', level: 4 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'FICO', level: 4 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No competency', level: 4 })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Development, ABAP teams' }).children).toHaveLength(2);
  });
});
