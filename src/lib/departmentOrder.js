// The owner's order for departments (11 Nov 2026). Every department list in the
// app follows it. A department not listed here, such as a new one, goes last in
// code order.
export const DEPARTMENT_ORDER = [
  'DEPT-013', // L3 Operational Support Services
  'DEPT-005', // L2 Operational Support Services
  'DEPT-008', // L1 Operational Support Services
  'DEPT-010', // Training Services
  'DEPT-004', // Quality Assurance & Testing Services
  'DEPT-012', // System Administration Services
  'DEPT-003', // Development Services
  'DEPT-009', // Configuration Services
  'DEPT-011', // Data Migration Services
  'DEPT-002', // Design Services
  'DEPT-014', // Analyse Services
  'DEPT-007', // Audit Services
  'DEPT-006', // Assessment Services
  'DEPT-001', // Digital/AI Transformation Consulting Services
];

const rankOf = (code) => {
  const index = DEPARTMENT_ORDER.indexOf(code);
  return index === -1 ? DEPARTMENT_ORDER.length : index;
};

// Sort callback for any list of rows that carry a department `code`.
export const byDepartmentOrder = (a, b) => rankOf(a.code) - rankOf(b.code) || a.code.localeCompare(b.code);
