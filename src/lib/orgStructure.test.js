import { describe, expect, it } from 'vitest';
import { buildOrgStructure, roleOf } from './orgStructure';

const departments = [
  { code: 'DEPT-001', name: 'Design Services', floorNumber: 10, markedDeleted: 'No' },
  { code: 'DEPT-002', name: 'Old Dept', floorNumber: 1, markedDeleted: 'Yes' },
];
const teams = [
  { code: 'TEAM-001', name: 'TEAM-001', departmentCode: 'DEPT-001', markedDeleted: 'No' },
  { code: 'TEAM-002', name: 'TEAM-002', departmentCode: 'DEPT-001', markedDeleted: 'No' },
  { code: 'TEAM-003', name: 'TEAM-003', departmentCode: 'DEPT-001', markedDeleted: 'Yes' },
];
const positions = [
  { name: 'Module Lead', teamCode: 'TEAM-001', competencies: 'FICO', markedDeleted: 'No' },
  { name: 'Lead Consultant', teamCode: 'TEAM-001', competencies: 'FICO, FM', markedDeleted: 'No' },
  { name: 'Consultant', teamCode: 'TEAM-001', competencies: 'FICO', markedDeleted: 'No' },
  { name: 'Consultant', teamCode: 'TEAM-001', competencies: 'FICO', markedDeleted: 'Yes' },
  { name: 'Module Lead - Finance', teamCode: 'TEAM-002', competencies: null, markedDeleted: 'No' },
  { name: 'Enterprise Architect', teamCode: 'TEAM-002', competencies: '', markedDeleted: 'No' },
];

describe('roleOf', () => {
  it('maps position names to roles', () => {
    expect(roleOf('Module Lead')).toBe('moduleLead');
    expect(roleOf('Module Lead - Finance')).toBe('moduleLead');
    expect(roleOf('Lead Consultant')).toBe('leadConsultant');
    expect(roleOf('Consultant')).toBe('consultant');
    expect(roleOf('Enterprise Architect')).toBe('other');
  });
});

describe('buildOrgStructure', () => {
  const result = buildOrgStructure({ departments, teams, positions });

  it('drops soft-deleted departments, teams and positions', () => {
    expect(result.departments.map((d) => d.code)).toEqual(['DEPT-001']);
    expect(result.departments[0].teams.map((t) => t.code)).toEqual(['TEAM-001', 'TEAM-002']);
  });

  it('counts seats as live positions at every level', () => {
    const [team1, team2] = result.departments[0].teams;
    expect(team1.seats).toBe(3);
    expect(team2.seats).toBe(2);
    expect(result.departments[0].seats).toBe(5);
    expect(result.totalSeats).toBe(5);
  });

  it('breaks a team down by role and merges competencies', () => {
    const [team1, team2] = result.departments[0].teams;
    expect(team1).toMatchObject({ moduleLeads: 1, leadConsultants: 1, consultants: 1, others: 0 });
    expect(team1.competencies).toEqual(['FICO', 'FM']);
    expect(team2).toMatchObject({ moduleLeads: 1, others: 1, competencies: [] });
  });

  it('keeps a department with no teams at zero seats', () => {
    const empty = buildOrgStructure({ departments, teams: [], positions: [] });
    expect(empty.departments[0]).toMatchObject({ seats: 0, teams: [] });
    expect(empty.totalSeats).toBe(0);
  });
});
