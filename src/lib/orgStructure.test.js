import { describe, expect, it, vi } from 'vitest';
import { buildOrgStructure, roleOf } from './orgStructure';
import { ODC_PROJECT_MANAGERS } from './odcLeadership';

const live = { markedDeleted: 'No' };
const departments = [
  { code: 'DEPT-002', name: 'Design Services', floorNumber: 10, ...live },
  { code: 'DEPT-009', name: 'Configuration Services', floorNumber: 9, ...live },
  { code: 'DEPT-099', name: 'Brand New Department', floorNumber: 20, ...live },
  { code: 'DEPT-088', name: 'Old Department', floorNumber: 21, markedDeleted: 'Yes' },
];
const teams = [
  { code: 'TEAM-001', name: 'TEAM-001', departmentCode: 'DEPT-009', ...live },
  { code: 'TEAM-002', name: 'TEAM-002', departmentCode: 'DEPT-009', ...live },
  { code: 'TEAM-003', name: 'TEAM-003', departmentCode: 'DEPT-009', ...live },
  { code: 'TEAM-004', name: 'TEAM-004', departmentCode: 'DEPT-002', ...live },
  { code: 'TEAM-005', name: 'TEAM-005', departmentCode: 'DEPT-009', markedDeleted: 'Yes' },
  { code: 'TEAM-006', name: 'TEAM-006', departmentCode: 'DEPT-099', ...live },
];
const position = (code, teamCode, name, competencies) => ({ code, teamCode, name, competencies, ...live });
const positions = [
  position('POS-1', 'TEAM-001', 'Module Lead', 'FICO, FM'),
  position('POS-2', 'TEAM-001', 'Lead Consultant', 'FICO, FM'),
  position('POS-3', 'TEAM-001', 'Consultant', 'FICO, FM'),
  position('POS-4', 'TEAM-002', 'Module Lead', 'FICO'),
  position('POS-5', 'TEAM-002', 'Consultant', 'FICO'),
  { ...position('POS-6', 'TEAM-002', 'Consultant', 'FICO'), markedDeleted: 'Yes' },
  position('POS-7', 'TEAM-003', 'Module Lead', 'MM, SRM'),
  position('POS-8', 'TEAM-004', 'Enterprise Architect', null),
];
const competencies = [
  { name: 'FICO', practiceId: 'PRAC-001', ...live },
  { name: 'FM', practiceId: 'PRAC-001', ...live },
  { name: 'MM', practiceId: 'PRAC-002', ...live },
  { name: 'SRM', practiceId: 'PRAC-002', ...live },
];
const practices = [
  { code: 'PRAC-002', name: 'Logistics Buy Side', ...live },
  { code: 'PRAC-001', name: 'Finance', ...live },
];
const deployments = [
  { positionId: 'POS-1', employeeId: 7, employeeName: 'Asha', ...live },
  { positionId: 'POS-4', employeeId: 7, employeeName: 'Asha', ...live },
  { positionId: 'POS-7', employeeId: 9, employeeName: 'Bilal', markedDeleted: 'Yes' },
];

const build = (overrides = {}) =>
  buildOrgStructure({ departments, teams, positions, competencies, practices, deployments, today: '2026-11-01', ...overrides });
const managerOf = (result, id) => result.projectManagers.find((manager) => manager.id === id);

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
  it('puts departments under the Project Manager listed in odcLeadership', () => {
    const result = build();
    expect(managerOf(result, 'pm-2').departments.map((d) => d.code)).toEqual(['DEPT-002']);
    expect(managerOf(result, 'pm-3').departments.map((d) => d.code)).toEqual(['DEPT-009']);
  });

  it("lists a manager's departments in the owner's department order, not the order in odcLeadership", () => {
    const extraDepartments = [
      { code: 'DEPT-014', name: 'Analyse Services', floorNumber: 11, ...live },
      { code: 'DEPT-011', name: 'Data Migration Services', floorNumber: 5, ...live },
    ];
    const extraTeams = [
      { code: 'TEAM-014', name: 'TEAM-014', departmentCode: 'DEPT-014', ...live },
      { code: 'TEAM-011', name: 'TEAM-011', departmentCode: 'DEPT-011', ...live },
    ];
    const result = build({ departments: [...departments, ...extraDepartments], teams: [...teams, ...extraTeams] });
    expect(managerOf(result, 'pm-2').departments.map((d) => d.code)).toEqual(['DEPT-011', 'DEPT-002', 'DEPT-014']);
  });

  it('lists the Unassigned departments in code order after the owner-ordered ones', () => {
    const extraDepartments = [{ code: 'DEPT-098', name: 'Another New Department', floorNumber: 22, ...live }];
    const extraTeams = [{ code: 'TEAM-098', name: 'TEAM-098', departmentCode: 'DEPT-098', ...live }];
    const result = build({ departments: [...departments, ...extraDepartments], teams: [...teams, ...extraTeams] });
    expect(managerOf(result, 'unassigned').departments.map((d) => d.code)).toEqual(['DEPT-098', 'DEPT-099']);
  });

  it('carries the named leaders from odcLeadership and leaves the other seats TBD', () => {
    const result = build();
    expect(result.deliveryManager.name).toBe('Mohammed Ibrahim S');
    expect(managerOf(result, 'pm-3').name).toBe('TBD');
    expect(managerOf(result, 'pm-2').name).toBe('TBD');
  });

  it('has seven project managers: Configuration alone under 3, Development and System Administration under Karthikeyan Rajendran as 4', () => {
    expect(ODC_PROJECT_MANAGERS.map((manager) => manager.id)).toEqual(['pm-1', 'pm-2', 'pm-3', 'pm-4', 'pm-5', 'pm-6', 'pm-7']);
    const byId = Object.fromEntries(ODC_PROJECT_MANAGERS.map((manager) => [manager.id, manager]));
    expect(byId['pm-2'].departmentCodes).toEqual(['DEPT-014', 'DEPT-002', 'DEPT-011']);
    expect(byId['pm-3'].departmentCodes).toEqual(['DEPT-009']);
    expect(byId['pm-4']).toMatchObject({ name: 'Karthikeyan Rajendran', departmentCodes: ['DEPT-003', 'DEPT-012'] });
    expect(byId['pm-5']).toMatchObject({ name: 'Yasam Panidhar', departmentCodes: ['DEPT-004'] });
    expect(byId['pm-6'].departmentCodes).toEqual(['DEPT-008', 'DEPT-010']);
    expect(byId['pm-7'].departmentCodes).toEqual(['DEPT-005', 'DEPT-013']);
    const all = ODC_PROJECT_MANAGERS.flatMap((manager) => manager.departmentCodes);
    expect(new Set(all).size).toBe(all.length);
  });

  it('shows a live department missing from the config under Unassigned and hides deleted ones', () => {
    const result = build();
    const unassigned = managerOf(result, 'unassigned');
    expect(unassigned.departments.map((d) => d.code)).toEqual(['DEPT-099']);
    expect(result.projectManagers.flatMap((m) => m.departments).map((d) => d.code)).not.toContain('DEPT-088');
  });

  it('omits the Unassigned group when every department is configured', () => {
    const result = build({ departments: departments.filter((d) => d.code !== 'DEPT-099') });
    expect(managerOf(result, 'unassigned')).toBeUndefined();
  });

  it('counts seats as live positions at every level', () => {
    const result = build();
    const configuration = managerOf(result, 'pm-3').departments[0];
    expect(configuration.seats).toBe(6);
    expect(managerOf(result, 'pm-3').seats).toBe(6);
    expect(result.totalSeats).toBe(7);
  });

  it('groups teams by the practice of their competencies, in practice code order', () => {
    const configuration = managerOf(build(), 'pm-3').departments[0];
    expect(configuration.practices.map((p) => p.name)).toEqual(['Finance', 'Logistics Buy Side']);
    expect(configuration.practices[0].seats).toBe(5);
  });

  it('puts a team with no competencies under "No practice", last', () => {
    const design = managerOf(build(), 'pm-2').departments[0];
    expect(design.practices.map((p) => p.name)).toEqual(['No practice']);
  });

  it('shares one Module Lead across teams where the same person is deployed', () => {
    const finance = managerOf(build(), 'pm-3').departments[0].practices[0];
    expect(finance.moduleLeads).toHaveLength(1);
    expect(finance.moduleLeads[0]).toMatchObject({ name: 'Asha' });
    expect(finance.moduleLeads[0].teams.map((t) => t.code)).toEqual(['TEAM-001', 'TEAM-002']);
  });

  it('files a team with an empty Module Lead seat under Unallocated', () => {
    const buySide = managerOf(build(), 'pm-3').departments[0].practices[1];
    expect(buySide.moduleLeads.map((lead) => lead.isUnallocated)).toEqual([true]);
  });

  it('names a Module Lead by employee id when the resource record is deleted', () => {
    const nameless = [{ positionId: 'POS-1', employeeId: 7, employeeName: null, ...live }];
    const lead = managerOf(build({ deployments: nameless }), 'pm-3').departments[0].practices[0].moduleLeads[0];
    expect(lead.name).toBe('Employee 7');
  });

  it('sorts Module Leads by name with Unallocated last, even with a nameless one', () => {
    const many = [
      { positionId: 'POS-1', employeeId: 7, employeeName: 'Zed', ...live },
      { positionId: 'POS-4', employeeId: 8, employeeName: null, ...live },
    ];
    const leads = managerOf(build({ deployments: many }), 'pm-3').departments[0].practices[0].moduleLeads;
    expect(leads.map((lead) => lead.name)).toEqual(['Employee 8', 'Zed']);
  });

  it('does not count a deployment without an employee as a filled seat', () => {
    const broken = [{ positionId: 'POS-1', employeeId: null, employeeName: 'Ghost', ...live }];
    const team = managerOf(build({ deployments: broken }), 'pm-3').departments[0].practices[0].moduleLeads[0].teams[0];
    expect(team.seatStates[0]).toEqual({ role: 'moduleLead', filled: false });
    expect(team.filled).toBe(0);
  });

  it('ignores a deployment without an employee id', () => {
    const broken = [{ positionId: 'POS-1', employeeId: null, employeeName: 'Ghost', ...live }];
    const finance = managerOf(build({ deployments: broken }), 'pm-3').departments[0].practices[0];
    expect(finance.moduleLeads.map((lead) => lead.isUnallocated)).toEqual([true]);
    expect(finance.moduleLeads[0].name).toBe('TBD');
  });

  it('puts a team under "No practice" when its practice is deleted, keeping seats consistent', () => {
    const deleted = practices.map((p) => (p.code === 'PRAC-001' ? { ...p, markedDeleted: 'Yes' } : p));
    const configuration = managerOf(build({ practices: deleted }), 'pm-3').departments[0];
    expect(configuration.practices.map((p) => p.name)).toEqual(['Logistics Buy Side', 'No practice']);
    expect(configuration.practices.reduce((sum, p) => sum + p.seats, 0)).toBe(configuration.seats);
  });

  it('counts a deployment only from its start date to its end date, both days included', () => {
    const dated = (startDate, endDate) => [{ positionId: 'POS-1', employeeId: 7, employeeName: 'Asha', startDate, endDate, ...live }];
    const leadsFor = (rows) => managerOf(build({ deployments: rows }), 'pm-3').departments[0].practices[0].moduleLeads;

    expect(leadsFor(dated('2026-08-01', '2027-03-31'))[0].name).toBe('Asha');
    expect(leadsFor(dated('2026-11-01', '2026-11-01'))[0].name).toBe('Asha');
    expect(leadsFor(dated('2026-06-01', '2026-10-31'))[0].isUnallocated).toBe(true);
    expect(leadsFor(dated('2026-11-02', '2027-03-31'))[0].isUnallocated).toBe(true);
  });

  it('tracks filled seats per team, practice, department and manager', () => {
    const result = build();
    const configuration = managerOf(result, 'pm-3').departments[0];
    const finance = configuration.practices[0];
    expect(finance.moduleLeads[0].teams[0].seatStates).toEqual([
      { role: 'moduleLead', filled: true },
      { role: 'leadConsultant', filled: false },
      { role: 'consultant', filled: false },
    ]);
    expect(finance.moduleLeads[0].teams[0].filled).toBe(1);
    expect(finance.filled).toBe(2);
    expect(configuration.filled).toBe(2);
    expect(managerOf(result, 'pm-3').filled).toBe(2);
    expect(result.filledSeats).toBe(2);
  });

  it('counts teams and departments for the totals', () => {
    const result = build();
    expect(managerOf(result, 'pm-3').teamCount).toBe(3);
    expect(result.totalTeams).toBe(5);
    expect(result.totalDepartments).toBe(3);
  });

  it('counts a team once per practice even when a shared lead covers it', () => {
    const finance = managerOf(build(), 'pm-3').departments[0].practices[0];
    expect(finance.teamCount).toBe(2);
  });

  it('uses the first practice and warns when a team spans two', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mixed = [position('POS-9', 'TEAM-001', 'Consultant', 'FICO, MM')];
    const result = build({ positions: mixed });
    expect(managerOf(result, 'pm-3').departments[0].practices[0].name).toBe('Finance');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('leaves out a department with no teams, and a manager whose departments are all empty', () => {
    const result = build({ teams: teams.filter((team) => team.departmentCode !== 'DEPT-002') });
    expect(result.projectManagers.map((manager) => manager.id)).toEqual(['pm-3', 'unassigned']);
  });

  it('shows nothing under the Delivery Manager when there are no teams at all', () => {
    const result = build({ teams: [], positions: [] });
    expect(result.projectManagers).toEqual([]);
    expect(result.totalSeats).toBe(0);
  });
});
