// Control Center read model: departments, their teams, and each team's hours.
//
// Rules (agreed with the owner):
//  - A team's members are the people deployed to its Consultant and Lead
//    Consultant positions. Module Lead positions are not counted.
//  - Each member is worth 160 hours a month, scaled by the allocation
//    percentage of their deployment to that team's position.
//  - Allocated hours are the available hours scaled by the share of the
//    current month covered by the team's project assignments.
export const HOURS_PER_PERSON = 160;
const COUNTED_POSITIONS = new Set(["Consultant", "Lead Consultant"]);
const DAY_MS = 24 * 60 * 60 * 1000;

const toUtcDay = (isoDate) => Date.UTC(...isoDate.split("-").map((part, i) => Number(part) - (i === 1 ? 1 : 0)));
const round1 = (n) => Math.round(n * 10) / 10;

export function monthWindow(today) {
  const [year, month] = today.split("-").map(Number);
  const start = Date.UTC(year, month - 1, 1);
  const end = Date.UTC(year, month, 0);
  return { start, end, days: (end - start) / DAY_MS + 1 };
}

// Days of the month covered by at least one assignment (overlaps counted once).
function coveredDays(assignments, month) {
  const covered = new Set();
  for (const a of assignments) {
    const from = Math.max(toUtcDay(a.start), month.start);
    const to = Math.min(toUtcDay(a.end), month.end);
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

function primaryCompetency(positions) {
  const counts = new Map();
  for (const position of positions) {
    for (const name of splitCompetencies(position.competencies)) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { primary: ranked[0]?.[0] ?? null, all: ranked.map(([name]) => name) };
}

// "full": every available hour is allocated. "open": hours are still
// available. "empty": nobody is deployed, so there are no hours at all.
function statusOf(availableHours, allocatedHours) {
  if (availableHours === 0) return "empty";
  return allocatedHours >= availableHours ? "full" : "open";
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

export function buildControlCenter({ departments, teams, positions, deployments, assignments, today }) {
  const month = monthWindow(today);
  const positionsByTeam = indexBy(positions, "teamCode");
  const deploymentsByPosition = indexBy(deployments, "positionCode");
  const assignmentsByTeam = indexBy(assignments, "teamCode");
  const teamsByDepartment = indexBy(teams, "departmentCode");

  const buildTeam = (team) => {
    const teamPositions = positionsByTeam.get(team.code) ?? [];
    const seats = teamPositions.filter((p) => COUNTED_POSITIONS.has(p.name));
    const members = new Set();
    let availableHours = 0;
    let filledSeats = 0;
    for (const seat of seats) {
      const seatDeployments = deploymentsByPosition.get(seat.code) ?? [];
      if (seatDeployments.length > 0) filledSeats += 1;
      for (const d of seatDeployments) {
        members.add(d.employeeId);
        availableHours += (HOURS_PER_PERSON * d.allocationPercentage) / 100;
      }
    }
    const teamAssignments = assignmentsByTeam.get(team.code) ?? [];
    const allocatedHours = availableHours * (coveredDays(teamAssignments, month) / month.days);
    const competencies = primaryCompetency(teamPositions);
    return {
      code: team.code,
      name: team.name,
      primaryCompetency: competencies.primary,
      competencies: competencies.all,
      memberCount: members.size,
      seatCount: seats.length,
      vacantSeatCount: seats.length - filledSeats,
      availableHours: round1(availableHours),
      allocatedHours: round1(allocatedHours),
      utilizationPercent: availableHours === 0 ? 0 : Math.round((allocatedHours / availableHours) * 100),
      status: statusOf(round1(availableHours), round1(allocatedHours)),
    };
  };

  return {
    hoursPerPerson: HOURS_PER_PERSON,
    month: { start: new Date(month.start).toISOString().slice(0, 10), end: new Date(month.end).toISOString().slice(0, 10) },
    departments: departments.map((department) => ({
      code: department.code,
      name: department.name,
      teams: (teamsByDepartment.get(department.code) ?? [])
        .map(buildTeam)
        // Grouped by competency so teams of one skill sit together.
        .sort((a, b) => (a.primaryCompetency ?? "~").localeCompare(b.primaryCompetency ?? "~") || a.code.localeCompare(b.code)),
    })),
  };
}

// Everything the popup shows for one team: its seats with who sits in them,
// each person's share in this seat and what they have left overall.
export function buildTeamDetail({ team, department, positions, deployments, allDeployments, assignments, today }) {
  const month = monthWindow(today);
  const totalByEmployee = new Map();
  for (const d of allDeployments) {
    totalByEmployee.set(d.employeeId, (totalByEmployee.get(d.employeeId) ?? 0) + d.allocationPercentage);
  }
  const deploymentsByPosition = indexBy(deployments, "positionCode");

  const seats = positions.flatMap((position) => {
    const counted = COUNTED_POSITIONS.has(position.name);
    const occupants = deploymentsByPosition.get(position.code) ?? [];
    const base = { positionCode: position.code, positionName: position.name, counted };
    if (occupants.length === 0) return [{ ...base, employeeId: null, employeeName: null, allocationPercentage: null, availablePercentage: null }];
    return occupants.map((d) => ({
      ...base,
      employeeId: d.employeeId,
      employeeName: d.employeeName,
      allocationPercentage: d.allocationPercentage,
      availablePercentage: Math.max(0, round1(100 - totalByEmployee.get(d.employeeId))),
    }));
  });

  const covered = coveredDays(assignments, month);
  return {
    code: team.code,
    name: team.name,
    department: { code: department?.code ?? team.departmentCode, name: department?.name ?? null },
    seats,
    projects: assignments.map((a) => ({ projectId: a.projectId, projectName: a.projectName, start: a.start, end: a.end })),
    monthCoveragePercent: Math.round((covered / month.days) * 100),
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
