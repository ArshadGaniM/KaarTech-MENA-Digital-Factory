import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, APP_SHELL_HASHES } from './navigation';
import { MASTER_DATA_TABLES } from './masterDataApi';

describe('navigation registry', () => {
  it('gives every NAV_ITEMS entry an id, label, hash, route, and columns', () => {
    expect(NAV_ITEMS.length).toBeGreaterThan(0);
    NAV_ITEMS.forEach((item) => {
      expect(typeof item.id).toBe('string');
      expect(item.id.length).toBeGreaterThan(0);
      expect(typeof item.label).toBe('string');
      expect(item.hash.startsWith('#')).toBe(true);
      expect(item.hash).toBe(`#${item.route}`);
      expect(Array.isArray(item.columns)).toBe(true);
    });
  });

  it('derives APP_SHELL_HASHES from NAV_ITEMS so they cannot drift out of sync', () => {
    expect(APP_SHELL_HASHES).toEqual(NAV_ITEMS.map((item) => item.hash));
  });

  it('has one nav item per master-data table, in the same order', () => {
    expect(NAV_ITEMS.map((item) => item.route)).toEqual(MASTER_DATA_TABLES.map((table) => table.route));
    expect(NAV_ITEMS.map((item) => item.label)).toEqual(MASTER_DATA_TABLES.map((table) => table.label));
  });
});
