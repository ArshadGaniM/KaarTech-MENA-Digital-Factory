import { fetchAllMasterDataTableRows } from '../lib/masterDataApi';
import { useAsyncResource } from './useAsyncResource';

// The list routes also return soft-deleted rows (markedDeleted: "Yes"),
// which must not name a floor or fill one with a team.
const isLive = (row) => row.markedDeleted !== 'Yes';

async function fetchFactoryData() {
  const [departments, teams] = await Promise.all([
    fetchAllMasterDataTableRows('departments'),
    fetchAllMasterDataTableRows('teams'),
  ]);

  const departmentNames = new Map(departments.filter(isLive).map((row) => [row.code, row.name]));
  const teamCodesByDepartment = new Map();
  for (const team of teams.filter(isLive)) {
    const codes = teamCodesByDepartment.get(team.departmentCode) ?? [];
    codes.push(team.code);
    teamCodesByDepartment.set(team.departmentCode, codes);
  }
  teamCodesByDepartment.forEach((codes) => codes.sort());

  return { departmentNames, teamCodesByDepartment };
}

export function useFactoryData() {
  return useAsyncResource(fetchFactoryData, []);
}
