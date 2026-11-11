import { describe, expect, it } from 'vitest';
import { byDepartmentOrder, DEPARTMENT_ORDER } from './departmentOrder';

describe('byDepartmentOrder', () => {
  it('lists each of the 14 departments once', () => {
    expect(new Set(DEPARTMENT_ORDER).size).toBe(14);
  });

  it("sorts by the owner's order", () => {
    const rows = ['DEPT-001', 'DEPT-010', 'DEPT-013', 'DEPT-004'].map((code) => ({ code }));
    expect(rows.sort(byDepartmentOrder).map((row) => row.code)).toEqual(['DEPT-013', 'DEPT-010', 'DEPT-004', 'DEPT-001']);
  });

  it('puts unlisted departments last, in code order', () => {
    const rows = ['DEPT-099', 'DEPT-001', 'DEPT-050'].map((code) => ({ code }));
    expect(rows.sort(byDepartmentOrder).map((row) => row.code)).toEqual(['DEPT-001', 'DEPT-050', 'DEPT-099']);
  });
});
