import { test } from "node:test";
import assert from "node:assert/strict";
import { buildControlCenter, buildTeamDetail, monthWindow, HOURS_PER_PERSON } from "./controlCenter.js";

const today = "2026-10-30"; // October: 31 days

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
  today,
};

const teamOf = (result, code) => result.departments.flatMap((d) => d.teams).find((t) => t.code === code);

test("monthWindow covers the whole calendar month", () => {
  assert.equal(monthWindow("2026-02-10").days, 28);
  assert.equal(monthWindow("2026-10-30").days, 31);
});

test("members count Consultants and Lead Consultants, never the Module Lead", () => {
  const team = teamOf(buildControlCenter(base), "TEAM-001");
  assert.equal(team.memberCount, 2);
  assert.equal(team.seatCount, 3);
  assert.equal(team.vacantSeatCount, 1);
});

test("available hours are 160 per person scaled by their allocation in the team", () => {
  const team = teamOf(buildControlCenter(base), "TEAM-001");
  assert.equal(team.availableHours, HOURS_PER_PERSON * 1 + (HOURS_PER_PERSON * 50) / 100);
  const beta = teamOf(buildControlCenter(base), "TEAM-002");
  assert.equal(beta.availableHours, 40);
});

test("a team with no assignment this month has no allocated hours and is open", () => {
  const team = teamOf(buildControlCenter(base), "TEAM-001");
  assert.equal(team.allocatedHours, 0);
  assert.equal(team.utilizationPercent, 0);
  assert.equal(team.status, "open");
});

test("allocated hours are pro-rated by the days of the month an assignment covers", () => {
  const result = buildControlCenter({
    ...base,
    assignments: [{ teamCode: "TEAM-001", projectId: "P1", start: "2026-09-20", end: "2026-10-10" }],
  });
  const team = teamOf(result, "TEAM-001");
  // Oct 1-10 = 10 of 31 days
  assert.equal(team.allocatedHours, Math.round(((240 * 10) / 31) * 10) / 10);
  assert.equal(team.utilizationPercent, Math.round((10 / 31) * 100));
  assert.equal(team.status, "open");
});

test("overlapping assignments count each day once, and a full month is 'full'", () => {
  const result = buildControlCenter({
    ...base,
    assignments: [
      { teamCode: "TEAM-001", projectId: "P1", start: "2026-01-01", end: "2026-10-20" },
      { teamCode: "TEAM-001", projectId: "P2", start: "2026-10-15", end: "2026-12-31" },
    ],
  });
  const team = teamOf(result, "TEAM-001");
  assert.equal(team.allocatedHours, team.availableHours);
  assert.equal(team.utilizationPercent, 100);
  assert.equal(team.status, "full");
});

test("a team nobody is deployed to is 'empty', not 'open'", () => {
  const result = buildControlCenter({ ...base, deployments: [] });
  assert.equal(teamOf(result, "TEAM-001").status, "empty");
  assert.equal(teamOf(result, "TEAM-001").utilizationPercent, 0);
});

test("assignments of other teams and teams without positions do not break the totals", () => {
  const result = buildControlCenter({
    ...base,
    teams: [...base.teams, { code: "TEAM-003", name: "Gamma", departmentCode: "DEPT-002" }],
    assignments: [{ teamCode: "TEAM-002", projectId: "P9", start: "2026-10-01", end: "2026-10-31" }],
  });
  assert.equal(teamOf(result, "TEAM-001").allocatedHours, 0);
  assert.equal(teamOf(result, "TEAM-003").seatCount, 0);
  assert.equal(teamOf(result, "TEAM-003").status, "empty");
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
    assignments: [],
    today,
  });
  assert.equal(detail.department.name, "Design Services");
  const split = detail.seats.find((s) => s.employeeId === 3);
  assert.equal(split.allocationPercentage, 50);
  assert.equal(split.availablePercentage, 25); // 100 - (50 + 25 across two teams)
  const moduleLead = detail.seats.find((s) => s.positionCode === "POS-1");
  assert.equal(moduleLead.counted, false);
  const vacant = detail.seats.find((s) => s.positionCode === "POS-4");
  assert.deepEqual([vacant.employeeId, vacant.allocationPercentage, vacant.availablePercentage], [null, null, null]);
  assert.equal(detail.monthCoveragePercent, 0);
});
