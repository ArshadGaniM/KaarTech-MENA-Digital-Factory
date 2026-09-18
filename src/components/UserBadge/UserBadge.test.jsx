import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import UserBadge from './UserBadge';
import { MOCK_CURRENT_USER } from '../../lib/currentUser';

describe('UserBadge', () => {
  it('renders the current user name, role, and initials sourced from useCurrentUser', () => {
    render(<UserBadge />);

    expect(screen.getByText(MOCK_CURRENT_USER.name)).toBeInTheDocument();
    expect(screen.getByText(MOCK_CURRENT_USER.role)).toBeInTheDocument();
    expect(screen.getByText(MOCK_CURRENT_USER.initials)).toBeInTheDocument();
  });

  it('marks the initials avatar as decorative for screen readers', () => {
    render(<UserBadge />);

    const avatar = screen.getByText(MOCK_CURRENT_USER.initials);
    expect(avatar).toHaveAttribute('aria-hidden', 'true');
  });
});
