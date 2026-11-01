import { ODC_DELIVERY_MANAGER, ODC_PROJECT_MANAGERS } from './odcLeadership';

const isLive = (row) => row.markedDeleted !== 'Yes';

const NO_PRACTICE = { code: 'NO-PRACTICE', name: 'No practice' };
// Fills a missing Module Lead above a real team, so every practice with a
// team has at least one lead. A branch with no team is left out instead.
const TBD = 'TBD';

// Position names are the only role signal: there is no role column.
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
// normally agree. If they ever disagree the first one wins and we say so. A
// practice that is deleted or unknown counts as no practice, so the team
// still shows up and the tree keeps adding up to the seat totals.
function practiceCodeOf(team, competencyNames, practiceByCompetency, livePracticeCodes) {
  const codes = [
    ...new Set(competencyNames.map((name) => practiceByCompetency.get(name)).filter((code) => livePracticeCodes.has(code))),
  ];
  if (codes.length > 1) {
    console.warn(`Team ${team.code} has competencies in several practices (${codes.join(', ')}) — using ${codes[0]}.`);
  }
  return codes[0] ?? null;
}

// A shared Module Lead is a person deployed to the Module Lead position of
// several teams. A team whose Module Lead seat is empty falls under
// "Unallocated".
// employeeName is null when the person's resource record was deleted but the
// deployment is still live, so fall back to the employee id.
function moduleLeadsOf(positions, deploymentsByPosition) {
  const people = positions
    .filter((position) => roleOf(position.name) === 'moduleLead')
    .flatMap((position) => deploymentsByPosition.get(position.code) ?? [])
    .filter((deployment) => deployment.employeeId != null)
    .map((deployment) => ({
      personKey: String(deployment.employeeId),
      name: deployment.employeeName ?? `Employee ${deployment.employeeId}`,
      isUnallocated: false,
    }));
  const unique = [...new Map(people.map((person) => [person.personKey, person])).values()];
  return unique.length > 0 ? unique : [{ personKey: 'unallocated', name: TBD, isUnallocated: true }];
}

// Every node carries a `key` that is unique in the whole tree, so the page
// and "Expand all" never build their own.
function buildPracticeGroups(departmentCode, departmentTeams, practices) {
  const byCode = Map.groupBy(departmentTeams, (team) => team.practiceCode ?? NO_PRACTICE.code);
  const ordered = [...practices, NO_PRACTICE].filter((practice) => byCode.has(practice.code));

  return ordered.map((practice) => {
    const teams = byCode.get(practice.code);
    const practiceKey = `${departmentCode}/${practice.code}`;
    const leadMap = new Map();
    for (const team of teams) {
      for (const lead of team.leads) {
        if (!leadMap.has(lead.personKey)) {
          leadMap.set(lead.personKey, { ...lead, key: `${practiceKey}/${lead.personKey}`, teams: [] });
        }
        leadMap.get(lead.personKey).teams.push(team);
      }
    }
    const moduleLeads = [...leadMap.values()].sort((a, b) => {
      if (a.isUnallocated !== b.isUnallocated) return a.isUnallocated ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    return {
      key: practiceKey,
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
  const livePracticeCodes = new Set(livePractices.map((practice) => practice.code));
  // practiceId holds the practice's code (competencies.practice_code).
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
          practiceCode: practiceCodeOf(team, competencyNames, practiceByCompetency, livePracticeCodes),
          leads: moduleLeadsOf(teamPositions, deploymentsByPosition),
        };
      });
      return [
        department.code,
        {
          key: department.code,
          code: department.code,
          name: department.name,
          floorNumber: department.floorNumber,
          seats: departmentTeams.reduce((sum, team) => sum + team.seats, 0),
          teamCount: departmentTeams.length,
          practices: buildPracticeGroups(department.code, departmentTeams, livePractices),
        },
      ];
    })
  );

  // A department with no team has nothing to show, and neither does a manager
  // whose departments are all empty.
  const populated = new Map([...departmentsByCode].filter(([, department]) => department.teamCount > 0));
  const sumSeats = (list) => list.reduce((sum, department) => sum + department.seats, 0);
  const assigned = new Set(ODC_PROJECT_MANAGERS.flatMap((manager) => manager.departmentCodes));

  const projectManagers = ODC_PROJECT_MANAGERS.map((manager) => {
    const managed = manager.departmentCodes.map((code) => populated.get(code)).filter(Boolean);
    return { id: manager.id, title: manager.title, name: manager.name, seats: sumSeats(managed), departments: managed };
  }).filter((manager) => manager.departments.length > 0);

  const unassigned = [...populated.values()].filter((department) => !assigned.has(department.code));
  if (unassigned.length > 0) {
    projectManagers.push({ id: 'unassigned', title: 'Unassigned', name: null, seats: sumSeats(unassigned), departments: unassigned });
  }

  return {
    deliveryManager: ODC_DELIVERY_MANAGER,
    totalSeats: projectManagers.reduce((sum, manager) => sum + manager.seats, 0),
    projectManagers,
  };
}

// Every node key in the tree, for "Expand all".
export function allNodeKeys(structure) {
  return structure.projectManagers.flatMap((manager) => [
    manager.id,
    ...manager.departments.flatMap((department) => [
      department.key,
      ...department.practices.flatMap((practice) => [practice.key, ...practice.moduleLeads.map((lead) => lead.key)]),
    ]),
  ]);
}
