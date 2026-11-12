import { describe, expect, it } from 'vitest';
import { buildHierarchy, keysWithChildren } from './orgHierarchy';

const team = (code, seats, filled) => ({ code, name: code, seats, filled });
const structure = {
  deliveryManager: { title: 'ODC Delivery Manager', name: 'Mohammed Ibrahim S' },
  totalSeats: 12,
  filledSeats: 3,
  projectManagers: [
    {
      id: 'pm-1',
      title: 'ODC Project Manager 1',
      name: 'TBD',
      seats: 12,
      filled: 3,
      departments: [
        {
          code: 'DEPT-009',
          name: 'Configuration Services',
          floorNumber: 9,
          seats: 12,
          filled: 3,
          teamCount: 3,
          practices: [
            {
              key: 'DEPT-009/PRAC-001',
              code: 'PRAC-001',
              name: 'Finance',
              seats: 8,
              filled: 3,
              teamCount: 2,
              moduleLeads: [
                { key: 'DEPT-009/PRAC-001/7', name: 'Asha Rao', isUnallocated: false, teams: [team('TEAM-001', 5, 3), team('TEAM-002', 3, 0)] },
                { key: 'DEPT-009/PRAC-001/unallocated', name: 'TBD', isUnallocated: true, teams: [team('TEAM-002', 3, 0)] },
              ],
            },
            { key: 'DEPT-009/NO-PRACTICE', code: 'NO-PRACTICE', name: 'No practice', seats: 4, filled: 0, teamCount: 1, moduleLeads: [] },
          ],
        },
      ],
    },
    { id: 'pm-2', title: 'ODC Project Manager 2', name: 'Yasam Panidhar', seats: 0, filled: 0, departments: [] },
  ],
};

describe('buildHierarchy', () => {
  const root = buildHierarchy(structure);

  it('heads the tree with the Delivery Manager and lists the managers under it', () => {
    expect(root).toMatchObject({ key: 'leader', kind: 'leader', label: 'ODC Delivery Manager', title: 'Mohammed Ibrahim S', meta: '3/12 seats · 2 project managers' });
    expect(root.children.map((node) => [node.label, node.title])).toEqual([
      ['ODC Project Manager 1', 'Name TBD'],
      ['ODC Project Manager 2', 'Yasam Panidhar'],
    ]);
  });

  it('goes manager, department, practice, Module Lead, team, each with its seats and counts', () => {
    const [pm1] = root.children;
    expect(pm1.meta).toBe('3/12 seats · 1 department');
    const [department] = pm1.children;
    expect(department).toMatchObject({ kind: 'department', label: 'Department · Floor 9', title: 'Configuration Services', meta: '3/12 seats · 3 teams' });
    const [finance, noPractice] = department.children;
    expect(finance).toMatchObject({ kind: 'practice', title: 'Finance', meta: '3/8 seats · 2 teams' });
    expect(noPractice.children).toEqual([]);
    const [asha, tbd] = finance.children;
    expect(asha).toMatchObject({ kind: 'lead', label: 'Module Lead', title: 'Asha Rao', meta: '2 teams' });
    expect(tbd).toMatchObject({ title: 'TBD', meta: '1 team' });
    expect(asha.children[0]).toMatchObject({ kind: 'team', title: 'TEAM-001', meta: '3/5 seats', teamCode: 'TEAM-001', children: [] });
  });

  it('gives every node a key that is unique in the whole tree, even a team under two Module Leads', () => {
    const keys = [];
    const walk = (node) => {
      keys.push(node.key);
      node.children.forEach(walk);
    };
    walk(root);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((key) => key.endsWith('/TEAM-002'))).toHaveLength(2);
  });
});

describe('keysWithChildren', () => {
  it('lists the nodes that have something under them and leaves the leaves out', () => {
    const keys = keysWithChildren(buildHierarchy(structure));
    expect(keys).toEqual(['leader', 'pm-1', 'pm-1/DEPT-009', 'DEPT-009/PRAC-001', 'DEPT-009/PRAC-001/7', 'DEPT-009/PRAC-001/unallocated']);
  });
});
