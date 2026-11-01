import { describe, expect, it } from 'vitest';
import { buildDeliverables, DELIVERABLE_DETAILS, OWNER_TO_BE_CONFIRMED, ROLLOUT_DUE_DATE, SOP_DUE_DATE } from './deliverables';
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

  it('starts every row as Yet to Start', () => {
    const rows = buildDeliverables({ services, streams });

    expect(rows.every((row) => row.status === STATUS.YET_TO_START)).toBe(true);
  });

  it('leaves the owner To be confirmed for a service or stream that has none given', () => {
    const rows = buildDeliverables({ services: [{ code: 'DEPT-999', title: 'Brand New Services' }], streams: [...streams, 'Stream D', 'Stream E'] });

    expect(rows.find((row) => row.id === 'sop-DEPT-999').owner).toBe(OWNER_TO_BE_CONFIRMED);
    expect(rows.find((row) => row.id === 'rollout-5').owner).toBe(OWNER_TO_BE_CONFIRMED);
  });

  it('gives each service and stream the owner the owner named', () => {
    const live = [
      ['DEPT-001', 'Digital/AI Transformation Consulting Services', 'Surya M'],
      ['DEPT-006', 'Assessment Services', 'Surya M'],
      ['DEPT-007', 'Audit Services', 'Faizan R'],
      ['DEPT-002', 'Design Services', 'Surya M'],
      ['DEPT-009', 'Configuration Services', 'Rushikesh Subhash Nikam'],
      ['DEPT-003', 'Development Services', 'Rushikesh Subhash Nikam'],
      ['DEPT-004', 'Quality Assurance & Testing Services', 'Rushikesh Subhash Nikam'],
      ['DEPT-010', 'Training Services', 'Surya M'],
      ['DEPT-011', 'Data Migration Services', 'Surya M'],
      ['DEPT-012', 'System Administration Services', 'Rushikesh Subhash Nikam'],
      ['DEPT-008', 'L1 Operational Support Services', 'Faizan R'],
      ['DEPT-005', 'L2 Operational Support Services', 'Faizan R'],
      ['DEPT-013', 'L3 Operational Support Services', 'Faizan R'],
    ];
    const rows = buildDeliverables({ services: live.map(([code, title]) => ({ code, title })), streams });

    for (const [code, title, owner] of live) {
      expect(rows.find((row) => row.name === `SOP document: ${title}`)).toMatchObject({ id: `sop-${code}`, owner });
    }
    expect(rows.filter((row) => row.id.startsWith('rollout-')).map((row) => row.owner)).toEqual(['Rushikesh Subhash Nikam', 'Surya M', 'Faizan R']);
  });

  it('names an owner who is a stakeholder, spelled as in the Stakeholder Matrix', async () => {
    const { STAKEHOLDERS } = await import('./stakeholders');
    const names = new Set(STAKEHOLDERS.map((entry) => entry.name));

    for (const detail of Object.values(DELIVERABLE_DETAILS)) expect(names.has(detail.owner)).toBe(true);
  });

  it('gives each row a unique id, and follows the services it is given', () => {
    const rows = buildDeliverables({ services: [...services, { code: 'DEPT-003', title: 'New' }], streams });

    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    expect(rows).toHaveLength(6);
    expect(buildDeliverables({ services: [], streams })).toHaveLength(3);
  });
});
