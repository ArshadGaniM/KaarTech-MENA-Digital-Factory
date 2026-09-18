// Placeholder-only identity — no auth backend exists yet (CLAUDE.md §23).
// Every consumer reads this through useCurrentUser(), never this file directly.
export const MOCK_CURRENT_USER = {
  id: 'mock-user-1',
  name: 'Aisha Al Marri',
  role: 'Delivery Manager',
  initials: 'AA',
};
