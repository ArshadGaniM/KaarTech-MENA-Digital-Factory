import { isNamed } from '../components/OrganizationStructure/leaderName';

const pluralize = (count, noun) => `${count} ${count === 1 ? noun : `${noun}s`}`;
const seatsText = (filled, seats) => `${filled}/${seats} seats`;

// The Organization Structure as one tree for the Tree view: the ODC Delivery
// Manager, the Project Managers, their departments, practices, Module Leads and
// teams. Every node has a `key` that is unique in the whole tree, a `kind`, the
// small `label` above the title, the `title`, a `meta` line and its `children`.
// A team also carries its `teamCode`, so a click can open the team popup.
export function buildHierarchy(structure) {
  const { deliveryManager, projectManagers, totalSeats, filledSeats } = structure;

  const team = (lead, t) => ({
    key: `${lead.key}/${t.code}`,
    kind: 'team',
    label: 'Team',
    title: t.name,
    meta: seatsText(t.filled, t.seats),
    teamCode: t.code,
    children: [],
  });
  const lead = (practice, l) => ({
    key: l.key,
    kind: 'lead',
    label: 'Module Lead',
    title: l.isUnallocated ? 'TBD' : l.name,
    meta: pluralize(l.teams.length, 'team'),
    children: l.teams.map((t) => team(l, t)),
  });
  const practice = (p) => ({
    key: p.key,
    kind: 'practice',
    label: 'Practice',
    title: p.name,
    meta: `${seatsText(p.filled, p.seats)} · ${pluralize(p.teamCount, 'team')}`,
    children: p.moduleLeads.map((l) => lead(p, l)),
  });
  const department = (manager, d) => ({
    key: `${manager.id}/${d.code}`,
    kind: 'department',
    label: `Department · Floor ${d.floorNumber ?? '–'}`,
    title: d.name,
    meta: `${seatsText(d.filled, d.seats)} · ${pluralize(d.teamCount, 'team')}`,
    children: d.practices.map(practice),
  });
  const manager = (m) => ({
    key: m.id,
    kind: 'manager',
    label: m.title,
    title: isNamed(m.name) ? m.name : 'Name TBD',
    meta: `${seatsText(m.filled, m.seats)} · ${pluralize(m.departments.length, 'department')}`,
    children: m.departments.map((d) => department(m, d)),
  });

  return {
    key: 'leader',
    kind: 'leader',
    label: deliveryManager.title,
    title: isNamed(deliveryManager.name) ? deliveryManager.name : 'Name TBD',
    meta: `${seatsText(filledSeats, totalSeats)} · ${pluralize(projectManagers.length, 'project manager')}`,
    children: projectManagers.map(manager),
  };
}

// Every key that has something under it, for Expand all.
export function keysWithChildren(node) {
  return node.children.length === 0 ? [] : [node.key, ...node.children.flatMap(keysWithChildren)];
}
