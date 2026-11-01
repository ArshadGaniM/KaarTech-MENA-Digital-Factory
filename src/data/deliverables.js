import { STATUS } from './initiativePlan';

// The initiative's deliverables, as the owner described them (1 Nov 2026). There
// is one SOP document per service, so the list follows the Departments page: a
// new department adds a new row. There is one rollout strategy document per
// plan stream.
//
// Every deliverable starts as Yet to Start with its owner To be confirmed. Give a
// deliverable its real owner or status in DELIVERABLE_DETAILS, keyed by its id:
//   'sop-DEPT-001': { owner: 'Name', status: STATUS.IN_PROGRESS }
//   'rollout-1': { owner: 'Name' }
export const SOP_DUE_DATE = '2026-12-31';
export const ROLLOUT_DUE_DATE = '2027-02-28';
export const OWNER_TO_BE_CONFIRMED = 'To be confirmed';
export const DELIVERABLE_DETAILS = {};

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
