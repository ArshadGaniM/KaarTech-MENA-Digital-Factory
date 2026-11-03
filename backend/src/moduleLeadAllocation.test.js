import { test } from "node:test";
import assert from "node:assert/strict";
import { splitShares, planAllocations, isModuleLeadName } from "./moduleLeadAllocation.js";

const shares = (teams) => Object.fromEntries(splitShares(teams));
const team = (teamCode, filled) => ({ teamCode, filled });
const total = (teams) => [...splitShares(teams).values()].reduce((sum, cents) => sum + cents, 0);

test("a Module Lead seat is a position whose name starts with 'Module Lead'", () => {
  assert.equal(isModuleLeadName("Module Lead - FI"), true);
  assert.equal(isModuleLeadName("Module Lead"), true);
  assert.equal(isModuleLeadName("Lead Consultant"), false);
  assert.equal(isModuleLeadName("Senior Module Lead"), false);
  assert.equal(isModuleLeadName(undefined), false);
});

test("a single team gets the whole 100%", () => {
  assert.deepEqual(shares([team("TEAM-01", 4)]), { "TEAM-01": 10000 });
});

test("shares are rounded down to 2 decimals and the group still totals exactly 100.00", () => {
  // 1 of 3 and 2 of 3: 33.33 + 66.66 leaves 0.01.
  assert.equal(total([team("TEAM-01", 1), team("TEAM-02", 2)]), 10000);
  assert.equal(total([team("A", 1), team("B", 1), team("C", 1)]), 10000);
  assert.equal(total([team("A", 7), team("B", 11), team("C", 13), team("D", 3)]), 10000);
});

test("the leftover goes to the team with the fewest filled seats", () => {
  assert.deepEqual(shares([team("TEAM-01", 1), team("TEAM-02", 2)]), { "TEAM-01": 3334, "TEAM-02": 6666 });
  assert.deepEqual(shares([team("TEAM-01", 2), team("TEAM-02", 1)]), { "TEAM-01": 6666, "TEAM-02": 3334 });
});

test("on a tie for fewest filled seats the lower team code gets the leftover", () => {
  assert.deepEqual(shares([team("TEAM-03", 1), team("TEAM-01", 1), team("TEAM-02", 1)]), { "TEAM-03": 3333, "TEAM-01": 3334, "TEAM-02": 3333 });
});

test("with no filled seat in the whole group every team gets 0, not an equal split", () => {
  assert.deepEqual(shares([team("TEAM-01", 0), team("TEAM-02", 0)]), { "TEAM-01": 0, "TEAM-02": 0 });
});

test("a team with no filled seat gets 0 unless it is the one that takes the leftover", () => {
  assert.deepEqual(shares([team("TEAM-01", 3), team("TEAM-02", 0)]), { "TEAM-01": 10000, "TEAM-02": 0 });
  // The rule gives the leftover to the team with the fewest filled seats, an empty one included.
  assert.deepEqual(shares([team("TEAM-01", 2), team("TEAM-02", 1), team("TEAM-03", 0)]), { "TEAM-01": 6666, "TEAM-02": 3333, "TEAM-03": 1 });
});

const lead = (id, employeeId, teamCode, positionCode, start = "2026-08-01", end = "2027-03-31") => ({ id, employeeId, teamCode, positionCode, start, end });
const seat = (teamCode, start = "2026-08-01", end = "2027-03-31") => ({ teamCode, start, end });
const percentOf = (plan) => Object.fromEntries(plan.map(({ id, cents }) => [id, cents / 100]));
const TODAY = "2026-10-01";

test("a person leading two teams gets each team's share of filled seats", () => {
  const plan = planAllocations({
    today: TODAY,
    rows: [lead("a", 7, "T1", "P1"), lead("b", 7, "T2", "P2")],
    seats: [seat("T1"), seat("T2"), seat("T2")],
  });
  assert.deepEqual(percentOf(plan), { a: 33.34, b: 66.66 });
});

test("two people are separate groups, each totalling 100", () => {
  const plan = planAllocations({
    today: TODAY,
    rows: [lead("a", 7, "T1", "P1"), lead("b", 7, "T2", "P2"), lead("c", 8, "T3", "P3")],
    seats: [seat("T1"), seat("T2"), seat("T3")],
  });
  assert.deepEqual(percentOf(plan), { a: 50, b: 50, c: 100 });
});

test("a group with no filled seat gets 0 on every row", () => {
  const plan = planAllocations({ today: TODAY, rows: [lead("a", 7, "T1", "P1"), lead("b", 7, "T2", "P2")], seats: [] });
  assert.deepEqual(percentOf(plan), { a: 0, b: 0 });
});

test("a seat that ended before today or starts later is not filled on the reference day", () => {
  const plan = planAllocations({
    today: TODAY,
    rows: [lead("a", 7, "T1", "P1"), lead("b", 7, "T2", "P2")],
    seats: [seat("T1", "2026-08-01", "2026-09-30"), seat("T1", "2026-11-01", "2027-03-31"), seat("T2")],
  });
  assert.deepEqual(percentOf(plan), { a: 0, b: 100 });
});

test("a row that ended before today is history and is not planned", () => {
  const plan = planAllocations({
    today: TODAY,
    rows: [lead("old", 7, "T1", "P1", "2026-01-01", "2026-09-30"), lead("a", 7, "T2", "P2")],
    seats: [seat("T1"), seat("T2")],
  });
  assert.deepEqual(percentOf(plan), { a: 100 });
});

test("a row starting later is worked out on its own start day, with the rows and seats of that day", () => {
  const plan = planAllocations({
    today: TODAY,
    rows: [lead("now", 7, "T1", "P1", "2026-08-01", "2026-12-31"), lead("later", 7, "T2", "P2", "2027-01-01", "2027-06-30")],
    seats: [seat("T1", "2026-08-01", "2026-12-31"), seat("T2", "2027-01-01", "2027-06-30"), seat("T2", "2027-01-01", "2027-06-30")],
  });
  // The two rows never share a day, so each is alone in its group.
  assert.deepEqual(percentOf(plan), { now: 100, later: 100 });
});

test("two Module Lead seats of one person in one team split that team's share", () => {
  const plan = planAllocations({
    today: TODAY,
    rows: [lead("a", 7, "T1", "P1"), lead("b", 7, "T1", "P2"), lead("c", 7, "T2", "P3")],
    seats: [seat("T1"), seat("T2")],
  });
  assert.deepEqual(percentOf(plan), { a: 25, b: 25, c: 50 });
  assert.equal(plan.reduce((sum, item) => sum + item.cents, 0), 10000);
});
