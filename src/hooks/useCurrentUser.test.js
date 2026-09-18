import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCurrentUser } from './useCurrentUser';
import { MOCK_CURRENT_USER } from '../lib/currentUser';

describe('useCurrentUser', () => {
  it('returns the mock current user unchanged', () => {
    const { result } = renderHook(() => useCurrentUser());
    expect(result.current).toEqual(MOCK_CURRENT_USER);
  });
});
