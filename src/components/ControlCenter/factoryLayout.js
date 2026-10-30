// Floors run top to bottom. Team codes are placeholders until the layout is
// wired to the teams table.
const teams = (prefix, count) =>
  Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`);

export const FLOORS = [
  { id: 'design', name: 'Design Dept', teams: teams('DES', 3) },
  { id: 'config', name: 'Config Dept', teams: teams('CFG', 4) },
  { id: 'development', name: 'Development Dept', teams: teams('DEV', 8) },
  { id: 'testing', name: 'Testing / QA Dept', teams: teams('QA', 4) },
  { id: 'training', name: 'Training Dept', teams: teams('TRN', 3) },
  { id: 'data-migration', name: 'Data Migration Dept', teams: teams('DM', 2) },
  { id: 'system-admin', name: 'System Admin Dept', teams: teams('SA', 2) },
  { id: 'l1-support', name: 'L1 Support Dept', teams: teams('L1', 4) },
  { id: 'l2-support', name: 'L2 Support Dept', teams: teams('L2', 4) },
  { id: 'l2-support-2', name: 'L2 Support Dept', teams: teams('L2B', 4) },
];
