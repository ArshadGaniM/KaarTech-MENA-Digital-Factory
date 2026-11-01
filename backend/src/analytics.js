// Flat, read-only datasets for the Dashboard's analytics page. The page slices
// them in the browser, so one request feeds every chart and a click on a
// slicer costs no round trip.
//
//  - people: one row per live resource, with the total allocation of the
//    deployments running today.
//  - seats: one row per counted seat (Consultant or Lead Consultant) per
//    month, using the Control Center's hour rules.
import { COUNTED_POSITIONS, HOURS_PER_PERSON, competenciesOf, coveredDays, deployedOn, isValidMonth, monthWindow, referenceDay } from "./controlCenter.js";

export const MAX_MONTHS = 24;
const MAX_SKILLS = 5;
const MAX_SKILL_LENGTH = 40;
const round1 = (n) => Math.round(n * 10) / 10;

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

const groupBy = (rows, key) => {
  const index = new Map();
  for (const row of rows) index.set(row[key], [...(index.get(row[key]) ?? []), row]);
  return index;
};

export function buildSeats({ departments, teams, positions, deployments, assignments, competencies = [] }, from, to, today) {
  const departmentByCode = new Map(departments.map((d) => [d.code, d]));
  const practiceByCompetency = new Map(competencies.map((c) => [c.name, c.practiceName]));
  const positionsByTeam = groupBy(positions, "teamCode");
  const assignmentsByTeam = groupBy(assignments, "teamCode");

  return monthsBetween(from, to).flatMap((month) => {
    const window = monthWindow(month);
    const active = groupBy(deployedOn(deployments, referenceDay(window, today)), "positionCode");
    return teams.flatMap((team) => {
      const teamPositions = positionsByTeam.get(team.code) ?? [];
      const share = coveredDays(assignmentsByTeam.get(team.code) ?? [], window) / window.days;
      const practice = practiceByCompetency.get(competenciesOf(teamPositions).primary) ?? null;
      const department = departmentByCode.get(team.departmentCode);
      return teamPositions
        .filter((position) => COUNTED_POSITIONS.has(position.name))
        .map((position) => {
          const occupants = active.get(position.code) ?? [];
          const percentage = occupants.reduce((sum, d) => sum + d.allocationPercentage, 0);
          // A seat never exceeds one person's hours, as in the Control Center.
          const allocatedHours = Math.min(HOURS_PER_PERSON, (HOURS_PER_PERSON * percentage) / 100);
          return {
            month,
            departmentCode: team.departmentCode,
            departmentName: department?.name ?? null,
            teamCode: team.code,
            teamName: team.name,
            practiceName: practice,
            positionName: position.name,
            filled: occupants.length > 0,
            availableHours: HOURS_PER_PERSON,
            allocatedHours: round1(allocatedHours),
            utilizedHours: round1(allocatedHours * share),
            occupants: occupants.map((d) => ({ employeeId: d.employeeId, name: d.employeeName, percentage: d.allocationPercentage })),
          };
        });
    });
  });
}
