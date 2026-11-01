import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateSeats, SNAPSHOT_UPSERT_SQL, startSnapshotSchedule, takeSnapshot } from "./snapshots.js";

const seat = (over = {}) => ({
  month: "2026-11",
  teamCode: "T1",
  positionName: "Consultant",
  departmentName: "Design",
  practiceName: "Finance",
  filled: false,
  availableHours: 160,
  allocatedHours: 0,
  utilizedHours: 0,
  onsiteCost: 0,
  offshoreCost: 0,
  ...over,
});

test("seats of one team and seat type become one row with summed figures", () => {
  const rows = aggregateSeats([
    seat({ filled: true, allocatedHours: 160, utilizedHours: 80, onsiteCost: 1000 }),
    seat({ filled: true, allocatedHours: 80, offshoreCost: 400.5 }),
    seat(),
    seat({ positionName: "Lead Consultant" }),
    seat({ teamCode: "T2" }),
  ]);
  assert.equal(rows.length, 3);
  const first = rows.find((r) => r.teamCode === "T1" && r.positionName === "Consultant");
  assert.deepEqual(
    [first.seats, first.filledSeats, first.availableHours, first.allocatedHours, first.utilizedHours, first.onsiteCost, first.offshoreCost],
    [3, 2, 480, 240, 80, 1000, 400.5]
  );
});

test("the same team and seat type in two months stays two rows", () => {
  assert.equal(aggregateSeats([seat(), seat({ month: "2026-12" })]).length, 2);
  assert.deepEqual(aggregateSeats([]), []);
});

test("the upsert replaces a month's row and binds every value as an array", () => {
  assert.ok(SNAPSHOT_UPSERT_SQL.includes("on conflict (month, team_code, position_name) do update"));
  assert.equal(/\$\d+::[a-z]+\[\]/.test(SNAPSHOT_UPSERT_SQL), true);
  assert.equal(SNAPSHOT_UPSERT_SQL.includes("${"), false);
});

const emptyTables = { rows: [] };
const loaderQuery = (calls) => async (sql, params) => {
  calls.push({ sql, params });
  if (sql.includes("from departments")) return { rows: [{ code: "D1", name: "Design", floorNumber: 1 }] };
  if (sql.includes("from teams")) return { rows: [{ code: "T1", name: "Alpha", departmentCode: "D1" }] };
  if (sql.includes("from positions")) return { rows: [{ code: "P1", name: "Consultant", teamCode: "T1", competencies: null }, { code: "P2", name: "Module Lead", teamCode: "T1", competencies: null }] };
  return emptyTables;
};

test("takeSnapshot saves one row per team and seat type for the month, counting only Consultant and Lead Consultant seats", async () => {
  const calls = [];
  const saved = await takeSnapshot({ query: loaderQuery(calls), month: "2026-11", today: "2026-11-15" });
  assert.equal(saved, 1);
  const write = calls.find((c) => c.sql === SNAPSHOT_UPSERT_SQL);
  assert.deepEqual(write.params[0], ["2026-11"]);
  assert.deepEqual(write.params[1], ["T1"]);
  assert.deepEqual(write.params[2], ["Consultant"]);
  assert.deepEqual(write.params[5], [1]);
});

test("takeSnapshot writes nothing when there are no seats", async () => {
  const calls = [];
  const saved = await takeSnapshot({ query: async (sql, params) => { calls.push({ sql, params }); return emptyTables; }, month: "2026-11", today: "2026-11-15" });
  assert.equal(saved, 0);
  assert.equal(calls.some((c) => c.sql === SNAPSHOT_UPSERT_SQL), false);
});

test("the schedule takes a snapshot at once and again every six hours, for the month it is then", async () => {
  const calls = [];
  const timers = [];
  let clock = new Date("2026-11-30T23:00:00Z");
  const schedule = startSnapshotSchedule({ query: loaderQuery(calls), now: () => clock, every: (fn, ms) => { timers.push({ fn, ms }); return { unref() {} }; } });
  await schedule.run();
  assert.equal(timers[0].ms, 6 * 60 * 60 * 1000);
  clock = new Date("2026-12-01T05:00:00Z");
  await timers[0].fn();
  const months = calls.filter((c) => c.sql === SNAPSHOT_UPSERT_SQL).map((c) => c.params[0][0]);
  assert.deepEqual([...new Set(months)], ["2026-11", "2026-12"]);
});

test("a failed snapshot is logged and the schedule goes on", async () => {
  const logged = [];
  const schedule = startSnapshotSchedule({ query: async () => { throw new Error("db down"); }, every: () => ({ unref() {} }), log: (...args) => logged.push(args) });
  await schedule.run();
  await schedule.run();
  assert.ok(logged.length >= 2);
  assert.equal(String(logged[0][1].message), "db down");
});
