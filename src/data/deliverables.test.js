import { describe, expect, it } from 'vitest';
import { buildDeliverables, OWNER_TO_BE_CONFIRMED, ROLLOUT_DUE_DATE, SOP_DUE_DATE } from './deliverables';
import { STATUS } from './initiativePlan';

const services = [
  { code: 'DEPT-002', title: 'Design Services' },
  { code: 'DEPT-001', title: 'Audit Services' },
];
const streams = ['Stream A', 'Stream B', 'Stream C'];

describe('buildDeliverables', () => {
  it('has one SOP row per service in the order given, then one rollout row per stream', () => {
    const rows = buildDeliverables({ services, streams });

    expect(rows.map((row) => row.name)).toEqual([
      'SOP document: Design Services',
      'SOP document: Audit Services',
      'Rollout strategy document for all MENA projects (Stream A)',
      'Rollout strategy document for all MENA projects (Stream B)',
      'Rollout strategy document for all MENA projects (Stream C)',
    ]);
  });

  it('dates the SOP rows 31 Dec 2026 and the rollout rows 28 Feb 2027', () => {
    const rows = buildDeliverables({ services, streams });

    expect(SOP_DUE_DATE).toBe('2026-12-31');
    expect(ROLLOUT_DUE_DATE).toBe('2027-02-28');
    expect(rows.filter((row) => row.id.startsWith('sop-')).every((row) => row.due === '2026-12-31')).toBe(true);
    expect(rows.filter((row) => row.id.startsWith('rollout-')).every((row) => row.due === '2027-02-28')).toBe(true);
  });

  it('starts every row as Yet to Start with the owner To be confirmed', () => {
    const rows = buildDeliverables({ services, streams });

    expect(rows.every((row) => row.status === STATUS.YET_TO_START && row.owner === OWNER_TO_BE_CONFIRMED)).toBe(true);
  });

  it('gives each row a unique id, and follows the services it is given', () => {
    const rows = buildDeliverables({ services: [...services, { code: 'DEPT-003', title: 'New' }], streams });

    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    expect(rows).toHaveLength(6);
    expect(buildDeliverables({ services: [], streams })).toHaveLength(3);
  });
});
