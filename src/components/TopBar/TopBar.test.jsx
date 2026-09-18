import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import TopBar from './TopBar';
import { MOCK_CURRENT_USER } from '../../lib/currentUser';

describe('TopBar', () => {
  it('renders the given title as a heading', () => {
    render(<TopBar title="Master Data" />);

    expect(screen.getByRole('heading', { name: 'Master Data' })).toBeInTheDocument();
  });

  it('mounts UserBadge with no user prop passed — UserBadge is the sole useCurrentUser call site (AC-5)', () => {
    render(<TopBar title="Master Data" />);

    // UserBadge self-fetches via useCurrentUser(); TopBar never threads a user prop through.
    expect(screen.getByText(MOCK_CURRENT_USER.name)).toBeInTheDocument();
  });
});
