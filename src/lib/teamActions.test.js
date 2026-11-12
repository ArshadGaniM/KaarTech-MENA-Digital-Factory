import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRecord, deleteRecord, updateRecord } from './masterDataApi';
import { assignSeat, dayBefore, deleteProjectAssignment, isModuleLeadSeat, latestSeatedEnd, remainingAllocation, unassignSeat } from './teamActions';

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

describe('unassignSeat on an ended seat', () => {
  it('refuses, so history is never lengthened', () => {
    const seat = { deploymentId: 'D-1', startDate: '2026-08-01', endDate: '2026-10-10' };
    expect(() => unassignSeat(seat, '2026-10-15')).toThrow(/already ended/);
    expect(updateRecord).not.toHaveBeenCalled();
    expect(deleteRecord).not.toHaveBeenCalled();
  });

  it('still ends a seat that runs today or later', () => {
    unassignSeat({ deploymentId: 'D-1', startDate: '2026-08-01', endDate: '2026-10-15' }, '2026-10-15');
    expect(updateRecord).toHaveBeenCalledWith('resource-deployment', 'D-1', { endDate: '2026-10-14' });
  });
});

describe('deleteProjectAssignment', () => {
  it('refuses an end date later than the project end', () => {
    expect(() => deleteProjectAssignment({ id: 'A', start: '2026-09-01', end: '2026-12-05' }, '2026-12-06', '2026-10-15')).toThrow(/cannot be later/);
    expect(updateRecord).not.toHaveBeenCalled();
  });

  it('patches the end date of a started assignment and removes one that has not started', () => {
    deleteProjectAssignment({ id: 'A', start: '2026-09-01', end: '2026-12-05' }, '2026-10-14', '2026-10-15');
    expect(updateRecord).toHaveBeenCalledWith('project-assignments', 'A', { projectAssignmentEndDate: '2026-10-14' });
    deleteProjectAssignment({ id: 'B', start: '2026-10-15' }, '2026-10-14', '2026-10-15');
    expect(deleteRecord).toHaveBeenCalledWith('project-assignments', 'B');
  });
});

describe('remainingAllocation', () => {
  const project = (start, end, allocationPercentage) => ({ start, end, allocationPercentage });

  it('is 100 when no project runs that day', () => {
    expect(remainingAllocation([], '2026-10-15')).toBe(100);
    expect(remainingAllocation([project('2026-11-01', '2026-12-31', 60)], '2026-10-15')).toBe(100);
  });

  it('takes away the projects running that day, both ends included', () => {
    const projects = [project('2026-09-01', '2026-10-15', 25), project('2026-10-15', '2026-12-31', 33.33), project('2026-09-01', '2026-10-14', 40)];
    expect(remainingAllocation(projects, '2026-10-15')).toBe(41.67);
  });

  it('counts a project with no percentage as 100 and never goes below 0', () => {
    expect(remainingAllocation([project('2026-09-01', '2026-12-31')], '2026-10-15')).toBe(0);
    expect(remainingAllocation([project('2026-09-01', '2026-12-31', 80), project('2026-09-01', '2026-12-31', 80)], '2026-10-15')).toBe(0);
  });
});
