import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, APP_SHELL_HASHES } from './navigation';
import { MASTER_DATA_TABLES } from './masterDataApi';

describe('navigation registry', () => {
  it('has "Dashboard" first, with no route/columns yet (content undefined until specified)', () => {
    expect(NAV_ITEMS[0]).toMatchObject({ id: 'dashboard', label: 'Dashboard', hash: '#dashboard' });
    expect(NAV_ITEMS[0].route).toBeNull();
    expect(NAV_ITEMS[0].columns).toBeNull();
  });

  it('has "Entity Relationship" last, with no route/columns (FEAT-12 — self-updating page, not a master-data table)', () => {
    const last = NAV_ITEMS[NAV_ITEMS.length - 1];
    expect(last).toMatchObject({ id: 'entity-relationship', label: 'Entity Relationship', hash: '#entity-relationship', kind: 'entity-relationship' });
    expect(last.route).toBeNull();
    expect(last.columns).toBeNull();
  });

  it('gives every master-data NAV_ITEMS entry an id, label, hash, route, and columns', () => {
    const tableItems = NAV_ITEMS.slice(1, -1);
    expect(tableItems.length).toBeGreaterThan(0);
    tableItems.forEach((item) => {
      expect(typeof item.id).toBe('string');
      expect(item.id.length).toBeGreaterThan(0);
      expect(typeof item.label).toBe('string');
      expect(item.hash.startsWith('#')).toBe(true);
      expect(item.hash).toBe(`#${item.route}`);
      expect(Array.isArray(item.columns)).toBe(true);
      expect(item.kind).toBe('table');
    });
  });

  it('derives APP_SHELL_HASHES from NAV_ITEMS so they cannot drift out of sync', () => {
    expect(APP_SHELL_HASHES).toEqual(NAV_ITEMS.map((item) => item.hash));
  });

  it('has one nav item per master-data table between Dashboard and Entity Relationship, in the same order', () => {
    const tableItems = NAV_ITEMS.slice(1, -1);
    expect(tableItems.map((item) => item.route)).toEqual(MASTER_DATA_TABLES.map((table) => table.route));
    expect(tableItems.map((item) => item.label)).toEqual(MASTER_DATA_TABLES.map((table) => table.label));
  });
});
