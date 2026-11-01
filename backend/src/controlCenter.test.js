import { test } from "node:test";
import assert from "node:assert/strict";
import { buildControlCenter, buildTeamDetail, isValidMonth, monthWindow, HOURS_PER_PERSON } from "./controlCenter.js";

const month = "2026-10"; // 31 days

const base = {
  departments: [
    { code: "DEPT-002", name: "Design Services", floorNumber: 10 },
    { code: "DEPT-099", name: "Empty Department", floorNumber: 11 },
  ],
  teams: [
    { code: "TEAM-001", name: "Alpha", departmentCode: "DEPT-002" },
    { code: "TEAM-002", name: "Beta", departmentCode: "DEPT-002" },
  ],
  positions: [
    { code: "POS-1", name: "Module Lead", teamCode: "TEAM-001", competencies: "FICO" },
    { code: "POS-2", name: "Lead Consultant", teamCode: "TEAM-001", competencies: "FICO" },
    { code: "POS-3", name: "Consultant", teamCode: "TEAM-001", competencies: "FICO, MM" },
    { code: "POS-4", name: "Consultant", teamCode: "TEAM-001", competencies: "FICO" },
    { code: "POS-5", name: "Consultant", teamCode: "TEAM-002", competencies: null },
  ],
  deployments: [
    { employeeId: 1, employeeName: "Module Lead Person", positionCode: "POS-1", allocationPercentage: 100 },
    { employeeId: 2, employeeName: "Lead Person", positionCode: "POS-2", allocationPercentage: 100 },
    { employeeId: 3, employeeName: "Split Person", positionCode: "POS-3", allocationPercentage: 50 },
    { employeeId: 3, employeeName: "Split Person", positionCode: "POS-5", allocationPercentage: 25 },
  ],
  assignments: [],
  month,
};

const teamOf = (result, code) => result.departments.flatMap((d) => d.teams).find((t) => t.code === code);

test("month helpers", () => {
  assert.equal(monthWindow("2026-02").days, 28);
  assert.equal(monthWindow("2026-10").days, 31);
  assert.ok(isValidMonth("2026-10"));
  for (const bad of ["2026-13", "2026-1", "10-2026", "", undefined, "2026-10-01"]) assert.ok(!isValidMonth(bad), String(bad));
});

test("month windows roll over the year and follow leap years", () => {
  const dec = monthWindow("2026-12");
  assert.equal(dec.days, 31);
  assert.equal(new Date(dec.end).toISOString().slice(0, 10), "2026-12-31");
  assert.equal(monthWindow("2028-02").days, 29);
  assert.ok(!isValidMonth("0099-05"));
});

test("an assignment that ends on the first day, or starts on the last day, covers exactly one day", () => {
  const oneDay = (start, end) =>
    teamOf(buildControlCenter({ ...base, assignments: [{ teamCode: "TEAM-001", projectId: "P", start, end }] }), "TEAM-001").monthCoveragePercent;
  assert.equal(oneDay("2026-09-01", "2026-10-01"), Math.round((1 / 31) * 100));
  assert.equal(oneDay("2026-10-31", "2026-12-01"), Math.round((1 / 31) * 100));
  assert.equal(oneDay("2026-09-01", "2026-09-30"), 0);
});

test("members and seats count Consultants and Lead Consultants, never the Module Lead", () => {
  const team = teamOf(buildControlCenter(base), "TEAM-001");
  assert.equal(team.memberCount, 2);
  assert.equal(team.seatCount, 3);
  assert.equal(team.vacantSeatCount, 1);
});

test("available hours are the seats times 160, filled or not", () => {
  assert.equal(teamOf(buildControlCenter(base), "TEAM-001").availableHours, 3 * HOURS_PER_PERSON);
  assert.equal(teamOf(buildControlCenter(base), "TEAM-002").availableHours, HOURS_PER_PERSON);
});

test("allocated hours are the filled seats at 160 scaled by allocation percentage", () => {
  const team = teamOf(buildControlCenter(base), "TEAM-001");
  assert.equal(team.allocatedHours, 160 + 80); // 100% lead + 50% consultant, one seat empty
  assert.equal(team.vacantHours, 240);
  assert.equal(teamOf(buildControlCenter(base), "TEAM-002").allocatedHours, 40);
});

test("a seat never contributes more than 160 hours even with two people in it", () => {
  const result = buildControlCenter({
    ...base,
    deployments: [
      { employeeId: 2, employeeName: "A", positionCode: "POS-2", allocationPercentage: 100 },
      { employeeId: 9, employeeName: "B", positionCode: "POS-2", allocationPercentage: 60 },
    ],
  });
  assert.equal(teamOf(result, "TEAM-001").allocatedHours, 160);
  assert.equal(teamOf(result, "TEAM-001").memberCount, 2);
});

test("no assignment in the month: nothing utilized, so the card is 'unused'", () => {
  const team = teamOf(buildControlCenter(base), "TEAM-001");
  assert.equal(team.utilizedHours, 0);
  assert.equal(team.utilizationPercent, 0);
  assert.equal(team.status, "unused");
});

test("utilized hours are the allocated hours scaled by the days of the month an assignment covers", () => {
  const result = buildControlCenter({
    ...base,
    assignments: [{ teamCode: "TEAM-001", projectId: "P1", start: "2026-09-20", end: "2026-10-10" }],
  });
  const team = teamOf(result, "TEAM-001");
  assert.equal(team.utilizedHours, Math.round(((240 * 10) / 31) * 10) / 10); // Oct 1-10
  assert.equal(team.utilizationPercent, Math.round((10 / 31) * 100));
  assert.equal(team.status, "partial");
});

test("overlapping assignments count each day once, and a fully covered month is 'full'", () => {
  const result = buildControlCenter({
    ...base,
    assignments: [
      { teamCode: "TEAM-001", projectId: "P1", start: "2026-01-01", end: "2026-10-20" },
      { teamCode: "TEAM-001", projectId: "P2", start: "2026-10-15", end: "2026-12-31" },
    ],
  });
  const team = teamOf(result, "TEAM-001");
  assert.equal(team.utilizedHours, team.allocatedHours);
  assert.equal(team.status, "full");
});

test("the same data reads differently in another month", () => {
  const assignments = [{ teamCode: "TEAM-001", projectId: "P1", start: "2026-11-01", end: "2026-11-30" }];
  assert.equal(teamOf(buildControlCenter({ ...base, assignments, month: "2026-10" }), "TEAM-001").status, "unused");
  assert.equal(teamOf(buildControlCenter({ ...base, assignments, month: "2026-11" }), "TEAM-001").status, "full");
});

test("a team nobody is deployed to is 'unstaffed', not 'unused'", () => {
  const result = buildControlCenter({ ...base, deployments: [] });
  assert.equal(teamOf(result, "TEAM-001").status, "unstaffed");
  assert.equal(teamOf(result, "TEAM-001").utilizationPercent, 0);
});

test("other teams' assignments and teams without positions do not affect a team", () => {
  const result = buildControlCenter({
    ...base,
    teams: [...base.teams, { code: "TEAM-003", name: "Gamma", departmentCode: "DEPT-002" }],
    assignments: [{ teamCode: "TEAM-002", projectId: "P9", start: "2026-10-01", end: "2026-10-31" }],
  });
  assert.equal(teamOf(result, "TEAM-001").utilizedHours, 0);
  assert.equal(teamOf(result, "TEAM-003").seatCount, 0);
  assert.equal(teamOf(result, "TEAM-003").status, "unstaffed");
});

test("teams are grouped by main competency, then code; a department can have no teams", () => {
  const result = buildControlCenter(base);
  const design = result.departments.find((d) => d.code === "DEPT-002");
  assert.deepEqual(design.teams.map((t) => t.code), ["TEAM-001", "TEAM-002"]);
  assert.equal(design.teams[0].primaryCompetency, "FICO");
  assert.deepEqual(design.teams[0].competencies, ["FICO", "MM"]);
  assert.equal(design.teams[1].primaryCompetency, null);
  assert.deepEqual(result.departments.find((d) => d.code === "DEPT-099").teams, []);
});

test("team detail lists every seat, marks vacant ones, and shows what each person has left overall", () => {
  const detail = buildTeamDetail({
    team: base.teams[0],
    department: base.departments[0],
    positions: base.positions.filter((p) => p.teamCode === "TEAM-001"),
    deployments: base.deployments.filter((d) => ["POS-1", "POS-2", "POS-3"].includes(d.positionCode)),
    allDeployments: base.deployments,
    assignments: [{ id: "A-1", teamCode: "TEAM-001", projectId: "P1", projectName: "Rollout", start: "2026-10-01", end: "2026-10-31" }],
    month,
    today: "2026-10-15",
  });
  assert.equal(detail.department.name, "Design Services");
  assert.equal(detail.status, "full");
  assert.equal(detail.projects[0].projectName, "Rollout");
  const split = detail.seats.find((s) => s.employeeId === 3);
  assert.equal(split.allocationPercentage, 50);
  assert.equal(split.availablePercentage, 25); // 100 - (50 + 25 across two teams)
  assert.equal(detail.seats.find((s) => s.positionCode === "POS-1").counted, false);
  const vacant = detail.seats.find((s) => s.positionCode === "POS-4");
  assert.deepEqual([vacant.employeeId, vacant.allocationPercentage, vacant.availablePercentage], [null, null, null]);
});

test("a person allocated over 100% across teams has 0% available, never negative", () => {
  const detail = buildTeamDetail({
    team: base.teams[0],
    department: base.departments[0],
    positions: base.positions.filter((p) => p.code === "POS-2"),
    deployments: [{ employeeId: 2, employeeName: "Lead Person", positionCode: "POS-2", allocationPercentage: 100 }],
    allDeployments: [
      { employeeId: 2, employeeName: "Lead Person", positionCode: "POS-2", allocationPercentage: 100 },
      { employeeId: 2, employeeName: "Lead Person", positionCode: "POS-9", allocationPercentage: 40 },
    ],
    assignments: [],
    month,
  });
  assert.equal(detail.seats[0].availablePercentage, 0);
});

test("departments are listed top floor first, by their floor number, not by code", () => {
  const result = buildControlCenter({
    ...base,
    departments: [
      { code: "DEPT-001", name: "Ground", floorNumber: 1 },
      { code: "DEPT-009", name: "Penthouse", floorNumber: 13 },
      { code: "DEPT-005", name: "Middle", floorNumber: 6 },
    ],
    teams: [],
  });
  assert.deepEqual(result.departments.map((d) => [d.floorNumber, d.name]), [[13, "Penthouse"], [6, "Middle"], [1, "Ground"]]);
});

// Costs, the current assignment and the month-by-month plan.
const PLANNED = [
  { designation: "Senior Consultant", offshoreCost: 1800, onsiteCost: 3300 },
  { designation: "Consultant", offshoreCost: 1500, onsiteCost: 2400 },
  { designation: "Analyst", offshoreCost: 1000, onsiteCost: 1750 },
];
const PEOPLE = [
  { employeeId: 2, designation: "Consultant", locationType: "Offshore" },
  { employeeId: 3, designation: "Analyst", locationType: "Onsite" },
];
const costInputs = { resources: PEOPLE, actualCosts: [], plannedCosts: PLANNED };
const detailOf = (overrides = {}) =>
  buildTeamDetail({
    team: base.teams[0],
    department: base.departments[0],
    positions: base.positions.filter((p) => p.teamCode === "TEAM-001"),
    deployments: base.deployments.filter((d) => ["POS-1", "POS-2", "POS-3"].includes(d.positionCode)),
    allDeployments: base.deployments,
    assignments: [],
    month,
    today: "2026-10-15",
    ...costInputs,
    ...overrides,
  });
const seatOf = (detail, employeeId) => detail.seats.find((s) => s.employeeId === employeeId);

test("a person's cost is their designation's planned cost for their location, times the allocation", () => {
  const detail = detailOf();
  assert.deepEqual(
    [seatOf(detail, 2).plannedResourceCost, seatOf(detail, 2).actualResourceCost, seatOf(detail, 2).allocatedResourceCost, seatOf(detail, 2).costSource],
    [1500, null, 1500, "Planned"]
  );
  // Onsite analyst at 50%: 1750 x 0.5.
  assert.equal(seatOf(detail, 3).allocatedResourceCost, 875);
  assert.equal(detail.allocatedTeamCost, 2375);
});

test("an Actual Resource Cost wins over the planned one, using the figure for the person's location", () => {
  const detail = detailOf({ actualCosts: [{ employeeId: 2, offshoreCost: 2000, onsiteCost: 9999 }] });
  const lead = seatOf(detail, 2);
  assert.deepEqual([lead.actualResourceCost, lead.plannedResourceCost, lead.allocatedResourceCost, lead.costSource], [2000, 1500, 2000, "Actual"]);
});

test("an actual cost with no figure for the person's location falls back to the planned cost", () => {
  const detail = detailOf({ actualCosts: [{ employeeId: 2, offshoreCost: null, onsiteCost: 5000 }] });
  assert.deepEqual([seatOf(detail, 2).costSource, seatOf(detail, 2).allocatedResourceCost], ["Planned", 1500]);
});

test("a designation with no planned cost is costed as a Senior Consultant and tagged Default", () => {
  const detail = detailOf({ resources: [{ employeeId: 2, designation: "Office Assistant", locationType: "Onsite" }, PEOPLE[1]] });
  assert.deepEqual([seatOf(detail, 2).costSource, seatOf(detail, 2).allocatedResourceCost], ["Default", 3300]);
});

test("a person with no location type is costed as offshore", () => {
  const detail = detailOf({ resources: [{ employeeId: 2, designation: "Consultant", locationType: null }, PEOPLE[1]] });
  assert.equal(seatOf(detail, 2).allocatedResourceCost, 1500);
});

test("vacant seats and the Module Lead carry no cost and add nothing to the team cost", () => {
  const detail = detailOf();
  for (const code of ["POS-1", "POS-4"]) {
    const seat = detail.seats.find((s) => s.positionCode === code);
    assert.deepEqual([seat.plannedResourceCost, seat.actualResourceCost, seat.allocatedResourceCost, seat.costSource], [null, null, null, null]);
  }
});

test("the location mix is Onsite, Offshore or Hybrid from the people deployed now", () => {
  assert.equal(detailOf().locationMix, "Hybrid");
  assert.equal(detailOf({ resources: [{ ...PEOPLE[0], locationType: "Onsite" }, PEOPLE[1]] }).locationMix, "Onsite");
  assert.equal(detailOf({ resources: [PEOPLE[0], { ...PEOPLE[1], locationType: "Offshore" }] }).locationMix, "Offshore");
  assert.equal(detailOf({ deployments: [] }).locationMix, null);
});

test("the card carries the assignment end date and the allocated team cost", () => {
  const assignments = [{ id: "A", teamCode: "TEAM-001", projectId: "P", start: "2026-09-01", end: "2026-12-05" }];
  const team = teamOf(buildControlCenter({ ...base, assignments, today: "2026-10-15", ...costInputs }), "TEAM-001");
  assert.equal(team.assignmentEndDate, "2026-12-05");
  assert.equal(team.allocatedTeamCost, 2375);
  const idle = teamOf(buildControlCenter({ ...base, assignments, today: "2027-01-01", ...costInputs }), "TEAM-001");
  assert.equal(idle.assignmentEndDate, null);
  const none = teamOf(buildControlCenter({ ...base, assignments: [], today: "2026-10-15", ...costInputs }), "TEAM-002");
  assert.equal(none.assignmentEndDate, null);
});

test("the end date counts on the day itself, and an assignment starting tomorrow is not current", () => {
  const at = (start, end, today) =>
    teamOf(buildControlCenter({ ...base, assignments: [{ id: "A", teamCode: "TEAM-001", projectId: "P", start, end }], today, ...costInputs }), "TEAM-001").assignmentEndDate;
  assert.equal(at("2026-09-01", "2026-12-05", "2026-12-05"), "2026-12-05");
  assert.equal(at("2026-09-01", "2026-12-05", "2026-12-06"), null);
  assert.equal(at("2026-12-06", "2027-01-31", "2026-12-05"), null);
});

test("the monthly plan runs from the assignment's start month to its end month, prorating part months", () => {
  const detail = detailOf({ assignments: [{ id: "A", teamCode: "TEAM-001", projectId: "P", projectName: "Rollout", start: "2026-09-01", end: "2026-12-05" }] });
  const plan = detail.monthlyPlan;
  assert.deepEqual(plan.months.map((m) => m.month), ["2026-09", "2026-10", "2026-11", "2026-12"]);
  assert.deepEqual(plan.months.map((m) => m.utilizationPercent), [100, 100, 100, 16.13]);
  assert.deepEqual(plan.months.map((m) => m.cost), [2375, 2375, 2375, 383.06]);
  assert.equal(plan.totalCost, 7508.06);
  assert.equal(detail.assignmentEndDate, "2026-12-05");
  assert.deepEqual(detail.projects.map((p) => [p.id, p.projectName]), [["A", "Rollout"]]);
});

test("a start part way through a month is prorated too, and the plan crosses a year end", () => {
  const detail = detailOf({ assignments: [{ id: "A", teamCode: "TEAM-001", projectId: "P", start: "2026-12-16", end: "2027-01-15" }], today: "2026-12-20" });
  assert.deepEqual(detail.monthlyPlan.months.map((m) => [m.month, m.utilizationPercent]), [["2026-12", 51.61], ["2027-01", 48.39]]);
});

test("a team with no current assignment shows no projects and an empty plan", () => {
  const detail = detailOf({ assignments: [{ id: "A", teamCode: "TEAM-001", projectId: "P", start: "2026-01-01", end: "2026-02-01" }] });
  assert.deepEqual([detail.projects, detail.assignmentEndDate, detail.monthlyPlan], [[], null, { months: [], totalCost: 0, truncated: false }]);
});

test("when even the Senior Consultant planned cost is gone, a person costs zero and is tagged Missing, not Default", () => {
  const detail = detailOf({ plannedCosts: PLANNED.filter((c) => c.designation !== "Senior Consultant" && c.designation !== "Consultant") });
  assert.deepEqual([seatOf(detail, 2).costSource, seatOf(detail, 2).allocatedResourceCost, seatOf(detail, 2).plannedResourceCost], ["Missing", 0, null]);
});

test("a person who is not in the resources list is costed offshore at the default rate", () => {
  const detail = detailOf({ resources: [PEOPLE[1]] });
  assert.deepEqual([seatOf(detail, 2).costSource, seatOf(detail, 2).allocatedResourceCost], ["Default", 1800]);
});

test("a partial allocation scales an actual cost too", () => {
  const detail = detailOf({ actualCosts: [{ employeeId: 3, offshoreCost: 900, onsiteCost: 2000 }] });
  // Onsite, 50%: 2000 x 0.5.
  assert.equal(seatOf(detail, 3).allocatedResourceCost, 1000);
});

test("a person deployed in a Module Lead seat is not costed and not counted in the team cost", () => {
  const detail = detailOf();
  const moduleLead = detail.seats.find((s) => s.positionCode === "POS-1");
  assert.equal(moduleLead.employeeId, 1);
  assert.deepEqual([moduleLead.allocatedResourceCost, moduleLead.costSource], [null, null]);
  assert.equal(detail.allocatedTeamCost, 2375);
});

test("the team counts how many people were costed at the default rate", () => {
  const defaulted = detailOf({ resources: [{ employeeId: 2, designation: "Office Assistant", locationType: "Onsite" }, PEOPLE[1]] });
  assert.equal(defaulted.defaultedCostCount, 1);
  assert.equal(detailOf().defaultedCostCount, 0);
  const card = teamOf(buildControlCenter({ ...base, today: "2026-10-15", resources: [{ employeeId: 2, designation: "Office Assistant", locationType: "Onsite" }, PEOPLE[1]], actualCosts: [], plannedCosts: PLANNED }), "TEAM-001");
  assert.equal(card.defaultedCostCount, 1);
});

test("an assignment that starts after today is shown as the next assignment, never as the current one", () => {
  const detail = detailOf({
    assignments: [
      { id: "L", teamCode: "TEAM-001", projectId: "P2", projectName: "Later", start: "2027-03-01", end: "2027-04-01" },
      { id: "N", teamCode: "TEAM-001", projectId: "P1", projectName: "Next", start: "2026-12-06", end: "2027-01-31" },
    ],
  });
  assert.deepEqual(detail.projects, []);
  assert.deepEqual(detail.nextAssignment, { id: "N", projectId: "P1", projectName: "Next", start: "2026-12-06", end: "2027-01-31" });
});

test("a very long assignment is cut at 120 months and says so", () => {
  const detail = detailOf({ assignments: [{ id: "A", teamCode: "TEAM-001", projectId: "P", start: "2026-01-01", end: "9999-12-31" }] });
  assert.equal(detail.monthlyPlan.months.length, 120);
  assert.equal(detail.monthlyPlan.truncated, true);
  assert.equal(detailOf({ assignments: [{ id: "A", teamCode: "TEAM-001", projectId: "P", start: "2026-09-01", end: "2026-12-05" }] }).monthlyPlan.truncated, false);
});

// Practice grouping and the order inside a practice.
const COMPETENCIES = [
  { name: "FICO", practiceCode: "PRAC-001", practiceName: "Finance" },
  { name: "MM", practiceCode: "PRAC-002", practiceName: "Logistics Buy Side" },
  { name: "ECP", practiceCode: "PRAC-004", practiceName: "HXM" },
];
const teamPlan = [
  // [team, competency, assignment end or null]
  ["TEAM-A", "FICO", "2026-12-05"],
  ["TEAM-B", "FICO", "2026-11-20"],
  ["TEAM-C", "FICO", null],
  ["TEAM-D", "MM", "2026-12-01"],
  ["TEAM-E", "ECP", "2027-02-28"],
  ["TEAM-F", "ECP", null],
  ["TEAM-G", null, "2026-11-10"],
  ["TEAM-H", "ZZZ", null],
];
const practiceData = {
  departments: [{ code: "D", name: "Dept", floorNumber: 1 }],
  teams: teamPlan.map(([code]) => ({ code, name: code, departmentCode: "D" })),
  positions: teamPlan.flatMap(([code, competency], i) => (competency ? [{ code: `P-${i}`, name: "Consultant", teamCode: code, competencies: competency }] : [])),
  // Only TEAM-A (seat P-0) has someone deployed, so it is the only utilized team.
  deployments: [{ employeeId: 1, employeeName: "Person", positionCode: "P-0", allocationPercentage: 100 }],
  assignments: teamPlan.filter(([, , end]) => end).map(([code, , end]) => ({ id: code, teamCode: code, projectId: "P", start: "2026-01-01", end })),
  month,
  today: "2026-11-15",
  resources: [],
  actualCosts: [],
  plannedCosts: [],
  competencies: COMPETENCIES,
};
const floorOrder = () => buildControlCenter(practiceData).departments[0].teams.map((t) => t.code);

test("a team takes the practice of its main competency, or none when it has no competency or its competency is unknown", () => {
  const teams = buildControlCenter(practiceData).departments[0].teams;
  const by = (code) => teams.find((t) => t.code === code);
  assert.deepEqual([by("TEAM-A").practiceCode, by("TEAM-A").practiceName], ["PRAC-001", "Finance"]);
  assert.deepEqual([by("TEAM-G").practiceCode, by("TEAM-G").practiceName], [null, null]);
  assert.equal(by("TEAM-H").practiceCode, null);
});

test("teams are ordered by practice code, no practice last, and inside a practice by allocation band", () => {
  // Finance: B (allocated, nothing utilized), A (allocated, utilized), C (no assignment).
  // TEAM-G's assignment ended before today, so it counts as no assignment.
  assert.deepEqual(floorOrder(), ["TEAM-B", "TEAM-A", "TEAM-C", "TEAM-D", "TEAM-E", "TEAM-F", "TEAM-G", "TEAM-H"]);
});

test("an allocated team with nothing utilized comes before an allocated team that is utilized, whatever their end dates", () => {
  // TEAM-A ends later than TEAM-B and is utilized, so it must follow TEAM-B.
  // Moving TEAM-A's end date earlier changes nothing: the band decides first.
  const data = { ...practiceData, assignments: practiceData.assignments.map((a) => (a.teamCode === "TEAM-A" ? { ...a, end: "2026-11-16" } : a)) };
  const finance = buildControlCenter(data).departments[0].teams.filter((t) => t.practiceCode === "PRAC-001").map((t) => t.code);
  assert.deepEqual(finance, ["TEAM-B", "TEAM-A", "TEAM-C"]);
});

test("a team whose assignment has ended counts as unallocated and falls to the end of its practice", () => {
  const teams = buildControlCenter({ ...practiceData, today: "2026-12-10" }).departments[0].teams;
  const finance = teams.filter((t) => t.practiceCode === "PRAC-001").map((t) => t.code);
  // A, B and C all have no current assignment on 10 December, so they sort by team code.
  assert.deepEqual(finance, ["TEAM-A", "TEAM-B", "TEAM-C"]);
});

test("ties on the end date break by team code", () => {
  const data = { ...practiceData, assignments: practiceData.assignments.map((a) => (["TEAM-A", "TEAM-B"].includes(a.teamCode) ? { ...a, end: "2026-12-05" } : a)) };
  const finance = buildControlCenter(data).departments[0].teams.filter((t) => t.practiceCode === "PRAC-001").map((t) => t.code);
  // Same end date, but B has nothing utilized, so it still leads A. Make both unutilized to reach the tie.
  assert.deepEqual(finance, ["TEAM-B", "TEAM-A", "TEAM-C"]);
  const noDeployments = buildControlCenter({ ...data, deployments: [] }).departments[0].teams.filter((t) => t.practiceCode === "PRAC-001").map((t) => t.code);
  assert.deepEqual(noDeployments, ["TEAM-A", "TEAM-B", "TEAM-C"]);
});

test("teams with no live assignment sort by team code at the end of their practice", () => {
  const data = { ...practiceData, assignments: [] };
  const finance = buildControlCenter(data).departments[0].teams.filter((t) => t.practiceCode === "PRAC-001").map((t) => t.code);
  assert.deepEqual(finance, ["TEAM-A", "TEAM-B", "TEAM-C"]);
});

test("a team with several competencies takes the practice of the one used by most of its positions, ties by name", () => {
  const data = {
    ...practiceData,
    teams: [{ code: "TEAM-M", name: "Mixed", departmentCode: "D" }, { code: "TEAM-T", name: "Tied", departmentCode: "D" }],
    positions: [
      { code: "M1", name: "Consultant", teamCode: "TEAM-M", competencies: "MM, FICO" },
      { code: "M2", name: "Consultant", teamCode: "TEAM-M", competencies: "FICO" },
      { code: "M3", name: "Consultant", teamCode: "TEAM-M", competencies: "FICO, ECP" },
      { code: "T1", name: "Consultant", teamCode: "TEAM-T", competencies: "MM" },
      { code: "T2", name: "Consultant", teamCode: "TEAM-T", competencies: "FICO" },
    ],
    assignments: [],
  };
  const teams = buildControlCenter(data).departments[0].teams;
  assert.equal(teams.find((t) => t.code === "TEAM-M").practiceCode, "PRAC-001"); // FICO is on three positions
  assert.equal(teams.find((t) => t.code === "TEAM-T").practiceCode, "PRAC-001"); // MM and FICO tie, FICO sorts first
});

test("a team whose main competency has no live practice is reported once, not on every request", () => {
  const warnings = [];
  const original = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    const data = { ...practiceData, teams: [practiceData.teams[7]], positions: [{ code: "Z", name: "Consultant", teamCode: "TEAM-H", competencies: "ZZZ-UNKNOWN" }], assignments: [] };
    buildControlCenter(data);
    buildControlCenter(data);
  } finally {
    console.warn = original;
  }
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /"ZZZ-UNKNOWN" has no live practice/);
});
