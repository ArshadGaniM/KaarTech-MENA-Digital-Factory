// Floors run top to bottom. The department codes come from the departments
// table, which supplies each floor's name. Team codes are placeholders until
// the teams table has rows to read.
const teams = (prefix, count) =>
  Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`);

export const FLOORS = [
  { id: 'design', departmentCode: 'DEPT-002', teams: teams('DES', 3) },
  { id: 'config', departmentCode: 'DEPT-009', teams: teams('CFG', 4) },
  { id: 'development', departmentCode: 'DEPT-003', teams: teams('DEV', 8) },
  { id: 'testing', departmentCode: 'DEPT-004', teams: teams('QA', 4) },
  { id: 'training', departmentCode: 'DEPT-010', teams: teams('TRN', 3) },
  { id: 'data-migration', departmentCode: 'DEPT-011', teams: teams('DM', 2) },
  { id: 'system-admin', departmentCode: 'DEPT-012', teams: teams('SA', 2) },
  { id: 'l1-support', departmentCode: 'DEPT-008', teams: teams('L1', 4) },
  { id: 'l2-support', departmentCode: 'DEPT-005', teams: teams('L2', 4) },
  { id: 'l3-support', departmentCode: 'DEPT-013', teams: teams('L3', 4) },
];
