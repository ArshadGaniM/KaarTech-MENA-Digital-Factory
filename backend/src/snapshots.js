// Monthly snapshots of the seat figures, so the Forecast tab can set what a
// month really looked like against what the dates say about it now. Only the
// current month is written, again and again while the backend runs, so the last
// write of a month is how that month ended.
import { buildSeats } from "./analytics.js";
import { loadControlCenterRows } from "./controlCenter.js";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

// Per month, team and seat type, so one row stands for the seats of that kind.
export function aggregateSeats(seats) {
  const groups = new Map();
  for (const seat of seats) {
    const key = `${seat.month}\u0000${seat.teamCode}\u0000${seat.positionName}`;
    const entry = groups.get(key) ?? {
      month: seat.month,
      teamCode: seat.teamCode,
      positionName: seat.positionName,
      departmentName: seat.departmentName,
      practiceName: seat.practiceName,
      seats: 0,
      filledSeats: 0,
      availableHours: 0,
      allocatedHours: 0,
      utilizedHours: 0,
      onsiteCost: 0,
      offshoreCost: 0,
    };
    entry.seats += 1;
    entry.filledSeats += seat.filled ? 1 : 0;
    entry.availableHours += seat.availableHours;
    entry.allocatedHours += seat.allocatedHours;
    entry.utilizedHours += seat.utilizedHours;
    entry.onsiteCost += seat.onsiteCost;
    entry.offshoreCost += seat.offshoreCost;
    groups.set(key, entry);
  }
  return [...groups.values()];
}

// One statement for all rows, with every value a bound array.
export const SNAPSHOT_UPSERT_SQL = `
  insert into analytics_snapshots
    (month, team_code, position_name, department_name, practice_name, seats, filled_seats,
     available_hours, allocated_hours, utilized_hours, onsite_cost, offshore_cost)
  select * from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::int[], $7::int[],
                       $8::numeric[], $9::numeric[], $10::numeric[], $11::numeric[], $12::numeric[])
  on conflict (month, team_code, position_name) do update set
    department_name = excluded.department_name, practice_name = excluded.practice_name,
    seats = excluded.seats, filled_seats = excluded.filled_seats,
    available_hours = excluded.available_hours, allocated_hours = excluded.allocated_hours,
    utilized_hours = excluded.utilized_hours, onsite_cost = excluded.onsite_cost,
    offshore_cost = excluded.offshore_cost, taken_at = now()`;

export async function takeSnapshot({ query, month, today }) {
  const rows = aggregateSeats(buildSeats(await loadControlCenterRows(query), month, month, today));
  if (rows.length === 0) return 0;
  const column = (pick) => rows.map(pick);
  await query(SNAPSHOT_UPSERT_SQL, [
    column((r) => r.month),
    column((r) => r.teamCode),
    column((r) => r.positionName),
    column((r) => r.departmentName),
    column((r) => r.practiceName),
    column((r) => r.seats),
    column((r) => r.filledSeats),
    column((r) => r.availableHours),
    column((r) => r.allocatedHours),
    column((r) => r.utilizedHours),
    column((r) => r.onsiteCost),
    column((r) => r.offshoreCost),
  ]);
  return rows.length;
}

// Takes a snapshot now and every six hours. A failure is logged and the next
// run tries again, so a bad moment never stops the backend or the schedule.
export function startSnapshotSchedule({ query, now = () => new Date(), every = setInterval, intervalMs = SIX_HOURS_MS, log = console.error } = {}) {
  const run = async () => {
    const date = now().toISOString();
    try {
      await takeSnapshot({ query, month: date.slice(0, 7), today: date.slice(0, 10) });
    } catch (err) {
      log("The monthly snapshot failed.", err);
    }
  };
  run();
  const handle = every(run, intervalMs);
  handle?.unref?.();
  return { run, stop: () => clearInterval(handle) };
}
