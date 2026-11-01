import { describe, expect, it, vi } from 'vitest';
import { allNodeKeys, buildOrgStructure, roleOf } from './orgStructure';

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
  buildOrgStructure({ departments, teams, positions, competencies, practices, deployments, ...overrides });
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

  it('ignores a deployment without an employee id', () => {
    const broken = [{ positionId: 'POS-1', employeeId: null, employeeName: 'Ghost', ...live }];
    const finance = managerOf(build({ deployments: broken }), 'pm-3').departments[0].practices[0];
    expect(finance.moduleLeads.map((lead) => lead.isUnallocated)).toEqual([true]);
  });

  it('puts a team under "No practice" when its practice is deleted, keeping seats consistent', () => {
    const deleted = practices.map((p) => (p.code === 'PRAC-001' ? { ...p, markedDeleted: 'Yes' } : p));
    const configuration = managerOf(build({ practices: deleted }), 'pm-3').departments[0];
    expect(configuration.practices.map((p) => p.name)).toEqual(['Logistics Buy Side', 'No practice']);
    expect(configuration.practices.reduce((sum, p) => sum + p.seats, 0)).toBe(configuration.seats);
  });

  it('gives every node a key that is unique in the tree', () => {
    const keys = allNodeKeys(build());
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('DEPT-009/PRAC-001/7');
  });

  it('uses the first practice and warns when a team spans two', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mixed = [position('POS-9', 'TEAM-001', 'Consultant', 'FICO, MM')];
    const result = build({ positions: mixed });
    expect(managerOf(result, 'pm-3').departments[0].practices[0].name).toBe('Finance');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('keeps a department with no teams at zero seats and no practice groups', () => {
    const result = build({ teams: [], positions: [] });
    expect(managerOf(result, 'pm-3').departments[0]).toMatchObject({ seats: 0, practices: [] });
    expect(result.totalSeats).toBe(0);
  });
});
