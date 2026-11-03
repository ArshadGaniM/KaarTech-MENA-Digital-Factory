import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRecord, deleteRecord, updateRecord } from './masterDataApi';
import { assignSeat, dayBefore, deleteProjectAssignment, isModuleLeadSeat, latestSeatedEnd, unassignSeat } from './teamActions';

vi.mock('./masterDataApi', () => ({ createRecord: vi.fn(), updateRecord: vi.fn(), deleteRecord: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

describe('dayBefore', () => {
  it('crosses month and year ends', () => {
    expect(dayBefore('2026-10-15')).toBe('2026-10-14');
    expect(dayBefore('2026-11-01')).toBe('2026-10-31');
    expect(dayBefore('2027-01-01')).toBe('2026-12-31');
    expect(dayBefore('2028-03-01')).toBe('2028-02-29');
  });
});

describe('latestSeatedEnd', () => {
  it('is the latest end date, or empty when nobody is seated', () => {
    expect(latestSeatedEnd([{ endDate: '2026-12-31' }, { endDate: null }, { endDate: '2027-03-31' }])).toBe('2027-03-31');
    expect(latestSeatedEnd([{ endDate: null }])).toBe('');
  });
});

describe('assignSeat', () => {
  const dates = { employeeId: 7, startDate: '2026-10-15', endDate: '2027-03-31', allocationPercentage: 60 };

  it('sends the allocation for an ordinary seat and omits it for a Module Lead seat', () => {
    assignSeat({ positionCode: 'POS-1', positionName: 'Consultant' }, dates);
    expect(createRecord).toHaveBeenLastCalledWith('resource-deployment', { ...dates, positionId: 'POS-1' });
    assignSeat({ positionCode: 'POS-2', positionName: 'Module Lead - FICO' }, dates);
    expect(createRecord.mock.calls[1][1]).not.toHaveProperty('allocationPercentage');
    expect(isModuleLeadSeat({ positionName: 'Lead Consultant' })).toBe(false);
  });
});

describe('unassignSeat', () => {
  const seat = { deploymentId: 'D-1', startDate: '2026-08-01' };

  it('ends a started deployment the day before today', () => {
    unassignSeat(seat, '2026-10-15');
    expect(updateRecord).toHaveBeenCalledWith('resource-deployment', 'D-1', { endDate: '2026-10-14' });
  });

  it('ends a deployment that started yesterday, and removes one that starts today or later', () => {
    unassignSeat({ ...seat, startDate: '2026-10-14' }, '2026-10-15');
    expect(updateRecord).toHaveBeenCalledTimes(1);
    unassignSeat({ ...seat, startDate: '2026-10-15' }, '2026-10-15');
    unassignSeat({ ...seat, startDate: '2026-11-01' }, '2026-10-15');
    expect(deleteRecord).toHaveBeenCalledTimes(2);
    expect(updateRecord).toHaveBeenCalledTimes(1);
  });
});

describe('deleteProjectAssignment', () => {
  it('patches the end date of a started assignment and removes one that has not started', () => {
    deleteProjectAssignment({ id: 'A', start: '2026-09-01' }, '2026-10-14', '2026-10-15');
    expect(updateRecord).toHaveBeenCalledWith('project-assignments', 'A', { projectAssignmentEndDate: '2026-10-14' });
    deleteProjectAssignment({ id: 'B', start: '2026-10-15' }, '2026-10-14', '2026-10-15');
    expect(deleteRecord).toHaveBeenCalledWith('project-assignments', 'B');
  });
});
