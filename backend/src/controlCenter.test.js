import { test } from "node:test";
import assert from "node:assert/strict";
import { buildControlCenter, buildTeamDetail, isValidMonth, monthWindow, HOURS_PER_PERSON } from "./controlCenter.js";

const month = "2026-10"; // 31 days

const base = {
  departments: [
    { code: "DEPT-002", name: "Design Services" },
    { code: "DEPT-099", name: "Empty Department" },
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
    assignments: [{ teamCode: "TEAM-001", projectId: "P1", projectName: "Rollout", start: "2026-10-01", end: "2026-10-31" }],
    month,
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
