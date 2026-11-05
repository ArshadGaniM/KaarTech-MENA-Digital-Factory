import { validationError } from "./errors.js";
import { isModuleLeadName } from "./moduleLeadAllocation.js";

// A team holds one live Module Lead seat. These three teams already hold eight each, so
// they are left alone and may add or restore seats freely. The unique index in migration
// 0039 repeats this list: change both together.
export const MODULE_LEAD_EXEMPT_TEAMS = ["TEAM-087", "TEAM-088", "TEAM-089"];

// Whether a position with this name in this team is held to the one-seat rule.
export const isGuardedModuleLeadSeat = (name, teamCode) => isModuleLeadName(name) && !MODULE_LEAD_EXEMPT_TEAMS.includes(teamCode);

// Refuses a write that would leave a team with a second live Module Lead seat. The caller
// holds the team's advisory lock, so two writes cannot both pass. `excludeId` is the row
// being edited or restored, so it is not counted against itself. Table and column names
// come only from the descriptor.
export async function validateModuleLeadSeat(db, table, candidate, excludeId = null) {
  const rule = table.moduleLeadSeatRule;
  if (!rule) return;
  const teamCode = candidate[rule.groupColumn];
  if (!isGuardedModuleLeadSeat(candidate[rule.nameColumn], teamCode)) return;
  const { rows } = await db.query(
    `select code, name from ${table.tableName}
     where ${rule.groupColumn} = $1 and deleted_at is null and ${rule.nameColumn} like 'Module Lead%'
       and ($2::uuid is null or id <> $2::uuid)
     limit 1`,
    [teamCode, excludeId]
  );
  if (rows.length === 0) return;
  const [existing] = rows;
  throw validationError({
    [rule.nameKey]: `Team ${teamCode} already has a Module Lead seat (${existing.code}, ${existing.name}). A team can have only one.`,
  });
}
