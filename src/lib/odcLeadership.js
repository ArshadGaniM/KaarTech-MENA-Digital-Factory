// The only hand-maintained part of the Organization Structure page: who sits
// above the departments. Everything below a department comes from live data.
// Names are TBD until the owner supplies them. A department missing from
// every list below shows under "Unassigned" on the page.
export const ODC_DELIVERY_MANAGER = { title: 'ODC Delivery Manager', name: 'TBD' };

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
    departmentCodes: ['DEPT-009', 'DEPT-003', 'DEPT-012'], // Configuration, Development, System Administration
  },
  {
    id: 'pm-4',
    title: 'ODC Project Manager 4',
    name: 'TBD',
    departmentCodes: ['DEPT-004', 'DEPT-010', 'DEPT-011'], // QA & Testing, Training, Data Migration
  },
  {
    id: 'pm-5',
    title: 'ODC Project Manager 5',
    name: 'TBD',
    departmentCodes: ['DEPT-008', 'DEPT-005', 'DEPT-013'], // L1, L2, L3 Operational Support
  },
];
