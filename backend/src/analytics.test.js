import { test } from "node:test";
import assert from "node:assert/strict";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";
import { ASSIGNMENTS_SQL, buildPeople, buildSeats, buildStructure, HEALTH_SQL, monthsBetween, validateRange, MAX_MONTHS } from "./analytics.js";

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
  // The team has an assignment for 15 of 31 days.
  assert.equal(october.utilizedHours, Math.round(((160 * 15) / 31) * 10) / 10);
});

test("a deployment counts only on the day the month is looked at", () => {
  // Bo and Cy end on 31 October. Looking at November's first day they are TBD.
  const november = buildSeats(rows, "2026-11", "2026-11", "2026-10-20").find((s) => s.teamCode === "TEAM-1" && s.positionName === "Consultant");
  assert.equal(november.filled, false);
  assert.equal(november.allocatedHours, 0);
  assert.equal(november.utilizedHours, 0);
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

test("a half allocation is half a seat, utilized by the share of the month covered", () => {
  const half = { ...rows, deployments: [{ employeeId: 9, employeeName: "Dee", positionCode: "POS-3", allocationPercentage: 50, start: "2026-01-01", end: "2026-12-31" }] };
  const seat = buildSeats(half, "2026-10", "2026-10", "2026-10-20").find((s) => s.positionName === "Lead Consultant" && s.teamCode === "TEAM-1");
  assert.equal(seat.allocatedHours, 80);
  assert.equal(seat.utilizedHours, Math.round(((80 * 15) / 31) * 10) / 10);
});

test("a month before today is looked at on its first day, and one after on its first day too", () => {
  // Bo and Cy run until 31 October. In September (past) and in October (the
  // current month, looked at on today) they are deployed, in November not.
  const months = buildSeats(rows, "2026-09", "2026-11", "2026-10-20").filter((s) => s.teamCode === "TEAM-1" && s.positionName === "Consultant");
  assert.deepEqual(months.map((s) => s.filled), [true, true, false]);
});

test("monthsBetween gives nothing for a reversed range", () => {
  assert.deepEqual(monthsBetween("2026-12", "2026-01"), []);
});

const positionRow = (teamCode, positionName, competencies, over = {}) => ({ departmentName: "Design", floorNumber: 3, teamCode, teamName: teamCode, positionName, competencies, filled: false, ...over });

test("buildStructure gives each team the practice of its main competency and splits competencies into a list", () => {
  const rows = buildStructure(
    [positionRow("T1", "Consultant", "FICO, MM"), positionRow("T1", "Consultant", "FICO"), positionRow("T2", "Consultant", "MM"), positionRow("T3", "Module Lead", null)],
    [{ name: "FICO", practiceName: "Finance" }, { name: "MM", practiceName: "Logistics" }]
  );
  assert.deepEqual(rows.map((r) => r.practiceName), ["Finance", "Finance", "Logistics", null]);
  assert.deepEqual(rows[0].competencies, ["FICO", "MM"]);
  assert.deepEqual(rows[3].competencies, []);
});

test("buildStructure leaves the practice empty when the main competency has no live practice", () => {
  const [row] = buildStructure([positionRow("T1", "Consultant", "ABAP")], [{ name: "ABAP", practiceName: null }]);
  assert.equal(row.practiceName, null);
  const [unknown] = buildStructure([positionRow("T1", "Consultant", "GHOST")], []);
  assert.equal(unknown.practiceName, null);
});

test("buildStructure keeps the position fields and returns nothing for no positions", () => {
  const [row] = buildStructure([positionRow("T1", "Lead Consultant", "FICO", { filled: true })], []);
  assert.deepEqual({ ...row, competencies: undefined }, { departmentName: "Design", floorNumber: 3, teamCode: "T1", teamName: "T1", positionName: "Lead Consultant", filled: true, practiceName: null, competencies: undefined });
  assert.deepEqual(buildStructure([], []), []);
});

const costRows = {
  ...rows,
  deployments: [
    { employeeId: 1, employeeName: "Ann", positionCode: "POS-3", allocationPercentage: 100, start: "2026-01-01", end: "2026-12-31" },
    { employeeId: 2, employeeName: "Bo", positionCode: "POS-2", allocationPercentage: 50, start: "2026-01-01", end: "2026-12-31" },
  ],
  resources: [
    { employeeId: 1, designation: "Consultant", locationType: "Offshore" },
    { employeeId: 2, designation: "Consultant", locationType: "Onsite" },
  ],
  actualCosts: [{ employeeId: 1, offshoreCost: 1000, onsiteCost: 3000 }],
  plannedCosts: [{ designation: "Consultant", offshoreCost: 800, onsiteCost: 2000 }, { designation: "Senior Consultant", offshoreCost: 900, onsiteCost: 2500 }],
};

test("a seat's cost follows the Control Center rule: actual cost, else the designation's planned cost, scaled by allocation", () => {
  const seats = buildSeats(costRows, "2026-10", "2026-10", "2026-10-20").filter((s) => s.teamCode === "TEAM-1");
  const lead = seats.find((s) => s.positionName === "Lead Consultant");
  const consultant = seats.find((s) => s.positionName === "Consultant");
  assert.equal(lead.offshoreCost, 1000);
  assert.equal(lead.onsiteCost, 0);
  assert.equal(lead.actualPeople, 1);
  assert.equal(consultant.onsiteCost, 1000);
  assert.equal(consultant.plannedPeople, 1);
});

test("a vacant seat costs nothing and counts no people", () => {
  const vacant = buildSeats(costRows, "2026-10", "2026-10", "2026-10-20").find((s) => s.teamCode === "TEAM-2");
  assert.deepEqual([vacant.onsiteCost, vacant.offshoreCost, vacant.actualPeople, vacant.plannedPeople, vacant.defaultPeople, vacant.missingPeople], [0, 0, 0, 0, 0, 0]);
});

test("a designation with no planned cost falls back to the Senior Consultant cost and is counted as default", () => {
  const odd = { ...costRows, resources: [{ employeeId: 2, designation: "Intern", locationType: "Onsite" }, costRows.resources[0]] };
  const seat = buildSeats(odd, "2026-10", "2026-10", "2026-10-20").find((s) => s.positionName === "Consultant" && s.teamCode === "TEAM-1");
  assert.equal(seat.defaultPeople, 1);
  assert.equal(seat.onsiteCost, 1250);
});

test("the health query covers every master-data table and the checked resource columns, with no request data", () => {
  for (const route of ["practices", "resources", "project-assignments", "resource-deployment"]) assert.ok(HEALTH_SQL.includes(`'${route}'`), route);
  assert.ok(HEALTH_SQL.includes("'region'"));
  assert.equal(HEALTH_SQL.includes("$1"), false);
  // node-pg turns a date into a JS Date, which would arrive as a full timestamp.
  assert.ok(HEALTH_SQL.includes("date_trunc('week', created_at)::date::text"));
  assert.equal(HEALTH_SQL.includes("null::date"), false);
});

const poscost = (extra) => ({
  ...costRows,
  deployments: [
    { employeeId: 2, employeeName: "Bo", positionCode: "POS-2", allocationPercentage: 50, start: "2026-01-01", end: "2026-12-31" },
    { employeeId: 3, employeeName: "Cy", positionCode: "POS-2", allocationPercentage: 100, start: "2026-01-01", end: "2026-12-31" },
  ],
  resources: [
    { employeeId: 2, designation: "Consultant", locationType: "Onsite" },
    { employeeId: 3, designation: "Consultant", locationType: "Offshore" },
  ],
  actualCosts: [{ employeeId: 3, offshoreCost: 1000, onsiteCost: null }],
  ...extra,
});
const consultantSeat = (input) => buildSeats(input, "2026-10", "2026-10", "2026-10-20").find((s) => s.teamCode === "TEAM-1" && s.positionName === "Consultant");

test("a seat with two people sums each person's cost on their own side", () => {
  const seat = consultantSeat(poscost());
  assert.equal(seat.onsiteCost, 1000);
  assert.equal(seat.offshoreCost, 1000);
  assert.equal(seat.actualPeople, 1);
  assert.equal(seat.plannedPeople, 1);
});

test("two people on the same side add up on that side only", () => {
  const seat = consultantSeat(poscost({ resources: [{ employeeId: 2, designation: "Consultant", locationType: "Onsite" }, { employeeId: 3, designation: "Consultant", locationType: "Onsite" }], actualCosts: [] }));
  assert.equal(seat.onsiteCost, 3000);
  assert.equal(seat.offshoreCost, 0);
});

test("a person with no actual cost, no planned cost and no Senior Consultant row is costed at zero and counted as missing", () => {
  const seat = consultantSeat(poscost({ plannedCosts: [], actualCosts: [] }));
  assert.equal(seat.missingPeople, 2);
  assert.equal(seat.onsiteCost + seat.offshoreCost, 0);
});

test("an actual cost with no figure for the person's side is ignored and the planned cost is used", () => {
  const seat = consultantSeat(poscost({ actualCosts: [{ employeeId: 3, offshoreCost: null, onsiteCost: 3000 }] }));
  assert.equal(seat.actualPeople, 0);
  assert.equal(seat.offshoreCost, 800);
});

test("a deployed person with no resource row is costed as offshore at the default cost", () => {
  const seat = consultantSeat(poscost({ resources: [{ employeeId: 2, designation: "Consultant", locationType: "Onsite" }], actualCosts: [] }));
  assert.equal(seat.defaultPeople, 1);
  assert.equal(seat.offshoreCost, 900);
});

test("the health query cuts each table to the last 12 weeks and covers every table and the 12 blank checks", () => {
  assert.equal(HEALTH_SQL.match(/interval '11 weeks'/g).length, MASTER_DATA_TABLES.length);
  assert.equal(HEALTH_SQL.split("union all").length, 2 * MASTER_DATA_TABLES.length + 12);
});

test("a seat's utilized hours follow the allocation percentages of the team's projects: two 25% projects are half", () => {
  const assignments = [
    { teamCode: "TEAM-1", start: "2026-10-01", end: "2026-10-31", allocationPercentage: 25 },
    { teamCode: "TEAM-1", start: "2026-10-01", end: "2026-10-31", allocationPercentage: 25 },
  ];
  const [seat] = buildSeats({ ...rows, assignments }, "2026-10", "2026-10", "2026-10-20").filter((s) => s.teamCode === "TEAM-1" && s.positionName === "Lead Consultant");
  const [whole] = buildSeats({ ...rows, assignments: [{ teamCode: "TEAM-1", start: "2026-10-01", end: "2026-10-31" }] }, "2026-10", "2026-10", "2026-10-20").filter((s) => s.teamCode === "TEAM-1" && s.positionName === "Consultant");
  const [half] = buildSeats({ ...rows, assignments }, "2026-10", "2026-10", "2026-10-20").filter((s) => s.teamCode === "TEAM-1" && s.positionName === "Consultant");
  assert.equal(half.utilizedHours, whole.utilizedHours / 2);
  assert.equal(seat.utilizedHours, 0);
});

test("the assignments dataset carries each assignment's allocation percentage as a number", () => {
  assert.match(ASSIGNMENTS_SQL, /pa\.allocation_percentage::float as "allocationPercentage"/);
});
