import { STATUS } from './initiativePlan';

// The initiative's deliverables, as the owner described them (1 Nov 2026). There
// is one SOP document per service, so the list follows the Departments page: a
// new department adds a new row. There is one rollout strategy document per
// plan stream.
//
// Every deliverable starts as Yet to Start. Its owner is To be confirmed until
// DELIVERABLE_DETAILS names one. Give a deliverable its owner or a new status
// there, keyed by its id:
//   'sop-DEPT-001': { owner: 'Name', status: STATUS.IN_PROGRESS }
//   'rollout-1': { owner: 'Name' }
export const SOP_DUE_DATE = '2026-12-31';
export const ROLLOUT_DUE_DATE = '2027-02-28';
export const OWNER_TO_BE_CONFIRMED = 'To be confirmed';
const SURYA = 'Surya M';
const FAIZAN = 'Faizan R';
const RUSHIKESH = 'Rushikesh Subhash Nikam';

// Owners given by the owner, 1 Nov 2026. SOP rows are keyed by the department code.
// A department with no entry here, such as a newly added one, stays To be confirmed.
export const DELIVERABLE_DETAILS = {
  'sop-DEPT-001': { owner: SURYA }, // Digital/AI Transformation Consulting Services
  'sop-DEPT-006': { owner: SURYA }, // Assessment Services
  'sop-DEPT-007': { owner: FAIZAN }, // Audit Services
  'sop-DEPT-002': { owner: SURYA }, // Design Services
  'sop-DEPT-009': { owner: RUSHIKESH }, // Configuration Services
  'sop-DEPT-003': { owner: RUSHIKESH }, // Development Services
  'sop-DEPT-004': { owner: RUSHIKESH }, // Quality Assurance & Testing Services
  'sop-DEPT-010': { owner: SURYA }, // Training Services
  'sop-DEPT-011': { owner: SURYA }, // Data Migration Services
  'sop-DEPT-012': { owner: RUSHIKESH }, // System Administration Services
  'sop-DEPT-008': { owner: FAIZAN }, // L1 Operational Support Services
  'sop-DEPT-005': { owner: FAIZAN }, // L2 Operational Support Services
  'sop-DEPT-013': { owner: FAIZAN }, // L3 Operational Support Services
  'rollout-1': { owner: RUSHIKESH }, // Development & Enhancement Projects
  'rollout-2': { owner: SURYA }, // SAP Implementation & Rollout Projects
  'rollout-3': { owner: FAIZAN }, // Managed Services Project
};

// Services arrive in floor order, highest first, and keep that order. Streams
// arrive in plan order.
export function buildDeliverables({ services, streams }) {
  const rows = [
    ...services.map((service) => ({
      id: `sop-${service.code}`,
      name: `SOP document: ${service.title}`,
      due: SOP_DUE_DATE,
    })),
    ...streams.map((stream, index) => ({
      id: `rollout-${index + 1}`,
      name: `Rollout strategy document for all MENA projects (${stream})`,
      due: ROLLOUT_DUE_DATE,
    })),
  ];
  return rows.map((row) => ({
    ...row,
    owner: DELIVERABLE_DETAILS[row.id]?.owner ?? OWNER_TO_BE_CONFIRMED,
    status: DELIVERABLE_DETAILS[row.id]?.status ?? STATUS.YET_TO_START,
  }));
}
