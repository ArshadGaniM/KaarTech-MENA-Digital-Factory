import { MOCK_CURRENT_USER } from '../lib/currentUser';

// Single seam future real-auth work replaces — returns the mock as-is today.
export function useCurrentUser() {
  return MOCK_CURRENT_USER;
}
