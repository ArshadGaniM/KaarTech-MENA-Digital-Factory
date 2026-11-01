import { ODC_DELIVERY_MANAGER, ODC_PROJECT_MANAGERS } from './odcLeadership';

const isLive = (row) => row.markedDeleted !== 'Yes';

const NO_PRACTICE = { code: 'NO-PRACTICE', name: 'No practice' };
const UNALLOCATED_KEY = 'unallocated';

export function roleOf(positionName) {
  if (positionName.startsWith('Module Lead')) return 'moduleLead';
  if (positionName === 'Lead Consultant') return 'leadConsultant';
  if (positionName === 'Consultant') return 'consultant';
  return 'other';
}

function competencyNamesOf(positions) {
  const names = positions.flatMap((position) =>
    (position.competencies ?? '').split(',').map((name) => name.trim()).filter(Boolean)
  );
  return [...new Set(names)];
}

// One competency belongs to exactly one practice, so a team's competencies
// normally agree. If they ever disagree the first one wins and we say so.
function practiceCodeOf(team, competencyNames, practiceByCompetency) {
  const codes = [...new Set(competencyNames.map((name) => practiceByCompetency.get(name)).filter(Boolean))];
  if (codes.length > 1) {
    console.warn(`Team ${team.code} has competencies in several practices (${codes.join(', ')}) — using ${codes[0]}.`);
  }
  return codes[0] ?? null;
}

// A shared Module Lead is a person deployed to the Module Lead position of
// several teams. A team whose Module Lead seat is empty falls under
// "Unallocated".
function moduleLeadsOf(positions, deploymentsByPosition) {
  const people = positions
    .filter((position) => roleOf(position.name) === 'moduleLead')
    .flatMap((position) => deploymentsByPosition.get(position.code) ?? [])
    .map((deployment) => ({ key: String(deployment.employeeId), name: deployment.employeeName }));
  const unique = [...new Map(people.map((person) => [person.key, person])).values()];
  return unique.length > 0 ? unique : [{ key: UNALLOCATED_KEY, name: 'Unallocated' }];
}

function buildPracticeGroups(departmentTeams, practices) {
  const byCode = Map.groupBy(departmentTeams, (team) => team.practiceCode ?? NO_PRACTICE.code);
  const ordered = [...practices, NO_PRACTICE].filter((practice) => byCode.has(practice.code));

  return ordered.map((practice) => {
    const teams = byCode.get(practice.code);
    const leadMap = new Map();
    for (const team of teams) {
      for (const lead of team.leads) {
        if (!leadMap.has(lead.key)) leadMap.set(lead.key, { ...lead, teams: [] });
        leadMap.get(lead.key).teams.push(team);
      }
    }
    const moduleLeads = [...leadMap.values()].sort((a, b) => {
      if (a.key === UNALLOCATED_KEY) return 1;
      if (b.key === UNALLOCATED_KEY) return -1;
      return a.name.localeCompare(b.name);
    });
    return {
      code: practice.code,
      name: practice.name,
      seats: teams.reduce((sum, team) => sum + team.seats, 0),
      moduleLeads,
    };
  });
}

// Headcount means seats: every live position is one seat, whether or not
// anyone is deployed to it. Only the leadership above departments comes from
// odcLeadership.js — everything else is derived from the live tables.
export function buildOrgStructure({ departments, teams, positions, competencies, practices, deployments }) {
  const livePractices = practices.filter(isLive).sort((a, b) => a.code.localeCompare(b.code));
  const practiceByCompetency = new Map(competencies.filter(isLive).map((c) => [c.name, c.practiceId]));
  const deploymentsByPosition = Map.groupBy(deployments.filter(isLive), (deployment) => deployment.positionId);
  const positionsByTeam = Map.groupBy(positions.filter(isLive), (position) => position.teamCode);
  const teamsByDepartment = Map.groupBy(teams.filter(isLive), (team) => team.departmentCode);

  const departmentsByCode = new Map(
    departments.filter(isLive).map((department) => {
      const departmentTeams = (teamsByDepartment.get(department.code) ?? []).map((team) => {
        const teamPositions = positionsByTeam.get(team.code) ?? [];
        const count = (role) => teamPositions.filter((position) => roleOf(position.name) === role).length;
        const competencyNames = competencyNamesOf(teamPositions);
        return {
          code: team.code,
          name: team.name,
          seats: teamPositions.length,
          leadConsultants: count('leadConsultant'),
          consultants: count('consultant'),
          others: count('other'),
          competencies: competencyNames,
          practiceCode: practiceCodeOf(team, competencyNames, practiceByCompetency),
          leads: moduleLeadsOf(teamPositions, deploymentsByPosition),
        };
      });
      return [
        department.code,
        {
          code: department.code,
          name: department.name,
          floorNumber: department.floorNumber,
          seats: departmentTeams.reduce((sum, team) => sum + team.seats, 0),
          teamCount: departmentTeams.length,
          practices: buildPracticeGroups(departmentTeams, livePractices),
        },
      ];
    })
  );

  const sumSeats = (list) => list.reduce((sum, department) => sum + department.seats, 0);
  const assigned = new Set(ODC_PROJECT_MANAGERS.flatMap((manager) => manager.departmentCodes));

  const projectManagers = ODC_PROJECT_MANAGERS.map((manager) => {
    const managed = manager.departmentCodes.map((code) => departmentsByCode.get(code)).filter(Boolean);
    return { id: manager.id, title: manager.title, name: manager.name, seats: sumSeats(managed), departments: managed };
  });

  const unassigned = [...departmentsByCode.values()].filter((department) => !assigned.has(department.code));
  if (unassigned.length > 0) {
    projectManagers.push({ id: 'unassigned', title: 'Unassigned', name: null, seats: sumSeats(unassigned), departments: unassigned });
  }

  return {
    deliveryManager: ODC_DELIVERY_MANAGER,
    totalSeats: projectManagers.reduce((sum, manager) => sum + manager.seats, 0),
    projectManagers,
  };
}
