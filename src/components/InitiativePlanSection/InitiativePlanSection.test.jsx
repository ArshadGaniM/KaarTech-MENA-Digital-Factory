import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import InitiativePlanSection from './InitiativePlanSection';
import { fetchPlanActuals } from '../../lib/initiativePlanApi';

vi.mock('../../lib/initiativePlanApi');

describe('InitiativePlanSection', () => {
  it('shows the plan with its heading and anchor, and no way to record actuals', async () => {
    fetchPlanActuals.mockResolvedValue({});
    const { container } = render(<InitiativePlanSection />);

    expect(screen.getByRole('heading', { name: 'Initiative Plan' })).toBeInTheDocument();
    expect(container.querySelector('#initiative-plan')).not.toBeNull();
    expect(screen.getAllByText('Establish SOP Document')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /actual/i })).not.toBeInTheDocument();
  });
});
