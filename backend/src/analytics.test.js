import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPeople, buildSeats, monthsBetween, validateRange, MAX_MONTHS } from "./analytics.js";

const rows = {
  departments: [{ code: "DEPT-1", name: "Design Services", floorNumber: 3 }],
  teams: [
    { code: "TEAM-1", name: "Alpha", departmentCode: "DEPT-1" },
    { code: "TEAM-2", name: "Orphan", departmentCode: "DEPT-GONE" },
  ],
  positions: [
    { code: "POS-1", name: "Module Lead", teamCode: "TEAM-1", competencies: "FICO" },
    { code: "POS-2", name: "Consultant", teamCode: "TEAM-1", competencies: "FICO" },
    { code: "POS-3", name: "Lead Consultant", teamCode: "TEAM-1", competencies: "FICO" },
    { code: "POS-4", name: "Consultant", teamCode: "TEAM-2", competencies: null },
  ],
  deployments: [
    { employeeId: 1, employeeName: "Ann", positionCode: "POS-1", allocationPercentage: 100, start: "2026-01-01", end: "2026-12-31" },
    { employeeId: 2, employeeName: "Bo", positionCode: "POS-2", allocationPercentage: 50, start: "2026-01-01", end: "2026-10-31" },
    { employeeId: 3, employeeName: "Cy", positionCode: "POS-2", allocationPercentage: 80, start: "2026-01-01", end: "2026-10-31" },
  ],
  assignments: [{ teamCode: "TEAM-1", start: "2026-10-01", end: "2026-10-15" }],
  competencies: [{ name: "FICO", practiceName: "Finance" }],
};

test("monthsBetween lists every month across a year boundary, both ends included", () => {
  assert.deepEqual(monthsBetween("2026-11", "2027-02"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.deepEqual(monthsBetween("2026-10", "2026-10"), ["2026-10"]);
});

test("validateRange rejects bad months, a reversed range and one longer than the cap", () => {
  assert.deepEqual(validateRange("2026-10", "2026-12"), {});
  assert.ok(validateRange("2026-13", "2026-12").from);
  assert.ok(validateRange("2026-10", "oct").to);
  assert.ok(validateRange("2026-12", "2026-10").to);
  assert.equal(Object.keys(validateRange("2026-01", "2027-12")).length, 0);
  assert.ok(validateRange("2026-01", "2028-01").to.includes(String(MAX_MONTHS)));
});

test("buildPeople splits skills, trims them, caps them and drops the raw skill text", () => {
  const [person] = buildPeople([{ employeeId: 1, skill: " FI , MM,, " + "x".repeat(60), allocation: 0 }]);
  assert.equal("skill" in person, false);
  assert.equal(person.skills.length, 3);
  assert.equal(person.skills[0], "FI");
  assert.equal(person.skills[2].length, 40);
  assert.deepEqual(buildPeople([{ skill: null }])[0].skills, []);
  assert.equal(buildPeople([{ skill: "a,b,c,d,e,f,g,h,i,j" }])[0].skills.length, 5);
});

test("buildSeats counts only Consultant and Lead Consultant seats, one row per seat per month", () => {
  const seats = buildSeats(rows, "2026-10", "2026-11", "2026-10-20");
  assert.equal(seats.length, 6);
  assert.deepEqual([...new Set(seats.map((s) => s.positionName))].sort(), ["Consultant", "Lead Consultant"]);
  assert.deepEqual([...new Set(seats.map((s) => s.month))], ["2026-10", "2026-11"]);
});

test("a seat's hours follow the Control Center rules and never exceed 160", () => {
  const [october] = buildSeats(rows, "2026-10", "2026-10", "2026-10-20").filter((s) => s.teamCode === "TEAM-1" && s.positionName === "Consultant");
  // 50% + 80% would be 208 hours, capped at one person's 160.
  assert.equal(october.allocatedHours, 160);
  assert.equal(october.availableHours, 160);
  assert.equal(october.filled, true);
  assert.equal(october.occupants.length, 2);
  // The team has an assignment for 15 of 31 days.
  assert.equal(october.utilizedHours, Math.round(((160 * 15) / 31) * 10) / 10);
});

test("a deployment counts only on the day the month is looked at", () => {
  // Bo and Cy end on 31 October. Looking at November's first day they are TBD.
  const november = buildSeats(rows, "2026-11", "2026-11", "2026-10-20").find((s) => s.teamCode === "TEAM-1" && s.positionName === "Consultant");
  assert.equal(november.filled, false);
  assert.equal(november.allocatedHours, 0);
  assert.equal(november.utilizedHours, 0);
  assert.deepEqual(november.occupants, []);
});

test("a vacant seat, a team with no department and a team with no practice still produce a row", () => {
  const orphan = buildSeats(rows, "2026-10", "2026-10", "2026-10-20").find((s) => s.teamCode === "TEAM-2");
  assert.equal(orphan.departmentName, null);
  assert.equal(orphan.practiceName, null);
  assert.equal(orphan.filled, false);
  const alpha = buildSeats(rows, "2026-10", "2026-10", "2026-10-20").find((s) => s.teamCode === "TEAM-1");
  assert.equal(alpha.practiceName, "Finance");
  assert.equal(alpha.departmentName, "Design Services");
});
