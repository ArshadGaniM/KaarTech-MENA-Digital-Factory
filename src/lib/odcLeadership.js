// The only hand-maintained part of the Organization Structure page: who sits
// above the departments. Everything below a department comes from live data.
// A name stays 'TBD' until the owner supplies it. A department missing from
// every list below shows under "Unassigned" on the page. A code with no live
// department (renamed, deleted, mistyped) is skipped, so check this list when a
// manager's seat count drops.
export const ODC_DELIVERY_MANAGER = { title: 'ODC Delivery Manager', name: 'Mohammed Ibrahim S' };

export const ODC_PROJECT_MANAGERS = [
  {
    id: 'pm-1',
    title: 'ODC Project Manager 1',
    name: 'TBD',
    departmentCodes: ['DEPT-006', 'DEPT-007', 'DEPT-001'], // Assessment, Audit, Digital/AI Transformation Consulting
  },
  {
    id: 'pm-2',
    title: 'ODC Project Manager 2',
    name: 'TBD',
    departmentCodes: ['DEPT-014', 'DEPT-002'], // Analyse, Design
  },
  {
    id: 'pm-3',
    title: 'ODC Project Manager 3',
    name: 'TBD',
    departmentCodes: ['DEPT-009'], // Configuration
  },
  {
    id: 'pm-4',
    title: 'ODC Project Manager 4',
    name: 'Karthikeyan Rajendran',
    departmentCodes: ['DEPT-003', 'DEPT-012'], // Development, System Administration
  },
  {
    id: 'pm-5',
    title: 'ODC Project Manager 5',
    name: 'TBD',
    departmentCodes: ['DEPT-004', 'DEPT-010', 'DEPT-011'], // QA & Testing, Training, Data Migration
  },
  {
    id: 'pm-6',
    title: 'ODC Project Manager 6',
    name: 'TBD',
    departmentCodes: ['DEPT-008', 'DEPT-005', 'DEPT-013'], // L1, L2, L3 Operational Support
  },
];
