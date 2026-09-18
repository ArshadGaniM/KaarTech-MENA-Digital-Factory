import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, APP_SHELL_HASHES } from './navigation';

describe('navigation registry', () => {
  it('gives every NAV_ITEMS entry an id, label, hash, and component', () => {
    expect(NAV_ITEMS.length).toBeGreaterThan(0);
    NAV_ITEMS.forEach((item) => {
      expect(typeof item.id).toBe('string');
      expect(item.id.length).toBeGreaterThan(0);
      expect(typeof item.label).toBe('string');
      expect(item.hash.startsWith('#')).toBe(true);
      expect(typeof item.component).toBe('function');
    });
  });

  it('derives APP_SHELL_HASHES from NAV_ITEMS so they cannot drift out of sync', () => {
    expect(APP_SHELL_HASHES).toEqual(NAV_ITEMS.map((item) => item.hash));
  });

  it('includes the master-data hash', () => {
    expect(APP_SHELL_HASHES).toContain('#master-data');
  });
});
