import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProjectPlanSection from './ProjectPlanSection';
import { fetchPlanActuals } from '../../lib/projectPlanApi';

vi.mock('../../lib/projectPlanApi');

describe('ProjectPlanSection', () => {
  it('shows the plan with its heading and anchor, and no way to record actuals', async () => {
    fetchPlanActuals.mockResolvedValue({});
    const { container } = render(<ProjectPlanSection />);

    expect(screen.getByRole('heading', { name: 'Initiative Plan' })).toBeInTheDocument();
    expect(container.querySelector('#initiative-plan')).not.toBeNull();
    expect(screen.getAllByText('Establish SOP Document')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /actual/i })).not.toBeInTheDocument();
  });
});
