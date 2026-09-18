import { describe, expect, it } from 'vitest';
import { MOCK_CURRENT_USER } from './currentUser';

describe('MOCK_CURRENT_USER', () => {
  it('shapes a display-only identity with id, name, role, and initials', () => {
    expect(MOCK_CURRENT_USER).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      role: expect.any(String),
      initials: expect.any(String),
    });
  });
});
