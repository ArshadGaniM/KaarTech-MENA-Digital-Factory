// Floors run top to bottom. Each floor is a department; its name and teams
// come from the departments and teams tables. This list is the source of
// truth for which departments appear and in what order, so a new department
// needs an entry here before it shows up.
export const FLOORS = [
  { id: 'design', departmentCode: 'DEPT-002' },
  { id: 'config', departmentCode: 'DEPT-009' },
  { id: 'development', departmentCode: 'DEPT-003' },
  { id: 'testing', departmentCode: 'DEPT-004' },
  { id: 'training', departmentCode: 'DEPT-010' },
  { id: 'data-migration', departmentCode: 'DEPT-011' },
  { id: 'system-admin', departmentCode: 'DEPT-012' },
  { id: 'l1-support', departmentCode: 'DEPT-008' },
  { id: 'l2-support', departmentCode: 'DEPT-005' },
  { id: 'l3-support', departmentCode: 'DEPT-013' },
];
