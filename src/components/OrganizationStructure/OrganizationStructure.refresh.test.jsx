import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildOrgStructure } from '../../lib/orgStructure';
import OrganizationStructure from './OrganizationStructure';

const empty = buildOrgStructure({
  departments: [],
  teams: [],
  positions: [],
  competencies: [],
  practices: [],
  deployments: [],
});

vi.mock('../../hooks/useOrganizationStructure', () => ({
  useOrganizationStructure: () => ({ data: empty, isLoading: false, error: new Error('network down') }),
}));

describe('OrganizationStructure when a refresh fails', () => {
  it('keeps showing the last data and says the refresh failed', () => {
    render(<OrganizationStructure />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not refresh: network down');
    expect(screen.getByText('ODC Delivery Manager')).toBeInTheDocument();
  });
});
