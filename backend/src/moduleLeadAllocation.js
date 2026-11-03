import { pool } from "./db.js";
import { validationError } from "./errors.js";
import { dayOf } from "./masterDataSchema.js";

// FEAT-43: automatic Module Lead allocation. A Module Lead seat is a position whose
// name starts with "Module Lead" (the same test as roleOf in src/lib/orgStructure.js).
// A person deployed to Module Lead seats of several teams is a shared lead; the share
// of each team follows how many seats of that team are filled. The percentage on such
// a row is never typed: the server computes it and overwrites anything sent.
//
// The first half of this file is pure maths (no SQL); the second half reads and writes.

const MODULE_LEAD_PREFIX = "Module Lead";
const CENTS = 10000;
export const ALLOCATION_ACTOR = "Module Lead auto-allocation";

export const isModuleLeadName = (name) => typeof name === "string" && name.startsWith(MODULE_LEAD_PREFIX);

// Splits 100% over the teams of one group by filled seats. Each share is rounded down
// to 2 decimals; the leftover goes to the team with the fewest filled seats (the lower
// team code on a tie), so the group totals exactly 100. With no filled seat at all every
// team gets 0. `teams` is [{ teamCode, filled }], one entry per team. Returns a Map of
// team code -> hundredths of a percent (integers, so nothing drifts).
export function splitShares(teams) {
  const total = teams.reduce((sum, team) => sum + team.filled, 0);
  const shares = new Map(teams.map((team) => [team.teamCode, total === 0 ? 0 : Math.floor((team.filled * CENTS) / total)]));
  if (total === 0) return shares;
  const leftover = CENTS - [...shares.values()].reduce((sum, cents) => sum + cents, 0);
  if (leftover > 0) {
    const [receiver] = [...teams].sort((a, b) => a.filled - b.filled || (a.teamCode < b.teamCode ? -1 : a.teamCode > b.teamCode ? 1 : 0));
    shares.set(receiver.teamCode, shares.get(receiver.teamCode) + leftover);
  }
  return shares;
}

// Splits a team's share evenly over the person's Module Lead rows in that team (two
// Module Lead seats in one team), the remaining hundredths going to the first rows.
function splitAcrossRows(cents, count) {
  const base = Math.floor(cents / count);
  const extra = cents - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < extra ? 1 : 0));
}

const covers = (item, day) => item.start <= day && item.end >= day;
const byPosition = (a, b) => (a.positionCode < b.positionCode ? -1 : a.positionCode > b.positionCode ? 1 : a.id < b.id ? -1 : 1);

// The percentage every live Module Lead row should carry. `rows` are Module Lead
// deployments [{ id, employeeId, teamCode, positionCode, start, end }]; `seats` are the
// deployments on the other positions of the teams they lead [{ teamCode, start, end }];
// all dates are YYYY-MM-DD text. A row's reference day is the later of today and its
// start; its group is that person's rows whose period contains the day. Rows that ended
// before today are history and are left out. Returns [{ id, cents }].
export function planAllocations({ rows, seats, today }) {
  const plan = [];
  const byEmployee = new Map();
  for (const row of rows.filter((item) => item.end >= today)) {
    byEmployee.set(row.employeeId, [...(byEmployee.get(row.employeeId) ?? []), row]);
  }
  for (const personRows of byEmployee.values()) {
    for (const row of personRows) {
      const day = row.start > today ? row.start : today;
      const group = personRows.filter((other) => covers(other, day));
      const teamCodes = [...new Set(group.map((other) => other.teamCode))];
      const teams = teamCodes.map((teamCode) => ({
        teamCode,
        filled: seats.filter((seat) => seat.teamCode === teamCode && covers(seat, day)).length,
      }));
      const shares = splitShares(teams);
      const inTeam = group.filter((other) => other.teamCode === row.teamCode).sort(byPosition);
      const split = splitAcrossRows(shares.get(row.teamCode), inTeam.length);
      plan.push({ id: row.id, cents: split[inTeam.findIndex((other) => other.id === row.id)] });
    }
  }
  return plan;
}

// Everything below runs on the client of the write's transaction, so the recalculation
// commits or rolls back with the write that caused it.

const LOCK_SQL = "select pg_advisory_xact_lock(hashtext($1), hashtext($2::text))";

const seatOf = async (db, positionCode) => {
  const { rows } = await db.query(
    "/* module-lead:seat */ select code, name, team_code from positions where code = $1",
    [positionCode]
  );
  if (rows.length === 0) return null;
  return { code: rows[0].code, name: rows[0].name, teamCode: rows[0].team_code, isModuleLead: isModuleLeadName(rows[0].name) };
};

// A Module Lead cannot hold other seats, and a person on another seat cannot be made
// a Module Lead, on any shared day. Raised on the employee, whichever side is new.
async function assertExclusive(db, candidate, seat, excludeId) {
  const { rows } = await db.query(
    `/* module-lead:exclusive */ select d.position_code, p.name, d.start_date::text as start, d.end_date::text as "end"
     from resource_deployment d join positions p on p.code = d.position_code
     where d.employee_id = $1 and d.deleted_at is null and ($2::uuid is null or d.id <> $2::uuid)
       and d.start_date <= $4::date and d.end_date >= $3::date
       and starts_with(p.name, '${MODULE_LEAD_PREFIX}') <> $5::boolean
     order by d.start_date limit 1`,
    [candidate.employee_id, excludeId, dayOf(candidate.start_date), dayOf(candidate.end_date), seat.isModuleLead]
  );
  if (rows.length === 0) return;
  const other = rows[0];
  throw validationError({
    employeeId: seat.isModuleLead
      ? `Employee ${candidate.employee_id} is already deployed as ${other.name} (${other.position_code}) from ${other.start} to ${other.end}. A Module Lead cannot hold other seats.`
      : `Employee ${candidate.employee_id} is a Module Lead (${other.name}, ${other.position_code}) from ${other.start} to ${other.end}. A Module Lead cannot hold other seats.`,
  });
}

// The checks a deployment write must pass inside the employee's lock. A Module Lead row
// ignores the percentage sent: it is stored as `keep` (0 for a new row, the stored value
// for an edit or restore, so a past row that is never recalculated keeps its history) and
// set right by recalculateAffected in the same transaction. Any other seat must carry its
// own percentage of at least `min`. `candidate` is keyed by column name and is updated in
// place. Returns the seat (null if the position is unknown, which validateReferences has
// already refused) and `forChecks`, the candidate to run the 100% cap against: a Module
// Lead row counts as 0 there, since the server-computed shares always total at most 100.
export async function prepareWrite(db, candidate, { min, excludeId = null, keep = 0 }) {
  const seat = await seatOf(db, candidate.position_code);
  if (seat?.isModuleLead) {
    candidate.allocation_percentage = keep;
  } else {
    const value = candidate.allocation_percentage == null ? NaN : Number(candidate.allocation_percentage);
    if (!Number.isFinite(value)) {
      throw validationError({ allocationPercentage: "allocationPercentage is required and must be a number." });
    }
    if (value < min) throw validationError({ allocationPercentage: `allocationPercentage must be at least ${min}.` });
  }
  await assertExclusive(db, candidate, seat ?? { isModuleLead: false }, excludeId);
  return { seat, forChecks: seat?.isModuleLead ? { ...candidate, allocation_percentage: 0 } : candidate };
}

// Seat of a stored row, for the before/after of a patch, delete or restore.
export const seatOfRow = (db, row) => seatOf(db, row.position_code);

async function updateRows(db, plan, current, actor) {
  const changed = plan.filter(({ id, cents }) => current.get(id) !== cents);
  if (changed.length === 0) return 0;
  await db.query(
    `/* module-lead:update */ update resource_deployment d set allocation_percentage = v.pct, updated_by = $3
     from unnest($1::uuid[], $2::numeric[]) as v(id, pct)
     where d.id = v.id and d.deleted_at is null`,
    [changed.map((item) => item.id), changed.map((item) => item.cents / 100), actor]
  );
  return changed.length;
}

// Recomputes every live Module Lead row of the given people. Locks them in ascending
// employee order (the lock a write takes on its own employee, so a concurrent write to
// one of them waits) to keep two such recalculations from deadlocking. Returns how many
// rows changed.
export async function recalculateEmployees(db, employeeIds, actor = ALLOCATION_ACTOR) {
  const ids = [...new Set(employeeIds)].sort((a, b) => a - b);
  if (ids.length === 0) return 0;
  for (const id of ids) await db.query(LOCK_SQL, ["resource_deployment", id]);

  const { rows: leadRows } = await db.query(
    `/* module-lead:rows */ select d.id, d.employee_id, d.position_code, p.team_code, d.allocation_percentage,
            d.start_date::text as start, d.end_date::text as "end", current_date::text as today
     from resource_deployment d join positions p on p.code = d.position_code
     where d.employee_id = any($1::int[]) and d.deleted_at is null and d.end_date >= current_date
       and starts_with(p.name, '${MODULE_LEAD_PREFIX}')`,
    [ids]
  );
  if (leadRows.length === 0) return 0;

  const teamCodes = [...new Set(leadRows.map((row) => row.team_code))];
  const { rows: seatRows } = await db.query(
    `/* module-lead:seats */ select p.team_code, d.start_date::text as start, d.end_date::text as "end"
     from resource_deployment d join positions p on p.code = d.position_code
     where p.team_code = any($1::text[]) and d.deleted_at is null and d.end_date >= current_date
       and not starts_with(p.name, '${MODULE_LEAD_PREFIX}')`,
    [teamCodes]
  );

  const plan = planAllocations({
    today: leadRows[0].today,
    rows: leadRows.map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      teamCode: row.team_code,
      positionCode: row.position_code,
      start: row.start,
      end: row.end,
    })),
    seats: seatRows.map((row) => ({ teamCode: row.team_code, start: row.start, end: row.end })),
  });
  const current = new Map(leadRows.map((row) => [row.id, Math.round(Number(row.allocation_percentage) * 100)]));
  return updateRows(db, plan, current, actor);
}

// After a write, recomputes whoever it can have changed. `touched` lists the rows before
// and after the write as { employeeId, seat }: a Module Lead row changes its own person's
// shares; any other row changes the filled seats of its team, so every Module Lead of
// that team (and, through them, every other team they lead) is recomputed.
export async function recalculateAffected(db, touched, actor) {
  const employeeIds = new Set();
  const teamCodes = new Set();
  for (const { employeeId, seat } of touched) {
    if (seat?.isModuleLead) employeeIds.add(employeeId);
    else if (seat?.teamCode) teamCodes.add(seat.teamCode);
  }
  if (teamCodes.size > 0) {
    const { rows } = await db.query(
      `/* module-lead:team-leads */ select distinct d.employee_id
       from resource_deployment d join positions p on p.code = d.position_code
       where p.team_code = any($1::text[]) and d.deleted_at is null and d.end_date >= current_date
         and starts_with(p.name, '${MODULE_LEAD_PREFIX}')`,
      [[...teamCodes]]
    );
    for (const row of rows) employeeIds.add(row.employee_id);
  }
  return recalculateEmployees(db, [...employeeIds], actor);
}

// One-off repair: recomputes every Module Lead group. Used by no startup path; run it
// from backend/src/recalculateModuleLeads.js after the rule changes or the data is
// loaded another way. One transaction per person. Returns { employees, updated }.
export async function recalculateAllModuleLeads(db = pool, actor = ALLOCATION_ACTOR) {
  const { rows } = await db.query(
    `select distinct d.employee_id
     from resource_deployment d join positions p on p.code = d.position_code
     where d.deleted_at is null and d.end_date >= current_date and starts_with(p.name, '${MODULE_LEAD_PREFIX}')
     order by d.employee_id`
  );
  let updated = 0;
  for (const { employee_id: employeeId } of rows) {
    const client = await db.connect();
    let rollbackFailed = false;
    try {
      await client.query("begin");
      updated += await recalculateEmployees(client, [employeeId], actor);
      await client.query("commit");
    } catch (err) {
      await client.query("rollback").catch((rollbackError) => {
        rollbackFailed = true;
        console.error("rollback failed", rollbackError);
      });
      throw err;
    } finally {
      client.release(rollbackFailed);
    }
  }
  return { employees: rows.length, updated };
}
