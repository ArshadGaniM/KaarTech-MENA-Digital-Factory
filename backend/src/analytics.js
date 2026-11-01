// Flat, read-only datasets for the Dashboard's analytics page. The page slices
// them in the browser, so one request feeds every chart and a click on a
// slicer costs no round trip.
//
//  - people: one row per live resource, with the total allocation of the
//    deployments running today.
//  - seats: one row per counted seat (Consultant or Lead Consultant) per
//    month, using the Control Center's hour rules.
//  - structure, catalog and assignments: the teams, departments, practices and
//    project assignments behind the Structure and Projects tabs.
import { COUNTED_POSITIONS, HOURS_PER_PERSON, competenciesOf, coveredDays, deployedOn, indexBy, isValidMonth, monthWindow, referenceDay, round1, seatHours } from "./controlCenter.js";

export const MAX_MONTHS = 24;
const MAX_SKILLS = 5;
const MAX_SKILL_LENGTH = 40;

export const PEOPLE_SQL = `
  select r.employee_id as "employeeId", r.name, r.sub_division as "subDivision",
         r.region, r.position, r.designation, r.skill, r.location_type as "locationType",
         r.employment_type as "employmentType",
         r.ge_batch as "geBatch",
         r.total_experience::float as "totalExperience", r.sap_experience::float as "sapExperience",
         r.kaar_experience::float as "kaarExperience",
         coalesce(t.total, 0)::float as allocation
    from resources r
    left join (
      select employee_id, sum(allocation_percentage) as total
        from resource_deployment
       where deleted_at is null and start_date <= current_date and end_date >= current_date
       group by employee_id
    ) t on t.employee_id = r.employee_id
   where r.deleted_at is null
   order by r.employee_id`;

const skillsOf = (text) =>
  (text ?? "")
    .split(",")
    .map((skill) => skill.trim().slice(0, MAX_SKILL_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_SKILLS);

export function buildPeople(rows) {
  return rows.map(({ skill, ...person }) => ({ ...person, skills: skillsOf(skill) }));
}

// Every month from `from` to `to`, both included.
export function monthsBetween(from, to) {
  const months = [];
  let [year, month] = from.split("-").map(Number);
  const [endYear, endMonth] = to.split("-").map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

export function validateRange(from, to) {
  const problems = {};
  if (!isValidMonth(from)) problems.from = "from must look like 2026-10.";
  if (!isValidMonth(to)) problems.to = "to must look like 2026-10.";
  if (Object.keys(problems).length === 0) {
    if (from > to) problems.to = "to must not be before from.";
    else if (monthsBetween(from, to).length > MAX_MONTHS) problems.to = `The range must not exceed ${MAX_MONTHS} months.`;
  }
  return problems;
}

export function buildSeats({ departments, teams, positions, deployments, assignments, competencies = [] }, from, to, today) {
  const departmentByCode = new Map(departments.map((d) => [d.code, d]));
  const practiceByCompetency = new Map(competencies.map((c) => [c.name, c.practiceName]));
  const positionsByTeam = indexBy(positions, "teamCode");
  const assignmentsByTeam = indexBy(assignments, "teamCode");

  const practiceByTeam = new Map(
    teams.map((team) => [team.code, practiceByCompetency.get(competenciesOf(positionsByTeam.get(team.code) ?? []).primary) ?? null])
  );

  return monthsBetween(from, to).flatMap((month) => {
    const window = monthWindow(month);
    const active = indexBy(deployedOn(deployments, referenceDay(window, today)), "positionCode");
    return teams.flatMap((team) => {
      const teamPositions = positionsByTeam.get(team.code) ?? [];
      const share = coveredDays(assignmentsByTeam.get(team.code) ?? [], window) / window.days;
      const department = departmentByCode.get(team.departmentCode);
      return teamPositions
        .filter((position) => COUNTED_POSITIONS.has(position.name))
        .map((position) => {
          const occupants = active.get(position.code) ?? [];
          const allocatedHours = seatHours(occupants);
          return {
            month,
            departmentName: department?.name ?? null,
            teamCode: team.code,
            teamName: team.name,
            practiceName: practiceByTeam.get(team.code),
            positionName: position.name,
            filled: occupants.length > 0,
            availableHours: HOURS_PER_PERSON,
            allocatedHours: round1(allocatedHours),
            utilizedHours: round1(allocatedHours * share),
          };
        });
    });
  });
}

// One row per live position, with where it sits and whether someone is deployed
// to it today. The team's practice is added by buildStructure.
export const STRUCTURE_SQL = `
  select d.name as "departmentName", d.floor_number as "floorNumber",
         t.code as "teamCode", t.name as "teamName", p.name as "positionName", p.competencies,
         exists (
           select 1 from resource_deployment rd
            where rd.position_code = p.code and rd.deleted_at is null
              and rd.start_date <= current_date and rd.end_date >= current_date
         ) as filled
    from positions p
    join teams t on t.code = p.team_code and t.deleted_at is null
    left join departments d on d.code = t.department_code and d.deleted_at is null
   where p.deleted_at is null
   order by t.code, p.code`;

// Which practice each competency belongs to. A competency whose practice is
// deleted keeps its row, with no practice.
export const COMPETENCY_PRACTICE_SQL = `
  select c.name, p.name as "practiceName"
    from competencies c
    left join practices p on p.code = c.practice_code and p.deleted_at is null
   where c.deleted_at is null`;

const splitNames = (text) =>
  (text ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

// A team's practice is its main competency's practice, as in the Control Center.
export function buildStructure(positions, competencyRows) {
  const practiceByCompetency = new Map(competencyRows.map((c) => [c.name, c.practiceName]));
  const practiceByTeam = new Map(
    [...indexBy(positions, "teamCode")].map(([teamCode, rows]) => [teamCode, practiceByCompetency.get(competenciesOf(rows).primary) ?? null])
  );
  return positions.map(({ competencies, ...position }) => ({
    ...position,
    practiceName: practiceByTeam.get(position.teamCode),
    competencies: splitNames(competencies),
  }));
}

// Competencies, modules, departments and practices as one list, told apart by
// `kind`, so the page loads its reference data in one request.
export const CATALOG_SQL = `
  select 'competency' as kind, c.name, p.name as "practiceName", null::int as "floorNumber", null::text as input, null::text as output
    from competencies c
    left join practices p on p.code = c.practice_code and p.deleted_at is null
   where c.deleted_at is null
  union all
  select 'module', m.name, p.name, null, null, null
    from modules m
    left join practices p on p.id::text = m.practice_id::text and p.deleted_at is null
   where m.deleted_at is null
  union all
  select 'department', d.name, null, d.floor_number, d.input, d.output
    from departments d where d.deleted_at is null
  union all
  select 'practice', p.name, null, null, null, null
    from practices p where p.deleted_at is null
  order by 1, 2`;

// Left joins keep an assignment whose team, department or project has since
// been deleted, so the page still counts it and shows the missing part as Not set.
export const ASSIGNMENTS_SQL = `
  select pa.team_code as "teamCode", t.name as "teamName", d.name as "departmentName",
         pa.project_id as "projectId", p.project_name as "projectName",
         p.project_profit_center_code as "profitCenter",
         pa.project_assignment_start_date::text as start, pa.project_assignment_end_date::text as "end"
    from project_assignments pa
    left join teams t on t.code = pa.team_code and t.deleted_at is null
    left join departments d on d.code = t.department_code and d.deleted_at is null
    left join projects p on p.project_id = pa.project_id and p.deleted_at is null
   where pa.deleted_at is null
   order by pa.project_assignment_start_date, pa.team_code`;
