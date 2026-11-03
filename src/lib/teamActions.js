import { createRecord, deleteRecord, updateRecord } from './masterDataApi';

const DEPLOYMENTS = 'resource-deployment';
const ASSIGNMENTS = 'project-assignments';
const DAY_MS = 24 * 60 * 60 * 1000;

// The backend reads "today" in UTC, so the pop-up does too.
export const todayIso = () => new Date().toISOString().slice(0, 10);

export function dayBefore(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) - DAY_MS).toISOString().slice(0, 10);
}

// The backend computes a Module Lead's allocation, so the request must omit it.
export const isModuleLeadSeat = (seat) => seat.positionName.startsWith('Module Lead');

// The latest end date among the people seated in the team, or '' when nobody is.
export function latestSeatedEnd(seats) {
  return seats.reduce((latest, seat) => (seat.endDate && seat.endDate > latest ? seat.endDate : latest), '');
}

export function assignSeat(seat, { employeeId, startDate, endDate, allocationPercentage }) {
  return createRecord(DEPLOYMENTS, {
    employeeId,
    positionId: seat.positionCode,
    startDate,
    endDate,
    ...(isModuleLeadSeat(seat) ? {} : { allocationPercentage }),
  });
}

// A seat whose deployment has already ended is history: ending it again would
// move its end date later.
export const isSeatRunning = (seat, today) => !seat.endDate || seat.endDate >= today;

// Ending a deployment keeps it as history. One that has not started cannot end
// before it starts, so it is removed instead.
export function unassignSeat(seat, today) {
  if (!isSeatRunning(seat, today)) throw new Error(`This seat's deployment already ended on ${seat.endDate}.`);
  if (seat.startDate >= today) return deleteRecord(DEPLOYMENTS, seat.deploymentId);
  return updateRecord(DEPLOYMENTS, seat.deploymentId, { endDate: dayBefore(today) });
}

export function deleteProjectAssignment(project, endDate, today) {
  if (project.start >= today) return deleteRecord(ASSIGNMENTS, project.id);
  if (endDate > project.end) throw new Error(`The end date cannot be later than the project's end, ${project.end}.`);
  return updateRecord(ASSIGNMENTS, project.id, { projectAssignmentEndDate: endDate });
}
