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
//    covered by the team's project assignments (shown as planned utilization).
//  - A deployment counts only on the day the page looks at: today for the
//    current month, the first day of any other month. Before its start date and
//    after its end date (both days included) the person is TBD, not deployed.
//  - Costs are monthly, in USD. A person's cost is their Actual Resource Cost
//    when they have one, else the Planned Resource Cost of their designation,
//    else the Senior Consultant planned cost. The onsite or offshore figure
//    follows their location type (no location type counts as offshore). The
//    allocated resource cost is that cost times the allocation percentage, and
//    the allocated team cost is the sum over the people in counted seats.
export const HOURS_PER_PERSON = 160;
const COUNTED_POSITIONS = new Set(["Consultant", "Lead Consultant"]);
// A vacant seat, or a position not counted in the team, carries no cost.
const NO_COST = { plannedResourceCost: null, actualResourceCost: null, allocatedResourceCost: null, costSource: null };
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_PATTERN = /^[12]\d{3}-(0[1-9]|1[0-2])$/;

const toUtcDay = (isoDate) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};
const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;
// Names already reported, so a busy page does not repeat the same warning.
const warnedCompetencies = new Set();
const DEFAULT_COST_DESIGNATION = "Senior Consultant";
const designationKey = (text) => (text ?? "").trim().toLowerCase();

export const isValidMonth = (month) => typeof month === "string" && MONTH_PATTERN.test(month);

export function monthWindow(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = Date.UTC(year, monthNumber - 1, 1);
  const end = Date.UTC(year, monthNumber, 0);
  return { start, end, days: (end - start) / DAY_MS + 1 };
}

// The day the month is looked at: today when it falls in the month, else the
// month's first day.
export function referenceDay(window, today) {
  const todayMs = toUtcDay(today);
  const day = todayMs >= window.start && todayMs <= window.end ? todayMs : window.start;
  return new Date(day).toISOString().slice(0, 10);
}

// The deployments running on `day` (ISO date), dates included.
export function deployedOn(deployments, day) {
  return deployments.filter((d) => d.start <= day && d.end >= day);
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

function buildCostContext({ resources = [], actualCosts = [], plannedCosts = [] }) {
  return {
    employeeById: new Map(resources.map((r) => [r.employeeId, r])),
    actualByEmployee: new Map(actualCosts.map((c) => [c.employeeId, c])),
    plannedByDesignation: new Map(plannedCosts.map((c) => [designationKey(c.designation), c])),
  };
}

// One person's monthly cost. `source` says which figure was used: "Actual",
// "Planned" (their designation's) or "Default" (the Senior Consultant cost).
function costOf(costs, employeeId, allocationPercentage) {
  const employee = costs.employeeById.get(employeeId);
  const side = designationKey(employee?.locationType) === "onsite" ? "onsiteCost" : "offshoreCost";
  const actual = costs.actualByEmployee.get(employeeId)?.[side] ?? null;
  const own = costs.plannedByDesignation.get(designationKey(employee?.designation))?.[side] ?? null;
  const fallback = costs.plannedByDesignation.get(designationKey(DEFAULT_COST_DESIGNATION))?.[side] ?? null;
  const planned = own ?? fallback;
  // "Missing": no actual cost, no planned cost for the designation, and the
  // Senior Consultant row itself is gone, so the person is costed at zero. The
  // tag makes that visible instead of letting a team look cheaper.
  const source = actual !== null ? "Actual" : own !== null ? "Planned" : fallback !== null ? "Default" : "Missing";
  const base = actual ?? planned ?? 0;
  return {
    locationType: side === "onsiteCost" ? "Onsite" : "Offshore",
    plannedResourceCost: planned,
    actualResourceCost: actual,
    allocatedResourceCost: round2((base * allocationPercentage) / 100),
    costSource: source,
  };
}

// The cost figures of one team: every person in a counted seat is costed, and
// the team cost is their sum. `locationMix` is Onsite or Offshore when everyone
// is in the same place, Hybrid when mixed, null when nobody is deployed.
function teamCosts({ teamPositions, deploymentsByPosition, costs }) {
  const byPerson = new Map();
  const locations = new Set();
  let total = 0;
  let defaulted = 0;
  for (const seat of teamPositions.filter((p) => COUNTED_POSITIONS.has(p.name))) {
    for (const d of deploymentsByPosition.get(seat.code) ?? []) {
      const cost = costOf(costs, d.employeeId, d.allocationPercentage);
      byPerson.set(`${seat.code}:${d.employeeId}`, cost);
      locations.add(cost.locationType);
      total += cost.allocatedResourceCost;
      if (cost.costSource === "Default" || cost.costSource === "Missing") defaulted += 1;
    }
  }
  return {
    byPerson,
    defaultedCostCount: defaulted,
    allocatedTeamCost: round2(total),
    locationMix: locations.size === 0 ? null : locations.size > 1 ? "Hybrid" : [...locations][0],
  };
}

// The assignment covering `today`, if any. A team's assignments cannot share a
// day, so at most one matches.
function currentAssignmentOf(assignments, today) {
  return assignments.find((a) => a.start <= today && today <= a.end) ?? null;
}

// The earliest assignment that starts after `today`, shown as information so a
// future assignment that was just added does not look lost.
function nextAssignmentOf(assignments, today) {
  return assignments.filter((a) => a.start > today).sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;
}

// Planned utilization and cost for each month the assignment touches, from its
// start month to its end month. A month's share is the days the assignment
// covers; the cost is the team's monthly allocated cost scaled by that share.
// A very long assignment is cut at MAX_PLAN_MONTHS (`truncated` says so), so one
// absurd end date cannot make every popup fetch compute tens of thousands of months.
const MAX_PLAN_MONTHS = 120;

function monthlyPlan(assignment, allocatedTeamCost) {
  if (!assignment) return { months: [], totalCost: 0, truncated: false };
  const [startYear, startMonth] = assignment.start.split("-").map(Number);
  const [endYear, endMonth] = assignment.end.split("-").map(Number);
  const months = [];
  let totalCost = 0;
  const first = startYear * 12 + startMonth - 1;
  const last = endYear * 12 + endMonth - 1;
  const truncated = last - first + 1 > MAX_PLAN_MONTHS;
  for (let index = first; index <= Math.min(last, first + MAX_PLAN_MONTHS - 1); index += 1) {
    const month = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
    const window = monthWindow(month);
    const share = coveredDays([assignment], window) / window.days;
    const cost = allocatedTeamCost * share;
    totalCost += cost;
    months.push({ month, utilizationPercent: round2(share * 100), cost: round2(cost) });
  }
  return { months, totalCost: round2(totalCost), truncated };
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

// A team with no live assignment is not allocated and goes last in its practice.
// An allocated team with no hours utilized comes first, then the rest.
function allocationRank(team) {
  if (team.assignmentEndDate === null) return 2;
  return team.utilizedHours === 0 ? 0 : 1;
}

// Teams are laid out by practice, in practice code order, with teams that have
// no practice last. Inside a practice: allocated teams with nothing utilized,
// then allocated teams with some utilization, then teams with no live
// assignment. Each band sorts by assignment end date, then team code.
function byPracticeThenAllocation(a, b) {
  if (a.practiceCode !== b.practiceCode) {
    if (a.practiceCode === null) return 1;
    if (b.practiceCode === null) return -1;
    return a.practiceCode.localeCompare(b.practiceCode);
  }
  const rankDiff = allocationRank(a) - allocationRank(b);
  if (rankDiff !== 0) return rankDiff;
  if (a.assignmentEndDate !== b.assignmentEndDate) return a.assignmentEndDate.localeCompare(b.assignmentEndDate);
  return a.code.localeCompare(b.code);
}

export function buildControlCenter({ departments, teams, positions, deployments: allDated, assignments, month, today, resources, actualCosts, plannedCosts, competencies = [] }) {
  const window = monthWindow(month);
  const deployments = deployedOn(allDated, referenceDay(window, today));
  const costs = buildCostContext({ resources, actualCosts, plannedCosts });
  const practiceByCompetency = new Map(competencies.map((c) => [c.name, c]));
  const positionsByTeam = indexBy(positions, "teamCode");
  const deploymentsByPosition = indexBy(deployments, "positionCode");
  const assignmentsByTeam = indexBy(assignments, "teamCode");
  const teamsByDepartment = indexBy(teams, "departmentCode");

  const buildTeam = (team) => {
    const teamPositions = positionsByTeam.get(team.code) ?? [];
    const teamCompetencies = competenciesOf(teamPositions);
    const teamAssignments = assignmentsByTeam.get(team.code) ?? [];
    // The team's practice is its main competency's practice.
    const practice = practiceByCompetency.get(teamCompetencies.primary);
    if (teamCompetencies.primary && !practice && !warnedCompetencies.has(teamCompetencies.primary)) {
      warnedCompetencies.add(teamCompetencies.primary);
      console.warn(`Control Center: competency "${teamCompetencies.primary}" has no live practice, so its teams are shown under No practice.`);
    }
    return {
      code: team.code,
      name: team.name,
      primaryCompetency: teamCompetencies.primary,
      competencies: teamCompetencies.all,
      practiceCode: practice?.practiceCode ?? null,
      practiceName: practice?.practiceName ?? null,
      ...teamHours({
        teamPositions,
        deploymentsByPosition,
        teamAssignments,
        window,
      }),
      assignmentEndDate: currentAssignmentOf(teamAssignments, today)?.end ?? null,
      ...(({ allocatedTeamCost, defaultedCostCount }) => ({ allocatedTeamCost, defaultedCostCount }))(
        teamCosts({ teamPositions, deploymentsByPosition, costs })
      ),
    };
  };

  return {
    month,
    // Top floor first, as the building is drawn.
    departments: [...departments]
      .sort((a, b) => b.floorNumber - a.floorNumber)
      .map((department) => ({
        code: department.code,
        name: department.name,
        floorNumber: department.floorNumber,
        teams: (teamsByDepartment.get(department.code) ?? [])
          .map(buildTeam)
          // Grouped by practice, then by allocation band.
          .sort(byPracticeThenAllocation),
      })),
  };
}

// Everything the popup shows for one team: its seats with who sits in them,
// each person's share in this seat and what they have left overall.
export function buildTeamDetail({ team, department, positions, deployments: teamDated, allDeployments: allDated, assignments, month, today, resources, actualCosts, plannedCosts }) {
  const window = monthWindow(month);
  const day = referenceDay(window, today);
  const deployments = deployedOn(teamDated, day);
  const allDeployments = deployedOn(allDated, day);
  const costs = buildCostContext({ resources, actualCosts, plannedCosts });
  const totalByEmployee = new Map();
  for (const d of allDeployments) {
    totalByEmployee.set(d.employeeId, (totalByEmployee.get(d.employeeId) ?? 0) + d.allocationPercentage);
  }
  const deploymentsByPosition = indexBy(deployments, "positionCode");
  const teamCost = teamCosts({ teamPositions: positions, deploymentsByPosition, costs });
  const current = currentAssignmentOf(assignments, today);

  const seats = positions.flatMap((position) => {
    const counted = COUNTED_POSITIONS.has(position.name);
    const occupants = deploymentsByPosition.get(position.code) ?? [];
    const base = { positionCode: position.code, positionName: position.name, counted };
    if (occupants.length === 0) {
      return [{ ...base, employeeId: null, employeeName: null, allocationPercentage: null, availablePercentage: null, ...NO_COST }];
    }
    return occupants.map((d) => ({
      ...base,
      employeeId: d.employeeId,
      employeeName: d.employeeName,
      allocationPercentage: d.allocationPercentage,
      availablePercentage: Math.max(0, round1(100 - totalByEmployee.get(d.employeeId))),
      ...(teamCost.byPerson.get(`${position.code}:${d.employeeId}`) ?? NO_COST),
    }));
  });

  return {
    code: team.code,
    name: team.name,
    department: { code: department?.code ?? team.departmentCode, name: department?.name ?? null },
    month,
    competencies: competenciesOf(positions).all,
    seats,
    // Only the assignment covering today: the Projects list, the card's end date
    // and the month-by-month panels all follow it.
    projects: current
      ? [{ id: current.id, projectId: current.projectId, projectName: current.projectName, start: current.start, end: current.end }]
      : [],
    assignmentEndDate: current?.end ?? null,
    nextAssignment: (({ id, projectId, projectName, start, end }) => ({ id, projectId, projectName, start, end }))(
      nextAssignmentOf(assignments, today) ?? { id: null, projectId: null, projectName: null, start: null, end: null }
    ),
    allocatedTeamCost: teamCost.allocatedTeamCost,
    defaultedCostCount: teamCost.defaultedCostCount,
    locationMix: teamCost.locationMix,
    monthlyPlan: monthlyPlan(current, teamCost.allocatedTeamCost),
    ...teamHours({ teamPositions: positions, deploymentsByPosition, teamAssignments: assignments, window }),
  };
}

export async function loadControlCenterRows(query) {
  const [departments, teams, positions, deployments, assignments, resources, actualCosts, plannedCosts, competencies] = await Promise.all([
    query('select code, name, floor_number as "floorNumber" from departments where deleted_at is null order by code'),
    query('select code, name, department_code as "departmentCode" from teams where deleted_at is null order by code'),
    query('select code, name, team_code as "teamCode", competencies from positions where deleted_at is null order by code'),
    query(
      `select rd.employee_id as "employeeId", r.name as "employeeName", rd.position_code as "positionCode",
              rd.allocation_percentage::float as "allocationPercentage",
              rd.start_date::text as start, rd.end_date::text as "end"
         from resource_deployment rd
         join resources r on r.employee_id = rd.employee_id and r.deleted_at is null
        where rd.deleted_at is null`
    ),
    query(
      `select pa.id, pa.team_code as "teamCode", pa.project_id as "projectId", p.project_name as "projectName",
              pa.project_assignment_start_date::text as start, pa.project_assignment_end_date::text as "end"
         from project_assignments pa
         left join projects p on p.project_id = pa.project_id and p.deleted_at is null
        where pa.deleted_at is null`
    ),
    query(
      `select employee_id as "employeeId", designation, location_type as "locationType"
         from resources
        where deleted_at is null
          and employee_id in (select employee_id from resource_deployment where deleted_at is null)`
    ),
    query(
      `select employee_id as "employeeId", offshore_cost::float as "offshoreCost", onsite_cost::float as "onsiteCost"
         from resource_cost where deleted_at is null`
    ),
    query(
      `select designation, offshore_cost::float as "offshoreCost", onsite_cost::float as "onsiteCost"
         from planned_resource_costs where deleted_at is null`
    ),
    // Only competencies whose practice is live resolve to a practice, and a
    // practice cannot be deleted while live competencies belong to it.
    query(
      `select c.name, c.practice_code as "practiceCode", p.name as "practiceName"
         from competencies c
         join practices p on p.code = c.practice_code and p.deleted_at is null
        where c.deleted_at is null`
    ),
  ]);
  return {
    departments: departments.rows,
    teams: teams.rows,
    positions: positions.rows,
    deployments: deployments.rows,
    assignments: assignments.rows,
    resources: resources.rows,
    actualCosts: actualCosts.rows,
    plannedCosts: plannedCosts.rows,
    competencies: competencies.rows,
  };
}
