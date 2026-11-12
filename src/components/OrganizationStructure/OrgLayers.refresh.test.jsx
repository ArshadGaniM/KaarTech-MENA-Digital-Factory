import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildOrgStructure } from '../../lib/orgStructure';
import { useOrganizationStructure } from '../../hooks/useOrganizationStructure';
import OrganizationStructure from './OrganizationStructure';

vi.mock('../../hooks/useOrganizationStructure');

const live = { markedDeleted: 'No' };
const base = {
  departments: [
    { code: 'DEPT-009', name: 'Configuration Services', floorNumber: 9, ...live },
    { code: 'DEPT-002', name: 'Design Services', floorNumber: 10, ...live },
  ],
  teams: [
    { code: 'TEAM-001', name: 'TEAM-001', departmentCode: 'DEPT-009', ...live },
    { code: 'TEAM-003', name: 'TEAM-003', departmentCode: 'DEPT-002', ...live },
  ],
  positions: [
    { code: 'POS-1', teamCode: 'TEAM-001', name: 'Consultant', competencies: null, ...live },
    { code: 'POS-7', teamCode: 'TEAM-003', name: 'Consultant', competencies: null, ...live },
  ],
  competencies: [],
  practices: [],
  deployments: [],
};
const build = (rows) => ({ data: buildOrgStructure(rows), isLoading: false, error: null });

beforeEach(() => vi.clearAllMocks());

describe('Organization Structure tree when live data changes', () => {
  it('keeps what the reader opened and closed when a refresh adds a team', async () => {
    const user = userEvent.setup();
    useOrganizationStructure.mockReturnValue(build(base));
    const { rerender } = render(<OrganizationStructure />);
    await user.click(screen.getByRole('button', { name: 'Layers' }));
    await user.click(screen.getByRole('button', { name: /Layer 2 ODC Project Manager 3 Name TBD/ }));
    const department = screen.getByRole('button', { name: /Department Configuration Services/ });
    await user.click(department);

    useOrganizationStructure.mockReturnValue(
      build({
        ...base,
        teams: [...base.teams, { code: 'TEAM-004', name: 'TEAM-004', departmentCode: 'DEPT-009', ...live }],
        positions: [...base.positions, { code: 'POS-9', teamCode: 'TEAM-004', name: 'Consultant', competencies: null, ...live }],
      })
    );
    rerender(<OrganizationStructure />);

    const after = screen.getByRole('button', { name: /Department Configuration Services/ });
    expect(after).toHaveAttribute('aria-expanded', 'false');
    expect(after).toHaveTextContent('2 teams');
  });

  it('falls back to the first manager, opened by default, when the picked manager disappears', async () => {
    const user = userEvent.setup();
    useOrganizationStructure.mockReturnValue(build(base));
    const { rerender } = render(<OrganizationStructure />);
    await user.click(screen.getByRole('button', { name: 'Layers' }));
    await user.click(screen.getByRole('button', { name: /Layer 2 ODC Project Manager 3 Name TBD/ }));

    useOrganizationStructure.mockReturnValue(build({ ...base, teams: base.teams.filter((team) => team.departmentCode !== 'DEPT-009') }));
    rerender(<OrganizationStructure />);

    expect(screen.getByRole('heading', { name: /ODC Project Manager 2 · 1 department/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Department Design Services/ })).toHaveAttribute('aria-expanded', 'true');
  });
});
