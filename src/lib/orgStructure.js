const isLive = (row) => row.markedDeleted !== 'Yes';

export function roleOf(positionName) {
  if (positionName.startsWith('Module Lead')) return 'moduleLead';
  if (positionName === 'Lead Consultant') return 'leadConsultant';
  if (positionName === 'Consultant') return 'consultant';
  return 'other';
}

function competenciesOf(positions) {
  const names = positions.flatMap((position) =>
    (position.competencies ?? '').split(',').map((name) => name.trim()).filter(Boolean)
  );
  return [...new Set(names)];
}

// Headcount means seats: every live position is one seat, whether or not
// anyone is deployed to it. Module Lead seats are counted but not linked
// to any other team yet.
export function buildOrgStructure({ departments, teams, positions }) {
  const livePositions = positions.filter(isLive);
  const positionsByTeam = Map.groupBy(livePositions, (position) => position.teamCode);
  const liveTeams = teams.filter(isLive);
  const teamsByDepartment = Map.groupBy(liveTeams, (team) => team.departmentCode);

  const groups = departments.filter(isLive).map((department) => {
    const departmentTeams = (teamsByDepartment.get(department.code) ?? []).map((team) => {
      const teamPositions = positionsByTeam.get(team.code) ?? [];
      const count = (role) => teamPositions.filter((position) => roleOf(position.name) === role).length;
      return {
        code: team.code,
        name: team.name,
        seats: teamPositions.length,
        moduleLeads: count('moduleLead'),
        leadConsultants: count('leadConsultant'),
        consultants: count('consultant'),
        others: count('other'),
        competencies: competenciesOf(teamPositions),
      };
    });
    return {
      code: department.code,
      name: department.name,
      floorNumber: department.floorNumber,
      seats: departmentTeams.reduce((sum, team) => sum + team.seats, 0),
      teams: departmentTeams,
    };
  });

  return { totalSeats: groups.reduce((sum, group) => sum + group.seats, 0), departments: groups };
}
