// Control Center read model: departments, their teams, and each team's hours
// for one calendar month ("YYYY-MM").
//
// Rules (agreed with the owner):
//  - A seat is a Consultant or Lead Consultant position. Module Lead
//    positions are not counted.
//  - Available hours: seats x 160.
//  - Allocated hours: for each seat with someone deployed, 160 scaled by the
//    deployment's allocation percentage (a seat never exceeds 160).
//  - Utilized hours: the allocated hours scaled by the share of the month
//    covered by the team's project assignments.
export const HOURS_PER_PERSON = 160;
const COUNTED_POSITIONS = new Set(["Consultant", "Lead Consultant"]);
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const toUtcDay = (isoDate) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};
const round1 = (n) => Math.round(n * 10) / 10;

export const isValidMonth = (month) => typeof month === "string" && MONTH_PATTERN.test(month);

export function monthWindow(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = Date.UTC(year, monthNumber - 1, 1);
  const end = Date.UTC(year, monthNumber, 0);
  return { start, end, days: (end - start) / DAY_MS + 1 };
}

// Days of the month covered by at least one assignment (overlaps counted once).
function coveredDays(assignments, window) {
  const covered = new Set();
  for (const a of assignments) {
    const from = Math.max(toUtcDay(a.start), window.start);
    const to = Math.min(toUtcDay(a.end), window.end);
    for (let day = from; day <= to; day += DAY_MS) covered.add(day);
  }
  return covered.size;
}

function splitCompetencies(text) {
  return (text ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function competenciesOf(positions) {
  const counts = new Map();
  for (const position of positions) {
    for (const name of splitCompetencies(position.competencies)) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { primary: ranked[0]?.[0] ?? null, all: ranked.map(([name]) => name) };
}

// "unstaffed": no allocated hours. "full": every allocated hour is utilized.
// "unused": none is. "partial": some are.
function statusOf(allocatedHours, utilizedHours) {
  if (allocatedHours === 0) return "unstaffed";
  if (utilizedHours >= allocatedHours) return "full";
  if (utilizedHours === 0) return "unused";
  return "partial";
}

function indexBy(rows, key) {
  const index = new Map();
  for (const row of rows) {
    const list = index.get(row[key]) ?? [];
    list.push(row);
    index.set(row[key], list);
  }
  return index;
}

// The hour figures of one team, shared by the floor cards and the popup.
function teamHours({ teamPositions, deploymentsByPosition, teamAssignments, window }) {
  const seats = teamPositions.filter((p) => COUNTED_POSITIONS.has(p.name));
  const members = new Set();
  let allocated = 0;
  let filledSeats = 0;
  for (const seat of seats) {
    const occupants = deploymentsByPosition.get(seat.code) ?? [];
    if (occupants.length === 0) continue;
    filledSeats += 1;
    let seatHours = 0;
    for (const d of occupants) {
      members.add(d.employeeId);
      seatHours += (HOURS_PER_PERSON * d.allocationPercentage) / 100;
    }
    allocated += Math.min(HOURS_PER_PERSON, seatHours);
  }
  const available = seats.length * HOURS_PER_PERSON;
  const covered = coveredDays(teamAssignments, window);
  const utilized = allocated * (covered / window.days);
  const allocatedHours = round1(allocated);
  const utilizedHours = round1(utilized);
  return {
    memberCount: members.size,
    seatCount: seats.length,
    vacantSeatCount: seats.length - filledSeats,
    availableHours: round1(available),
    allocatedHours,
    utilizedHours,
    vacantHours: round1(available - allocated),
    utilizationPercent: allocatedHours === 0 ? 0 : Math.round((utilized / allocated) * 100),
    monthCoveragePercent: Math.round((covered / window.days) * 100),
    status: statusOf(allocatedHours, utilizedHours),
  };
}

// Teams with no competency go last (localeCompare would sort a placeholder
// symbol before the letters).
function byCompetencyThenCode(a, b) {
  if (a.primaryCompetency !== b.primaryCompetency) {
    if (a.primaryCompetency === null) return 1;
    if (b.primaryCompetency === null) return -1;
    return a.primaryCompetency.localeCompare(b.primaryCompetency);
  }
  return a.code.localeCompare(b.code);
}

export function buildControlCenter({ departments, teams, positions, deployments, assignments, month }) {
  const window = monthWindow(month);
  const positionsByTeam = indexBy(positions, "teamCode");
  const deploymentsByPosition = indexBy(deployments, "positionCode");
  const assignmentsByTeam = indexBy(assignments, "teamCode");
  const teamsByDepartment = indexBy(teams, "departmentCode");

  const buildTeam = (team) => {
    const teamPositions = positionsByTeam.get(team.code) ?? [];
    const competencies = competenciesOf(teamPositions);
    return {
      code: team.code,
      name: team.name,
      primaryCompetency: competencies.primary,
      competencies: competencies.all,
      ...teamHours({
        teamPositions,
        deploymentsByPosition,
        teamAssignments: assignmentsByTeam.get(team.code) ?? [],
        window,
      }),
    };
  };

  return {
    hoursPerPerson: HOURS_PER_PERSON,
    month,
    departments: departments.map((department) => ({
      code: department.code,
      name: department.name,
      teams: (teamsByDepartment.get(department.code) ?? [])
        .map(buildTeam)
        // Grouped by competency so teams of one skill sit together.
        .sort(byCompetencyThenCode),
    })),
  };
}

// Everything the popup shows for one team: its seats with who sits in them,
// each person's share in this seat and what they have left overall.
export function buildTeamDetail({ team, department, positions, deployments, allDeployments, assignments, month }) {
  const window = monthWindow(month);
  const totalByEmployee = new Map();
  for (const d of allDeployments) {
    totalByEmployee.set(d.employeeId, (totalByEmployee.get(d.employeeId) ?? 0) + d.allocationPercentage);
  }
  const deploymentsByPosition = indexBy(deployments, "positionCode");

  const seats = positions.flatMap((position) => {
    const counted = COUNTED_POSITIONS.has(position.name);
    const occupants = deploymentsByPosition.get(position.code) ?? [];
    const base = { positionCode: position.code, positionName: position.name, counted };
    if (occupants.length === 0) {
      return [{ ...base, employeeId: null, employeeName: null, allocationPercentage: null, availablePercentage: null }];
    }
    return occupants.map((d) => ({
      ...base,
      employeeId: d.employeeId,
      employeeName: d.employeeName,
      allocationPercentage: d.allocationPercentage,
      availablePercentage: Math.max(0, round1(100 - totalByEmployee.get(d.employeeId))),
    }));
  });

  return {
    code: team.code,
    name: team.name,
    department: { code: department?.code ?? team.departmentCode, name: department?.name ?? null },
    month,
    competencies: competenciesOf(positions).all,
    seats,
    projects: assignments.map((a) => ({ projectId: a.projectId, projectName: a.projectName, start: a.start, end: a.end })),
    ...teamHours({ teamPositions: positions, deploymentsByPosition, teamAssignments: assignments, window }),
  };
}

export async function loadControlCenterRows(query) {
  const [departments, teams, positions, deployments, assignments] = await Promise.all([
    query("select code, name from departments where deleted_at is null order by code"),
    query('select code, name, department_code as "departmentCode" from teams where deleted_at is null order by code'),
    query('select code, name, team_code as "teamCode", competencies from positions where deleted_at is null order by code'),
    query(
      `select rd.employee_id as "employeeId", r.name as "employeeName", rd.position_code as "positionCode",
              rd.allocation_percentage::float as "allocationPercentage"
         from resource_deployment rd
         join resources r on r.employee_id = rd.employee_id and r.deleted_at is null
        where rd.deleted_at is null`
    ),
    query(
      `select pa.team_code as "teamCode", pa.project_id as "projectId", p.project_name as "projectName",
              pa.project_assignment_start_date::text as start, pa.project_assignment_end_date::text as "end"
         from project_assignments pa
         left join projects p on p.project_id = pa.project_id and p.deleted_at is null
        where pa.deleted_at is null`
    ),
  ]);
  return {
    departments: departments.rows,
    teams: teams.rows,
    positions: positions.rows,
    deployments: deployments.rows,
    assignments: assignments.rows,
  };
}
